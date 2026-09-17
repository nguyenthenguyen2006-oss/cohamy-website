<?php
// CLI-only probes for the isolated local setup; never run against a production CMS.
if (PHP_SAPI!=='cli') exit(1);
require dirname(__DIR__,2).'/.local/wordpress/wp-load.php';
if (!defined('COHAMY_LOCAL_SETUP') || !COHAMY_LOCAL_SETUP || wp_get_environment_type()!=='local') exit(1);
$action=$argv[1] ?? 'status';
global $wpdb,$wp_version;
if ($action==='hold-webhooks') {
    $held=time();
    if (!add_option('cohamy_outbox_lock',$held,'','no')) { fwrite(STDERR,"Outbox sender busy; retry after its current batch.\n"); exit(2); }
    update_option('cohamy_local_probe_lock',$held,false);
    echo json_encode(['held'=>true]).PHP_EOL;
} elseif ($action==='release-webhooks') {
    if (get_option('cohamy_outbox_lock')!==get_option('cohamy_local_probe_lock')) { fwrite(STDERR,"Probe no longer owns lock.\n"); exit(2); }
    delete_option('cohamy_outbox_lock'); delete_option('cohamy_local_probe_lock');
    echo json_encode(['released'=>true]).PHP_EOL;
} elseif ($action==='backup') {
    $directory=dirname(__DIR__,2).'/.local/backups/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));
    mkdir($directory,0700,true);
    $destination=$directory.'/wordpress.sqlite';
    $pdo=new PDO('sqlite:'.ABSPATH.'wp-content/database/.ht.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA busy_timeout=10000');
    $pdo->exec('VACUUM INTO '.$pdo->quote($destination));
    $restorePath=$directory.'/restored';mkdir($restorePath,0700,true);copy($destination,$restorePath.'/wordpress.sqlite');
    $snapshot=new PDO('sqlite:'.$destination);$restored=new PDO('sqlite:'.$restorePath.'/wordpress.sqlite');
    if ($restored->query('PRAGMA integrity_check')->fetchColumn()!=='ok') throw new RuntimeException('Backup integrity failed.');
    $counts=[];
    foreach ($snapshot->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $quoted='"'.str_replace('"','""',$table).'"';$expected=(int)$snapshot->query('SELECT COUNT(*) FROM '.$quoted)->fetchColumn();
        $actual=(int)$restored->query('SELECT COUNT(*) FROM '.$quoted)->fetchColumn();
        if ($expected!==$actual) throw new RuntimeException('Restored table count differs: '.$table);
        $counts[$table]=$actual;
    }
    $media=[];$uploads=wp_upload_dir()['basedir'];if(is_dir($uploads)){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploads,FilesystemIterator::SKIP_DOTS)) as $file){if(!$file->isFile() || $file->isLink())continue;$relative=substr($file->getPathname(),strlen($uploads)+1);$backup=$directory.'/uploads/'.$relative;$restore=$restorePath.'/uploads/'.$relative;foreach([$backup,$restore] as $target){if(!is_dir(dirname($target)))mkdir(dirname($target),0700,true);if(!copy($file->getPathname(),$target))throw new RuntimeException('Không backup media.');} $hash=hash_file('sha256',$file->getPathname());if(hash_file('sha256',$backup)!==$hash || hash_file('sha256',$restore)!==$hash)throw new RuntimeException('Restored media checksum differs.');$media[str_replace('\\','/',$relative)]=$hash;}}
    echo json_encode(['database_integrity'=>'ok','restored_counts'=>$counts,'file'=>$destination,'sha256'=>hash_file('sha256',$destination),'restored_sha256'=>hash_file('sha256',$restorePath.'/wordpress.sqlite'),'restored_media'=>$media,'comparison_scope'=>'consistent snapshot vs separate restored copy, not moving live counts']).PHP_EOL;
} else {
    echo json_encode(['wordpress'=>$wp_version,'rank_math'=>RANK_MATH_VERSION,'timezone'=>wp_timezone_string(),'revision'=>Cohamy\revision(),'outbox'=>['delivered'=>(int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}cohamy_outbox WHERE delivered>0"),'pending'=>(int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}cohamy_outbox WHERE delivered=0")]]).PHP_EOL;
}
