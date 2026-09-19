import Link from 'next/link';
import {commercialPartners} from '@/lib/crm/commercial-read';
import {listCatalog} from '@/lib/crm/repository';
import {listSalesOrders} from '@/lib/crm/sales-orders';
import {listSamples,sampleWarehouseOptions,type SampleView} from '@/lib/crm/samples';
import type {Principal} from '@/lib/crm/types';
import {SampleActionForm,SampleCreateForm,SampleIssueForm} from './SampleForms';

const statusLabel:Record<string,string>={REQUESTED:'Chờ kho xuất',SENT:'Đã xuất mẫu',RECEIVED:'Đã nhận',FEEDBACK:'Đã phản hồi',CONVERTED:'Đã phát sinh đơn',CLOSED:'Đã đóng'};
function Header({title,description}:{title:string;description:string}){return <header className="portal-page-header"><div><h1>{title}</h1><p>{description}</p></div></header>;}

export async function SamplePage({user,id}:{user:Principal;id?:string}){
 const creator=user.area==='crm'&&['ADMIN','MANAGER','SALES'].includes(user.role),issuer=user.area==='crm'&&['ADMIN','MANAGER','WAREHOUSE'].includes(user.role),progress=user.area==='crm'&&['ADMIN','MANAGER','SALES'].includes(user.role);
 const [samples,warehouses,products,partners,orders]=await Promise.all([listSamples(user),sampleWarehouseOptions(user),creator?listCatalog(user):Promise.resolve([]),creator?commercialPartners(user):Promise.resolve([]),progress?listSalesOrders(user):Promise.resolve([])]);
 if(id){const sample=samples.find(row=>row.id===id);if(!sample)return <p role="status">Phiếu mẫu không còn trong phạm vi được cấp.</p>;return <SampleDetail sample={sample} issuer={issuer} progress={progress} orders={orders}/>;}
 return <><Header title="Hàng mẫu và chuyển đổi" description="Theo dõi người nhận, SKU, xuất kho thực tế, phản hồi và đơn bán phát sinh từ mẫu."/>
  {creator&&<details className="work-disclosure"><summary>Lập yêu cầu gửi hàng mẫu</summary><SampleCreateForm owner={user.id} partners={partners} products={products} warehouses={warehouses}/></details>}
  <section className="work-section"><h2>Phiếu hàng mẫu</h2>{samples.length?<div className="work-table-wrap" tabIndex={0} aria-label="Danh sách phiếu hàng mẫu"><table className="work-table"><thead><tr><th>Phiếu / đối tác</th><th>Người nhận</th><th>Kho dự kiến</th><th>SKU</th><th>Tiến độ</th><th>Chứng từ / đơn</th></tr></thead><tbody>{samples.map(sample=><tr key={sample.id}><td><Link href={'/crm/samples/'+sample.id}>{sample.code}</Link><br/>{sample.organization_name}</td><td>{sample.recipient_name}<br/>{sample.recipient_phone||'Chưa có số điện thoại'}</td><td>{sample.warehouse_code} · {sample.warehouse_name}</td><td>{sample.lines.map(line=>`${line.sku}: ${line.quantity} ${line.stock_unit}`).join(', ')}</td><td>{statusLabel[sample.status]??sample.status}<br/>Phiên bản {sample.version}</td><td>{sample.inventory_document_code??'Chưa xuất'}<br/>{sample.sales_order_code??'Chưa liên kết đơn'}</td></tr>)}</tbody></table></div>:<p className="crm-status-note">Chưa có phiếu hàng mẫu trong phạm vi được cấp. Hệ thống không tạo dữ liệu mẫu giả.</p>}</section>
 </>;
}

function SampleDetail({sample,issuer,progress,orders}:{sample:SampleView;issuer:boolean;progress:boolean;orders:Awaited<ReturnType<typeof listSalesOrders>>}){return <><Link className="work-back" href="/crm/samples">← Danh sách hàng mẫu</Link><Header title={sample.code} description={`${sample.organization_name} · ${statusLabel[sample.status]??sample.status} · phiên bản ${sample.version}`}/>
 <section className="work-section"><h2>Người nhận và mục đích</h2><dl className="crm-readonly"><dt>Người nhận</dt><dd>{sample.recipient_name}</dd><dt>Điện thoại</dt><dd>{sample.recipient_phone||'Chưa ghi nhận'}</dd><dt>Kho dự kiến</dt><dd>{sample.warehouse_code} · {sample.warehouse_name}</dd><dt>Mục đích</dt><dd>{sample.purpose}</dd><dt>Đã nhận lúc</dt><dd>{sample.received_at?new Date(sample.received_at).toLocaleString('vi-VN'):'Chưa xác nhận'}</dd><dt>Phản hồi</dt><dd>{sample.feedback_text||'Chưa ghi nhận'}{sample.feedback_outcome?' · '+sample.feedback_outcome:''}</dd><dt>Chứng từ kho</dt><dd>{sample.inventory_document_code??'Chưa xuất kho'}</dd><dt>Đơn chuyển đổi</dt><dd>{sample.sales_order_code?<Link href={'/crm/sales/'+sample.sales_order_id}>{sample.sales_order_code}</Link>:'Chưa liên kết'}</dd></dl></section>
 <section className="work-section"><h2>SKU và lô thực xuất</h2><div className="work-table-wrap" tabIndex={0}><table className="work-table"><thead><tr><th>SKU</th><th>Yêu cầu</th><th>Phân bổ FEFO</th></tr></thead><tbody>{sample.lines.map(line=><tr key={line.id}><td>{line.sku} · {line.product_name}</td><td>{line.quantity} {line.stock_unit}</td><td>{line.allocations.length?line.allocations.map(a=><span key={a.movement_id}>{a.location_code}/{a.lot_code}: {a.quantity}<br/></span>):'Chưa xuất'}</td></tr>)}</tbody></table></div></section>
 {issuer&&sample.status==='REQUESTED'&&<section className="work-section"><h2>Xuất kho hàng mẫu</h2><SampleIssueForm id={sample.id} version={sample.version}/></section>}
 {progress&&<section className="work-section"><h2>Cập nhật tiến độ</h2><SampleActionForm id={sample.id} version={sample.version} status={sample.status} organizationId={sample.organization_id} orders={orders}/></section>}
 <section className="work-section"><h2>Lịch sử bất biến</h2>{sample.events.length?<ol className="work-timeline">{sample.events.map(event=><li key={event.id}><strong>{event.action}</strong> · {event.actor_name} · {new Date(event.created_at).toLocaleString('vi-VN')}<br/><span>{event.reason}</span></li>)}</ol>:<p>Chưa có sự kiện.</p>}</section>
 </>}
