<?php
// PHP built-in server router, confined to the isolated .local WordPress directory.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
$root=realpath(__DIR__.'/../../.local/wordpress');
$file=realpath($root.'/'.rawurldecode($path));
if ($file && str_starts_with($file,$root.DIRECTORY_SEPARATOR) && is_file($file)) return false;
if (str_starts_with($path,'/wp-admin') && !str_ends_with($path,'/')) { header('Location: '.$path.'/',true,301); return true; }
if ($file && is_dir($file) && is_file($file.'/index.php')) { require $file.'/index.php'; return true; }
require $root.'/index.php';
