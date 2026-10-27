param(
    [Parameter(Mandatory)][string[]]$Assets,
    [string]$AssemblyPath, [string]$ProfilePath,
    [ValidateSet('live', 'test', 'unknown')][string]$Dataset,
    [string]$SourceLabel, [string]$ExcludeContainer
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'nzm-toolkit-path.ps1')
& (Join-Path (Get-NzmToolkitRoot) 'tools/inspect-nzm-bytecode.ps1') @PSBoundParameters -Workspace (Split-Path $PSScriptRoot -Parent)
