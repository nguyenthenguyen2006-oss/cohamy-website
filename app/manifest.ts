import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
 return {
  name:'Cohamy · Bàn làm việc',
  short_name:'Cohamy',
  description:'CRM nội bộ và cổng đại lý Cohamy.',
  start_url:'/crm',
  scope:'/',
  display:'standalone',
  background_color:'#f7f1e8',
  theme_color:'#2a120c',
  lang:'vi',
  icons:[
   {src:'/icons/cohamy-192.png',sizes:'192x192',type:'image/png'},
   {src:'/icons/cohamy-512.png',sizes:'512x512',type:'image/png'},
   {src:'/icons/cohamy-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
  ],
 };
}
