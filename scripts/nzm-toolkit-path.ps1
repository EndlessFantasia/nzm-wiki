function Get-NzmToolkitRoot {
    $root = $env:NZM_TOOLKIT_ROOT
    if (!$root) {
        $entry = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.agents/skills/nzm-assets'
        $skill = Get-Item -Force -LiteralPath $entry -ErrorAction SilentlyContinue
        if ($skill) {
            if ($skill.LinkType) { $skill = $skill.ResolveLinkTarget($true) }
            $root = [IO.Path]::GetFullPath((Join-Path $skill.FullName '../..'))
        }
    }
    if (!$root -or !(Test-Path -LiteralPath (Join-Path $root 'runtime/BUILDINFO.json'))) {
        throw 'Install lostlightll/nzm-toolkit and run its scripts/Install-Skills.ps1, or set NZM_TOOLKIT_ROOT. See docs/workflows/nzm-toolkit.md.'
    }
    $root = [IO.Path]::GetFullPath($root)
    $lockPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'nzm-toolkit.json'
    if (Test-Path -LiteralPath $lockPath) {
        $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
        $actual = & git -C $root rev-parse HEAD 2>$null
        if ($LASTEXITCODE -ne 0 -or $actual -ne $lock.revision) { throw 'NZM Toolkit revision differs from nzm-toolkit.json; check out the pinned revision before running Wiki tools.' }
    }
    return $root
}
