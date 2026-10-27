param(
    [Parameter(Mandatory)][string]$Command,
    [string]$Query, [string]$Extension, [int]$Offset, [int]$Limit,
    [string]$Asset, [string]$Container, [string]$Against,
    [int]$MaxDifferences, [int]$MaxDepth, [int]$MaxNodes,
    [string]$Dialect, [string]$Function, [int]$MaxChanges, [int]$MaxWork,
    [string]$CliPath, [string]$Profile
)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
. (Join-Path $project 'scripts/nzm-toolkit-path.ps1')
$root = Get-NzmToolkitRoot
& (Join-Path $root 'skills/nzm-assets/scripts/Invoke-Nzm.ps1') @PSBoundParameters -Workspace $project
exit $LASTEXITCODE
