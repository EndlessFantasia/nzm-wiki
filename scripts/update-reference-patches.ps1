#requires -Version 7.0
<#
Stage explicit patch containers in place, then apply their latest asset versions
to refs. No containers are copied. Apply requires an explicit separate invocation;
old reference files are backed up and concurrent reference changes are rejected.
Use -Asset with exact uasset/luac paths to select assets from mixed containers;
unselected entries are recorded in the manifest instead of exported.
#>
param(
    [Parameter(Mandatory)][ValidateSet('Stage', 'Apply')][string]$Mode,
    [Parameter(Mandatory)][string]$OutputRoot,
    [string[]]$Container,
    [string[]]$Asset,
    [string]$AssemblyPath = 'D:/Workspace/FModel/FModel.Cli/bin/Release/net10.0/FModel.Cli.dll',
    [string]$ProfilePath = 'MD/_local/nzm-assets/nzm.json',
    [string]$ExcludeContainer = 'P_1.0.50.485.0_Patch_Season_4261608_P.pak',
    [ValidateRange(1, 1000)][int]$MaxAssets = 200
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot, $projectRoot)
$localRoot = [IO.Path]::GetFullPath('MD/_local/', $projectRoot)
$destinationRoot = [IO.Path]::GetFullPath('refs/Exports/NZM/Content', $projectRoot)
if (!$OutputRoot.StartsWith($localRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Run artifacts must be under MD/_local/.' }
function SafePath([string]$root, [string]$relative) {
    if ([IO.Path]::IsPathFullyQualified($relative) -or $relative -match '(^|[/\\])\.\.([/\\]|$)|:') { throw 'Invalid relative path.' }
    $path = [IO.Path]::GetFullPath($relative, $root)
    if (!$path.StartsWith($root.TrimEnd('/','\') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path escapes root.' }
    for ($current = $path; $current; $current = Split-Path -Parent $current) {
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Links are not allowed.' }
    }
    return $path
}
function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
$manifestPath = SafePath $OutputRoot 'manifest.json'
if ($Mode -eq 'Apply') {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.status -ne 'staged' -or $manifest.destination -ne $destinationRoot) { throw 'Expected a completed stage for the current reference directory.' }
    $publishPath = SafePath $OutputRoot 'publish.json'
    if (Test-Path -LiteralPath $publishPath) { throw 'This run already has a publication record; inspect it before continuing.' }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $manifest.files) {
        if (!$seen.Add($entry.path)) { throw 'Duplicate destination.' }
        $source = SafePath $OutputRoot ('content/' + $entry.path)
        $target = SafePath $destinationRoot $entry.path
        if ((Hash $source) -ne $entry.sha256) { throw "Staged hash mismatch: $($entry.path)" }
        $oldHash = if (Test-Path -LiteralPath $target) { Hash $target } else { $null }
        if ($oldHash -ne $entry.previousSha256) { throw "Reference changed after staging: $($entry.path)" }
    }
    # Complete all backups before the first reference write.
    foreach ($entry in $manifest.files | Where-Object previousSha256) {
        $backup = SafePath $OutputRoot ('backup/' + $entry.path)
        [IO.Directory]::CreateDirectory((Split-Path -Parent $backup)) | Out-Null
        [IO.File]::Copy((SafePath $destinationRoot $entry.path), $backup, $false)
        if ((Hash $backup) -ne $entry.previousSha256) { throw 'Backup hash mismatch.' }
    }
    $publication = [ordered]@{status='in-progress'; manifestSha256=(Hash $manifestPath); files=@()}
    $publication | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $publishPath -Encoding utf8
    foreach ($entry in $manifest.files) {
        $source = SafePath $OutputRoot ('content/' + $entry.path)
        $target = SafePath $destinationRoot $entry.path
        $currentHash = if (Test-Path -LiteralPath $target) { Hash $target } else { $null }
        if ($currentHash -ne $entry.previousSha256) { throw "Reference changed during publication: $($entry.path)" }
        [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
        $temporary = $target + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
        [IO.File]::Copy($source, $temporary, $false)
        [IO.File]::Move($temporary, $target, $true)
        if ((Hash $target) -ne $entry.sha256) { throw "Published hash mismatch: $($entry.path)" }
        $publication.files += [ordered]@{path=$entry.path; sha256=$entry.sha256; replaced=($null -ne $entry.previousSha256)}
        $publication | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $publishPath -Encoding utf8
    }
    $publication.status = 'verified'
    $publication.completedAtUtc = [DateTime]::UtcNow.ToString('o')
    $publication | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $publishPath -Encoding utf8
    Write-Output "Published and hash-verified $($publication.files.Count) reference files."
    exit 0
}
if (!$Container -or (Test-Path -LiteralPath $OutputRoot)) { throw 'Stage needs explicit containers and a new output root.' }
$selected = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($path in $Asset) {
    if ($path -notmatch '^NZM/Content/(?!.*\.\.)[^:]+\.(uasset|luac)$') { throw 'Selection requires exact uasset or luac paths.' }
    if (!$selected.Add($path)) { throw 'Duplicate selected asset.' }
}
$AssemblyPath = [IO.Path]::GetFullPath($AssemblyPath, $projectRoot)
$ProfilePath = [IO.Path]::GetFullPath($ProfilePath, $projectRoot)
$assembly = [Reflection.Assembly]::LoadFrom($AssemblyPath)
$profileType = $assembly.GetType('FModel.Cli.GameProfile', $true)
$sessionType = $assembly.GetType('FModel.Cli.GameSession', $true)
$optionsType = $assembly.GetType('FModel.Cli.CliOptions', $true)
$constructor = $sessionType.GetConstructor([Type[]]@($profileType, [bool], [string]))
if (!$constructor) { throw 'Native container exclusion is required.' }
$profile = [Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText($ProfilePath), $profileType)
$profileBase = Split-Path -Parent $ProfilePath
$profile.Directory = [IO.Path]::GetFullPath($profile.Directory, $profileBase)
if ($profile.Mappings) { $profile.Mappings = [IO.Path]::GetFullPath($profile.Mappings, $profileBase) }
$profile.OutputDirectory = SafePath $OutputRoot 'exports'
$manifest = [ordered]@{schemaVersion=1; status='in-progress'; destination=$destinationRoot; excludedContainer=$ExcludeContainer; toolSha256=(Hash $AssemblyPath); containers=@(); assets=@(); skippedEntries=@(); files=@()}
$session = $null
$stdout = [Console]::Out
[Console]::SetOut([IO.TextWriter]::Null)
try {
    $session = $constructor.Invoke([object[]]@($profile, $true, $ExcludeContainer))
    $session.Provider.ReadScriptData = $false
    $mount = $session.MountSummary()
    if ($mount.unloaded -ne 0 -or $mount.missingKeyGuids.Count -ne 0) { throw 'Mount incomplete.' }
    $manifest.mount = $mount
    [IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
    $assets = @{}
    foreach ($name in $Container | Sort-Object -Unique) {
        $options = $optionsType.GetMethod('Parse').Invoke($null, [object[]]@(,[string[]]@('list','--profile',$ProfilePath,'--container',$name,'--limit','200')))
        $listing = $session.ListContainer($options)
        if ($listing.total -gt 200) { throw 'Container exceeds the bounded single-page selection; use a narrower asset workflow.' }
        $manifest.containers += $listing.container
        $listing | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (SafePath $OutputRoot ($listing.container.name + '.list.json')) -Encoding utf8
        foreach ($item in $listing.assets) {
            if ($selected.Count -gt 0) {
                $logicalPath = $item.path -replace '\.(uexp|ubulk|uptnl)$', '.uasset'
                if (!$selected.Contains($logicalPath)) {
                    $manifest.skippedEntries += [ordered]@{path=$item.path; sourceContainer=$listing.container.name}
                    continue
                }
            }
            if ($item.path -notmatch '^NZM/Content/(?!.*\.\.)[^:]+\.(uasset|uexp|ubulk|uptnl|luac)$') { throw "Unsupported patch entry: $($item.path)" }
            if ($item.path -notmatch '\.(uasset|luac)$') { continue }
            if (!$assets.ContainsKey($item.path) -or $assets[$item.path].readOrder -lt $listing.container.readOrder) {
                $assets[$item.path] = [ordered]@{asset=$item.path; sourceContainer=$listing.container.name; readOrder=$listing.container.readOrder}
            }
        }
    }
    foreach ($path in $selected) {
        if (!$assets.ContainsKey($path)) { throw "Selected asset absent from requested containers: $path" }
    }
    if ($assets.Count -gt $MaxAssets) { throw 'Selection exceeds the asset limit.' }
    $textures = @()
    foreach ($item in $assets.Values | Sort-Object { $_.asset }) {
        $asset = $item.asset
        $file = $session.Provider[$asset]
        if ($file.Vfs.Name -ne $item.sourceContainer -or $file.Vfs.ReadOrder -ne $item.readOrder) { throw "Merged source differs from requested patches: $asset" }
        $relative = $asset.Substring(12)
        $raw = $session.Extract($asset)
        foreach ($part in $raw.files) {
            $virtualPath = [IO.Path]::GetRelativePath((Join-Path $profile.OutputDirectory 'raw'), $part.output).Replace('\','/')
            $partSource = $session.Provider[$virtualPath]
            if ($partSource.Vfs.Name -ne $item.sourceContainer) { throw "Mixed-version package payload: $virtualPath" }
            $target = SafePath $OutputRoot ('content/' + $virtualPath.Substring(12))
            [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
            [IO.File]::Copy($part.output, $target, $false)
        }
        if ($asset.EndsWith('.uasset')) {
            $result = $session.Inspect($asset)
            $null = Get-Content -LiteralPath $result.output -Raw | ConvertFrom-Json
            $target = SafePath $OutputRoot ('content/' + ($relative -replace '\.uasset$', '.json'))
            [IO.File]::Copy($result.output, $target, $false)
            $package = $session.Provider.LoadPackage($file)
            $texture = @($package.ExportsLazy | ForEach-Object {$_.Value} | Where-Object {$_ -is [CUE4Parse.UE4.Assets.Exports.Texture.UTexture2D]})
            if ($texture.Count -gt 1) { throw "Multiple textures require an explicit naming plan: $asset" }
            if ($texture.Count -eq 1) {
                $mip = $texture[0].GetFirstMip()
                if (!$mip -or !$mip.BulkData.Data.Length) { throw "Unreadable texture: $asset" }
                $payload = SafePath $OutputRoot ('mips/' + ($relative -replace '\.uasset$', '.bin'))
                [IO.Directory]::CreateDirectory((Split-Path -Parent $payload)) | Out-Null
                [IO.File]::WriteAllBytes($payload, $mip.BulkData.Data)
                $textures += [ordered]@{path=($relative -replace '\.uasset$', '.png'); payload=[IO.Path]::GetRelativePath($OutputRoot,$payload); width=$mip.SizeX; height=$mip.SizeY; format=[string]$texture[0].Format; sha256=(Hash $payload)}
            }
        }
        $manifest.assets += $item
        $stdout.WriteLine("Staged $($manifest.assets.Count)/$($assets.Count): $relative")
    }
    $texturePlan = SafePath $OutputRoot 'textures.json'
    ConvertTo-Json -InputObject @($textures) -Depth 6 | Set-Content -LiteralPath $texturePlan -Encoding utf8
    # Pillow is already used by decode-ui-textures.py; this bounded variant also
    # handles selected non-UI textures and never writes directly to refs.
    $decode = @'
import hashlib, json, sys
from pathlib import Path
from PIL import Image
root = Path(sys.argv[1])
for entry in json.loads((root / 'textures.json').read_text(encoding='utf-8-sig')):
    payload = (root / entry['payload']).read_bytes()
    assert hashlib.sha256(payload).hexdigest().upper() == entry['sha256']
    size = entry['width'], entry['height']
    fmt = entry['format']
    bcn = {'PF_BC7': 7, 'PF_DXT5': 3, 'PF_DXT1': 1, 'PF_DXT3': 2, 'PF_BC5': 5}
    if fmt in bcn:
        image = Image.frombytes('RGB' if fmt == 'PF_BC5' else 'RGBA', size, payload, 'bcn', bcn[fmt])
    elif fmt == 'PF_B8G8R8A8': image = Image.frombytes('RGBA', size, payload, 'raw', 'BGRA')
    elif fmt == 'PF_G8': image = Image.frombytes('L', size, payload)
    elif fmt == 'PF_R8G8B8A8': image = Image.frombytes('RGBA', size, payload)
    else: raise ValueError(f'Unsupported texture format: {fmt}')
    target = root / 'content' / entry['path']
    with target.open('xb') as stream: image.save(stream, format='PNG')
    with Image.open(target) as check:
        assert check.size == size
        check.verify()
print(f'Decoded and verified {len(json.loads((root / "textures.json").read_text(encoding="utf-8-sig")))} textures.')
'@
    & python -c $decode $OutputRoot
    if ($LASTEXITCODE -ne 0) { throw 'Texture decoding failed; refs were not changed.' }
    $manifest.textureCount = $textures.Count
    $contentRoot = SafePath $OutputRoot 'content'
    foreach ($file in Get-ChildItem -LiteralPath $contentRoot -Recurse -File) {
        $relative = [IO.Path]::GetRelativePath($contentRoot,$file.FullName).Replace('\','/')
        $target = SafePath $destinationRoot $relative
        $manifest.files += [ordered]@{path=$relative; sha256=(Hash $file.FullName); previousSha256=$(if (Test-Path -LiteralPath $target) {Hash $target} else {$null})}
    }
    $manifest.status = 'staged'
    $manifest.completedAtUtc = [DateTime]::UtcNow.ToString('o')
} finally {
    if (Test-Path -LiteralPath $OutputRoot) { $manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding utf8 }
    if ($session) { $session.Dispose() }
    $profile = $null
    [Console]::SetOut($stdout)
}
Write-Output "Stage complete: $($manifest.assets.Count) assets, $($manifest.files.Count) files, $($manifest.textureCount) PNGs."
