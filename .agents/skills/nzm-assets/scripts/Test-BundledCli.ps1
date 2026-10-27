$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
. (Join-Path $project 'scripts/nzm-toolkit-path.ps1')
& (Join-Path (Get-NzmToolkitRoot) 'skills/nzm-assets/scripts/Test-BundledCli.ps1')
