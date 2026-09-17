$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$baselinePath=Join-Path $repoPath '.local/source-before-headless.zip'
$unchanged=@(); $changed=@(); $missing=@()
$archive=[IO.Compression.ZipFile]::OpenRead($baselinePath)
try {
  foreach($entry in $archive.Entries) {
    if($entry.FullName.EndsWith('/')) { continue }
    $target=[IO.Path]::GetFullPath((Join-Path $repoPath $entry.FullName))
    if(!$target.StartsWith($repoPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive entry escaped workspace' }
    if(!(Test-Path -LiteralPath $target -PathType Leaf)) { $missing+=$entry.FullName; continue }
    $stream=$entry.Open(); $digest=[Security.Cryptography.SHA256]::Create()
    try { $originalHash=[BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-','') } finally { $stream.Dispose(); $digest.Dispose() }
    $currentHash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    if($originalHash -eq $currentHash) { $unchanged+=$entry.FullName } else { $changed+=$entry.FullName }
  }
} finally { $archive.Dispose() }
$required=@('data/products.ts','lib/products.ts','lib/google-sheets.ts','app/api/contact/route.ts','components/ContactForm.tsx')
foreach($file in $required) { if($unchanged -notcontains $file) { throw ('Unexpected change outside blog migration: '+$file) } }
$report=@{baselineHash=(Get-FileHash -LiteralPath $baselinePath -Algorithm SHA256).Hash;unchangedCount=$unchanged.Count;changed=$changed;missing=$missing;preservedCriticalPaths=$required;allowedIntegrationPaths=@('i18n/routing.ts','app/robots.ts');expectedReplacements=@{'app/sitemap.ts'='app/sitemap.xml/route.ts plus app/sitemaps/[name]/route.ts'};scope='Product data and contact Google Sheets source are byte-identical. Changed files include headless integrations and concurrent user CRM/commerce work; this report does not attribute all changes to headless work.'}
[IO.File]::WriteAllText((Join-Path $repoPath 'docs/headless/test-results/preserved-source.json'),($report|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$report | ConvertTo-Json -Depth 5
