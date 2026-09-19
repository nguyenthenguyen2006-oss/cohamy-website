import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@/components/crm/work.css";
import "@/components/crm/upgrade.css";
import "@/components/crm/commercial.css";
import {PwaRegistrar} from "@/components/crm/PwaRegistrar";
export const metadata: Metadata={title:{default:"CRM Cohamy",template:"%s | CRM Cohamy"},manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:"Cohamy",statusBarStyle:"black-translucent"},robots:{index:false,follow:false}};
export default function OperationsLayout({children}:{children:React.ReactNode}) {return <div className="cohamy-crm"><PwaRegistrar/>{children}</div>;}
