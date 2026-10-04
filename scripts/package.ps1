$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $projectRoot 'releases'
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$version = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
$zipPath = Join-Path $releaseDirectory "gallerypro-$version.zip"
Compress-Archive -Path (Join-Path $projectRoot 'dist\*') -DestinationPath $zipPath -Force
Write-Output $zipPath
