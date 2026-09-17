$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$repoPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$pluginPath=Join-Path $repoPath 'wordpress/cohamy-headless-bridge'
$packagePath=Join-Path $repoPath '.headless-reports/packages'
New-Item -ItemType Directory -Force -Path $packagePath | Out-Null
$zipPath=Join-Path $packagePath ('cohamy-headless-bridge-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.zip')
$writer=[IO.Compression.ZipFile]::Open($zipPath,[IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $pluginPath -Recurse -File | ForEach-Object {
    $name='cohamy-headless-bridge/'+$_.FullName.Substring($pluginPath.Length+1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($writer,$_.FullName,$name,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $writer.Dispose() }
$zip=[IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries=@($zip.Entries | ForEach-Object {
    if(!$_.FullName.StartsWith('cohamy-headless-bridge/') -or $_.FullName.Contains('..')) { throw 'Invalid package entry' }
    # Open every entry so a broken ZIP cannot be handed off as an installable plugin.
    $stream=$_.Open(); $memory=New-Object IO.MemoryStream
    try { $stream.CopyTo($memory) } finally { $stream.Dispose(); $memory.Dispose() }
    $_.FullName
  })
} finally { $zip.Dispose() }
$manifest=@{file=($zipPath.Substring($repoPath.Length+1).Replace('\','/'));sha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash;entries=$entries;count=$entries.Count}
[IO.File]::WriteAllText((Join-Path $repoPath 'docs/headless/test-results/bridge-package.json'),($manifest|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$manifest | ConvertTo-Json -Depth 5
