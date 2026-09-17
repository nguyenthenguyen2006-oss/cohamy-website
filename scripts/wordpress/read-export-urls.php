<?php
if(PHP_SAPI!=='cli')exit(1);
$zip=new ZipArchive();if($zip->open($argv[1])!==true)throw new RuntimeException('ZIP invalid.');$urls=[];
for($i=0;$i<$zip->numFiles;$i++)if(str_ends_with($zip->getNameIndex($i),'.csv')){
    $stream=fopen('php://temp','w+');fwrite($stream,substr($zip->getFromIndex($i),10));rewind($stream);fgetcsv($stream,0,';','"','');
    while(($row=fgetcsv($stream,0,';','"',''))!==false)$urls[]=$row[0];fclose($stream);
}
$zip->close();echo json_encode($urls,JSON_UNESCAPED_SLASHES);
