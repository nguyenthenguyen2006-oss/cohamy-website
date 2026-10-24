"""Extract layout facts from the supplied, unchanged Cohamy delivery DOCX."""
from pathlib import Path
import zipfile, xml.etree.ElementTree as E, json, hashlib, shutil

source=Path(r'C:\Users\ACER\Downloads\Hoa_Don_Giao_Hang_COHAMY.docx')
dest=Path('assets/crm/delivery-template'); dest.mkdir(parents=True,exist_ok=True)
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
def attr(e,key,default=None): return e.get('{'+ns['w']+'}'+key,default) if e is not None else default
def val(e,path,default=None): return attr(e.find(path,ns),'val',default)
def para(p):
    runs=[]
    for r in p.findall('w:r',ns):
        text=''.join((x.text or '') if x.tag.endswith('}t') else '\n' if x.tag.endswith('}br') else '' for x in r)
        image=r.find('.//w:drawing',ns) is not None
        runs.append({'text':text,'size':float(val(r,'w:rPr/w:sz',16))/2,'bold':r.find('w:rPr/w:b',ns) is not None and val(r,'w:rPr/w:b','1')!='0','italic':r.find('w:rPr/w:i',ns) is not None and val(r,'w:rPr/w:i','1')!='0','color':val(r,'w:rPr/w:color','394C60'),'image':image})
    sp=p.find('w:pPr/w:spacing',ns)
    return {'type':'p','runs':runs,'align':val(p,'w:pPr/w:jc','left'),'before':int(attr(sp,'before',0))/20,'after':int(attr(sp,'after',0))/20,'line':int(attr(sp,'line',259))/240,'shade':val(p,'w:pPr/w:shd')}
def table(t,index):
    rows=[]
    for row in t.findall('w:tr',ns):
        cells=[]
        for c in row.findall('w:tc',ns):
            mar=c.find('w:tcPr/w:tcMar',ns)
            margins={k:int(attr(mar.find('w:'+v,ns),'w',80))/20 if mar is not None else 4 for k,v in [('top','top'),('left','start'),('bottom','bottom'),('right','end')]}
            borders={}
            for side in ['top','left','bottom','right']:
                b=c.find('w:tcPr/w:tcBorders/w:'+side,ns)
                if b is not None: borders[side]={'color':attr(b,'color','D9E2E9'),'size':int(attr(b,'sz',4))/8}
            cells.append({'width':int(attr(c.find('w:tcPr/w:tcW',ns),'w',0))/20,'span':int(val(c,'w:tcPr/w:gridSpan',1)),'shade':attr(c.find('w:tcPr/w:shd',ns),'fill'), 'margins':margins,'borders':borders,'paragraphs':[para(p) for p in c.findall('w:p',ns)]})
        rows.append({'height':int(val(row,'w:trPr/w:trHeight',0))/20,'cells':cells})
    return {'type':'table','index':index,'grid':[int(attr(x,'w'))/20 for x in t.findall('w:tblGrid/w:gridCol',ns)],'rows':rows}
with zipfile.ZipFile(source) as z:
    root=E.fromstring(z.read('word/document.xml')); body=root.find('w:body',ns); blocks=[]; idx=0
    for child in body:
        if child.tag.endswith('}p'): blocks.append(para(child))
        elif child.tag.endswith('}tbl'): blocks.append(table(child,idx));idx+=1
    footer=E.fromstring(z.read('word/footer1.xml'))
    layout={'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'page':{'width':595.3,'height':841.9,'left':35.45,'right':35.45,'top':34.6,'bottom':28.35},'blocks':blocks,'footer':[para(p) for p in footer.findall('w:p',ns)]}
    (dest/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2),encoding='utf-8')
    (dest/'logo.png').write_bytes(z.read('word/media/image1.png'))
shutil.copyfile(source,dest/source.name)
print(layout['sha256'])
