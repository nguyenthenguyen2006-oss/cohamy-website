<?php
if(PHP_SAPI!=='cli')exit(1);require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';if(!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP)exit(1);
$id=$argv[1];$start=microtime(true);Cohamy\export_tick($id);echo 'export_tick seconds '.round(microtime(true)-$start,3).PHP_EOL;
