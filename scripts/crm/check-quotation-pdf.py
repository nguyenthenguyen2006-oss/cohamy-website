import json
from pathlib import Path
from pypdf import PdfReader
def vnd(value):
    return format(int(value),',').replace(',','.')
cases=[]
for stem in ['quotation-qa-sent','quotation-qa-multipage']:
    source=json.loads(Path('.local/pdfs/'+stem+'-source.json').read_text(encoding='utf-8'))
    reader=PdfReader('.local/pdfs/'+stem+'.pdf')
    pages=[p.extract_text() or '' for p in reader.pages]
    text='\n'.join(pages)
    assert len(pages)==1 if stem.endswith('sent') else len(pages)>1
    for i,page in enumerate(pages):
        assert 'Trang '+str(i+1)+' / '+str(len(pages)) in page
        assert len(page.strip())>100, 'Blank or footer-only page'
        assert '\ufffd' not in page, 'Lost Vietnamese glyph'
    snap=source['version']['snapshot']
    assert 'Nguyễn Thị Ánh Đào' in text
    assert 'Tổng thanh toán: '+vnd(snap['calculation']['total'])+' VND' in text
    assert 'Số lượng' in text and 'Giá / đơn vị gốc' in text
    assert source['head']['code'] in text
    assert sum(line.strip()=='QA_PRICE_A' for line in text.splitlines())==len(snap['calculation']['lines']), 'Missing/repeated SKU rows'
    cases.append({'name':stem+' all pages text, Vietnamese, exact totals, row count and footer integrity','status':'PASS','pages':len(pages)})
Path('docs/crm/test-results/quotation-pdf-local.json').write_text(json.dumps({'environment':'LOCAL actual PDFKit output, Poppler rendering and pypdf text; fictitious immutable source/stress fixture','status':'TEXT_PASS_VISUAL_PENDING','cases':cases},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(cases,ensure_ascii=True))
