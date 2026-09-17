param([int]$CmsPort=8081,[int]$FrontendPort=3001)
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repoRoot
$phpCommand=(Get-Command php).Source
$phpRuntimeDir=Split-Path -Parent $phpCommand
function New-LocalHex([int]$count) {
  $bytes=New-Object byte[] $count
  $generator=[Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
}
New-Item -ItemType Directory -Force .local/downloads,.local/wordpress | Out-Null
$packages=@{
  'wordpress.zip'='https://wordpress.org/wordpress-7.1.zip'
  'rank-math.zip'='https://downloads.wordpress.org/plugin/seo-by-rank-math.1.0.278.zip'
  'sqlite.zip'='https://downloads.wordpress.org/plugin/sqlite-database-integration.3.0.2.zip'
}
foreach($package in $packages.GetEnumerator()) {
  $archive=Join-Path '.local/downloads' $package.Key
  if(!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest $package.Value -OutFile $archive }
}
if(!(Test-Path .local/wordpress/wp-load.php)) { Expand-Archive .local/downloads/wordpress.zip .local -Force }
foreach($archive in @('rank-math.zip','sqlite.zip')) {
  $directory=if($archive -eq 'rank-math.zip'){'seo-by-rank-math'}else{'sqlite-database-integration'}
  if(!(Test-Path (Join-Path '.local/wordpress/wp-content/plugins' $directory))) { Expand-Archive (Join-Path '.local/downloads' $archive) .local/wordpress/wp-content/plugins -Force }
}
Copy-Item -LiteralPath wordpress/cohamy-headless-bridge -Destination .local/wordpress/wp-content/plugins -Recurse -Force
Copy-Item .local/wordpress/wp-content/plugins/sqlite-database-integration/db.copy .local/wordpress/wp-content/db.php -Force
$ini=@"
extension_dir="$phpRuntimeDir/ext"
extension=curl
extension=openssl
extension=mbstring
extension=fileinfo
extension=gd
extension=exif
extension=pdo_sqlite
extension=sqlite3
extension=zip
memory_limit=512M
upload_max_filesize=20M
post_max_size=24M
max_execution_time=120
display_errors=Off
log_errors=On
error_log="$repoRoot/.local/php-error.log"
"@
[IO.File]::WriteAllText((Join-Path $repoRoot '.local/php.ini'),$ini,[Text.UTF8Encoding]::new($false))
$localSecretsFile=Join-Path $repoRoot '.local/secrets.json'
if(!(Test-Path -LiteralPath $localSecretsFile)) {
  $localKey=New-LocalHex 32
  [IO.File]::WriteAllText($localSecretsFile,(@{webhook_secret=$localKey;cms_port=$CmsPort;frontend_port=$FrontendPort}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
}
$localConfig=Get-Content -LiteralPath $localSecretsFile -Raw | ConvertFrom-Json
if($localConfig.cms_port -ne $CmsPort -or $localConfig.frontend_port -ne $FrontendPort) { throw 'Ports differ from existing local configuration. Reuse recorded ports.' }
$wpConfigPath=Join-Path $repoRoot '.local/wordpress/wp-config.php'
if(!(Test-Path -LiteralPath $wpConfigPath)) {
  $wpSalt=New-LocalHex 48
  $wpConfig=@"
<?php
define('DB_NAME','cohamy_local'); define('DB_USER','local'); define('DB_PASSWORD',''); define('DB_HOST','localhost');
define('DB_CHARSET','utf8mb4'); define('DB_COLLATE','');
define('WP_HOME','http://127.0.0.1:$CmsPort'); define('WP_SITEURL',WP_HOME);
define('WP_ENVIRONMENT_TYPE','local'); define('COHAMY_LOCAL_SETUP',true);
define('DISABLE_WP_CRON',true); define('DISALLOW_FILE_EDIT',true);
define('COHAMY_PUBLIC_URL','https://cohamy.vn');
define('COHAMY_PREVIEW_URL','http://127.0.0.1:$FrontendPort');
define('COHAMY_WEBHOOK_URL','http://127.0.0.1:$FrontendPort/api/wordpress/webhook');
define('COHAMY_WEBHOOK_SECRET','$($localConfig.webhook_secret)');
define('AUTH_KEY','$wpSalt'); define('SECURE_AUTH_KEY',AUTH_KEY); define('LOGGED_IN_KEY',AUTH_KEY); define('NONCE_KEY',AUTH_KEY);
define('AUTH_SALT',AUTH_KEY); define('SECURE_AUTH_SALT',AUTH_KEY); define('LOGGED_IN_SALT',AUTH_KEY); define('NONCE_SALT',AUTH_KEY);
`$table_prefix='wp_';
if(!defined('ABSPATH')) define('ABSPATH',__DIR__.'/');
require_once ABSPATH.'wp-settings.php';
"@
  [IO.File]::WriteAllText($wpConfigPath,$wpConfig,[Text.UTF8Encoding]::new($false))
}
& $phpCommand -c .local/php.ini scripts/wordpress/bootstrap.php "$repoRoot/.local/wordpress" "$repoRoot/.local/credentials.json"
if($LASTEXITCODE -ne 0){throw 'WordPress bootstrap failed; inspect .local/php-error.log'}
$packageHashes=@{}; foreach($package in $packages.Keys){ $packageHashes[$package]=(Get-FileHash (Join-Path '.local/downloads' $package) -Algorithm SHA256).Hash }
[IO.File]::WriteAllText((Join-Path $repoRoot '.local/package-hashes.json'),($packageHashes|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
Write-Output 'Local WordPress configured. Credentials: .local/credentials.json (never commit). Start: npm run headless:local'
