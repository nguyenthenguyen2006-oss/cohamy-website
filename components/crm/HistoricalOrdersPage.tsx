import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { historicalInvoice, listHistoricalInvoices } from '@/lib/crm/historical-orders';
import { CrmError } from '@/lib/crm/permissions';
import type { Principal } from '@/lib/crm/types';
import './historical-orders.css';

const root='/crm/historical-orders';
const money=(value:number|string)=>Number(value).toLocaleString('vi-VN')+'đ';
const date=(value:string)=>value.slice(0,10).split('-').reverse().join('/');
export async function HistoricalOrdersPage({user,id,query}:{user:Principal;id?:string;query:Record<string,string|string[]|undefined>}) {
  const header=<header className="portal-page-header"><div><h1>Đơn hàng cũ</h1><p>Hóa đơn trước khi dùng CRM. Lưu để tra cứu; không ghi lại tồn kho, công nợ hoặc thu chi hiện tại.</p></div></header>;
  if (id) {
    const row=await historicalInvoice(user,id).catch(error=>{if(error instanceof CrmError && error.status===404)notFound();throw error;});
    const s=row.snapshot,source='/api/crm/historical-orders/'+row.id;
    return <div className="historical-orders-page"><Link className="work-back" href={root}>← Đơn hàng cũ</Link>{header}
      <section className="work-section"><h2>Hóa đơn {s.series} · Số {s.number}</h2>
        <dl className="crm-readonly"><dt>Ngày hóa đơn</dt><dd>{date(s.date)}</dd><dt>Kho</dt><dd>{row.warehouse_name}</dd><dt>Khách hàng</dt><dd>{s.buyerName}</dd>{s.buyerContact&&<><dt>Người mua hàng</dt><dd>{s.buyerContact}</dd></>}<dt>Mã số thuế khách</dt><dd>{s.buyerTaxId}</dd><dt>Địa chỉ</dt><dd>{s.buyerAddress}</dd><dt>Đơn vị bán</dt><dd>{s.sellerName} · MST {s.sellerTaxId}</dd><dt>Thanh toán</dt><dd>Đã thanh toán đủ — do người dùng xác nhận khi nhập. Chưa có ngày thu tiền riêng.</dd></dl>
        <div className="crm-table-wrap" role="region" aria-label="Chi tiết mặt hàng" tabIndex={0}><table className="data-table"><caption className="sr-only">Mặt hàng theo hóa đơn gốc</caption><thead><tr><th>STT</th><th>Mặt hàng</th><th>ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{s.lines.map((line,index)=><tr key={index}><td>{index+1}</td><td>{line.name}</td><td>{line.unit}</td><td>{line.quantity.toLocaleString('vi-VN')}</td><td>{money(line.unitPrice)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></div>
        <dl className="crm-readonly historical-totals"><dt>Cộng tiền hàng</dt><dd>{money(s.subtotal)}</dd><dt>Thuế GTGT ({s.vatRatePercent}%)</dt><dd>{money(s.vatAmount)}</dd><dt>Tổng thanh toán</dt><dd><strong>{money(s.total)}</strong></dd><dt>Đã thanh toán</dt><dd>{money(s.paidAmount)}</dd><dt>Còn nợ</dt><dd>0đ</dd></dl>
        {s.note&&<p className="crm-status-note">{s.note}</p>}
      </section>
      <section className="work-section"><h2>Ảnh hóa đơn gốc</h2><p className="work-help">Giữ nguyên ảnh đã cung cấp để đối chiếu số liệu. Đây là ảnh hóa đơn, chưa phải tệp XML hóa đơn điện tử.</p><div className="upgrade-actions"><a href={source} className="button button--secondary">Tải ảnh gốc</a><a href={source+'?inline=1'} target="_blank" rel="noopener noreferrer" className="button button--secondary">Mở ảnh trong tab mới</a></div><Image className="historical-invoice-image" src={source+'?inline=1'} alt={'Ảnh hóa đơn '+s.series+' số '+s.number} width={869} height={1884} unoptimized/></section>
    </div>;
  }
  const q=typeof query.q==='string'?query.q:'',page=typeof query.page==='string'?query.page:undefined;
  const data=await listHistoricalInvoices(user,{q,page});
  return <div className="historical-orders-page">{header}<section className="work-section">
    <form className="table-toolbar" method="get"><label>Tìm hóa đơn cũ<input name="q" defaultValue={q} maxLength={120} placeholder="Khách hàng, mã số thuế, số hóa đơn"/></label><button className="button button--secondary">Tìm kiếm</button>{q&&<Link className="button button--secondary" href={root}>Bỏ lọc</Link>}</form>
    <p className="crm-status-note">{data.total} hóa đơn · Tổng giá trị: <strong>{money(data.amount)}</strong> · Đã thanh toán: {money(data.paid)} · Còn nợ: {money(Number(data.amount)-Number(data.paid))}</p>
    {data.items.length?<div className="crm-table-wrap" role="region" aria-label="Danh sách đơn hàng cũ" tabIndex={0}><table className="data-table historical-orders-table"><caption className="sr-only">Hóa đơn cũ trước khi dùng CRM</caption><thead><tr><th>Hóa đơn</th><th>Ngày</th><th>Khách hàng</th><th>Kho</th><th>Tiền hàng</th><th>Thuế GTGT</th><th>Tổng tiền</th><th>Thanh toán</th><th>Ảnh nguồn</th></tr></thead><tbody>{data.items.map(row=><tr key={row.id}><td><Link href={root+'/'+row.id}>{row.snapshot.series} · {row.snapshot.number}</Link></td><td>{date(row.snapshot.date)}</td><td><Link href={root+'/'+row.id}>{row.snapshot.buyerName}</Link><p className="work-help">{row.snapshot.buyerTaxId}</p></td><td>{row.warehouse_name}</td><td>{money(row.snapshot.subtotal)}</td><td>{money(row.snapshot.vatAmount)}</td><td>{money(row.snapshot.total)}</td><td>Đã thanh toán đủ</td><td><a href={'/api/crm/historical-orders/'+row.id}>Tải ảnh</a></td></tr>)}</tbody></table></div>:<p role="status" className="crm-status-note">Chưa có hóa đơn cũ trong phạm vi kho hoặc từ khóa này.</p>}
    {data.total>data.pageSize&&<nav className="upgrade-actions" aria-label="Phân trang đơn hàng cũ">{data.page>1&&<Link href={'?'+new URLSearchParams({q,page:String(data.page-1)})}>Trang trước</Link>}<span>Trang {data.page} / {Math.ceil(data.total/data.pageSize)}</span>{data.page*data.pageSize<data.total&&<Link href={'?'+new URLSearchParams({q,page:String(data.page+1)})}>Trang sau</Link>}</nav>}
  </section></div>;
}
