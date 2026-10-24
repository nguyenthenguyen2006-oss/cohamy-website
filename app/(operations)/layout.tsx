import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/latin-800.css";
import "@fontsource/be-vietnam-pro/vietnamese-800.css";
import "@/components/crm/work.css";
import "@/components/crm/upgrade.css";
import "@/components/crm/commercial.css";
import "@/components/crm/crm-humanbank.css";
import {PwaRegistrar} from "@/components/crm/PwaRegistrar";
import {DemoBanner} from "@/components/crm/DemoBanner";
export const metadata: Metadata={title:{default:"CRM Cohamy",template:"%s | CRM Cohamy"},manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:"Cohamy",statusBarStyle:"black-translucent"},robots:{index:false,follow:false}};
export default function OperationsLayout({children}:{children:React.ReactNode}) {return <div className="cohamy-crm"><DemoBanner/><PwaRegistrar/>{children}</div>;}
