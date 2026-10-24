import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1300}});
 await page.setContent('<html><head><style>body{margin:0}section.docx{margin:0!important;box-shadow:none!important} .docx-wrapper{padding:0!important;background:white!important}@media print{body{margin:0}section.docx{margin:0!important;box-shadow:none!important}}</style></head><body><main id="document"></main></body></html>');
 for(const file of ['.local/crm-template-tools/node_modules/jszip/dist/jszip.min.js','.local/crm-template-tools/node_modules/docx-preview/dist/docx-preview.min.js'])await page.addScriptTag({content:await fs.readFile(file,'utf8')});
 const content=await fs.readFile('assets/crm/delivery-template/Hoa_Don_Giao_Hang_COHAMY.docx');
 await page.evaluate(async b64=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await window.docx.renderAsync(bytes,document.getElementById('document'),null,{inWrapper:false,ignoreLastRenderedPageBreak:false,renderHeaders:true,renderFooters:true,breakPages:true});await document.fonts.ready;},content.toString('base64'));
 const sections=page.locator('section.docx');const pages=await sections.count();
 for(let i=0;i<pages;i++)await sections.nth(i).screenshot({path:`docs/crm/test-results/document-flow/source-docx-page-${i+1}.png`});
 await page.pdf({path:'docs/crm/test-results/document-flow/source-docx-browser.pdf',preferCSSPageSize:true,format:'A4',printBackground:true});
 console.log(JSON.stringify({renderer:'docx-preview 0.3.7 / Edge (not Microsoft Word or LibreOffice)',pages,originalSHA256:'6aa3889e7c1b772e436b754080beaaa02aa150176991f7498690fab53627ac3e'}));
}finally{await browser.close();}
