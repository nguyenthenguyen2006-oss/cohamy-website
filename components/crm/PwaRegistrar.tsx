'use client';
import {useEffect,useState} from 'react';

export function PwaRegistrar(){
 const [online,setOnline]=useState(true);
 useEffect(()=>{
  const update=()=>setOnline(navigator.onLine);update();
  addEventListener('online',update);addEventListener('offline',update);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
  return()=>{removeEventListener('online',update);removeEventListener('offline',update);};
 },[]);
 return <p className="pwa-offline-banner" role="status" hidden={online}>Đang offline. Bạn có thể tiếp tục sửa các biểu mẫu hỗ trợ nháp; hãy kết nối lại để gửi và kiểm tra dữ liệu.</p>;
}
