import json
from pathlib import Path
from pypdf import PdfReader
source=json.loads(Path('.local/pdfs/quotation-built-runtime-source.json').read_text(encoding='utf-8'))
pages=[page.extract_text() or '' for page in PdfReader('.local/pdfs/quotation-built-runtime.pdf').pages]
text='\n'.join(pages)
assert source['head']['code'] in text
assert '\ufffd' not in text
assert 'Giá / đơn vị gốc' in text
assert 'Tổng thanh toán: '+format(int(source['version']['snapshot']['calculation']['total']),',').replace(',','.')+' VND' in text
for i,page in enumerate(pages):
    assert len(page.strip())>100
    assert 'Trang '+str(i+1)+' / '+str(len(pages)) in page
for line in source['version']['snapshot']['calculation']['lines']:
    assert line['sku'] in text
print('PASS actual built runtime PDF text/source/footer/Vietnamese glyphs: '+str(len(pages))+' pages')
