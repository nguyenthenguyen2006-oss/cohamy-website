<?php
if (PHP_SAPI!=='cli') exit(1);
$zip=new ZipArchive(); if ($zip->open($argv[1])!==true) throw new RuntimeException('ZIP invalid.');
$manifest=json_decode($zip->getFromName('manifest.json'),true,512,JSON_THROW_ON_ERROR); $all=[]; $counts=[];
foreach ($manifest['files'] as $file) {
    $data=$zip->getFromName($file['name']); if (hash('sha256',$data)!==$file['sha256']) throw new RuntimeException('SHA mismatch.');
    $rows=array_values(array_filter(explode("\r\n",$data),fn($r)=>$r!=='')); if (count($rows)!==$file['count']) throw new RuntimeException('Count mismatch.');
    $counts[]=count($rows); $all=array_merge($all,$rows);
}
if (count($all)!==10001 || count(array_unique($all))!==10001 || $counts!==[10000,1]) throw new RuntimeException('Expected 10000 + 1 unique frozen URLs.');
$frozen=isset($argv[2]) ? in_array($argv[2],$all,true) && !in_array($argv[3],$all,true) && !in_array($argv[4],$all,true) : null;
if(isset($argv[2]) && !$frozen)throw new RuntimeException('Export did not retain frozen membership and URLs.');
echo json_encode(['total'=>count($all),'unique'=>count(array_unique($all)),'files'=>$counts,'hashes_verified'=>true,'frozen_membership'=>$frozen,'manifest'=>$manifest]).PHP_EOL;
