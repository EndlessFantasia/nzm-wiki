#requires -Version 7.0
param(
    [Parameter(Mandatory)][string]$AssetPath,
    [string]$OutputPath, [string]$LibraryDirectory, [string]$MappingsPath,
    [string]$Game, [switch]$ReadScriptData
)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
. (Join-Path $project 'scripts/nzm-toolkit-path.ps1')
& (Join-Path (Get-NzmToolkitRoot) 'skills/nzm-uasset/scripts/Convert-LocalAsset.ps1') @PSBoundParameters -Workspace $project
