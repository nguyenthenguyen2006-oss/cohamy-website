import Image from 'next/image';
import {notFound} from 'next/navigation';
import {listOnlineOrders,getOnlineOrder} from '@/lib/crm/online-orders';
import {CrmError,isWarehouseRole} from '@/lib/crm/permissions';
import type {Principal} from '@/lib/crm/types';
import {CrmNavLink as Link} from './CrmNavLink';
import {OnlineOrderActions} from './OnlineOrderForms';
import styles from './OnlineOrders.module.css';

const root='/crm/online-customers';
const orderLabels:Record<string,string>={PENDING_REVIEW:'Mới nhận',IN_PROGRESS:'Đang xử lý',READY:'Đã chốt yêu cầu',REJECTED:'Từ chối',CANCELLED:'Đã hủy'};
const dispatchLabels:Record<string,string>={UNASSIGNED:'Chưa điều phối',ASSIGNED:'Đã giao về kho',ACCEPTED:'Kho đã tiếp nhận'};
const paymentLabels:Record<string,string>={bank:'Chuyển khoản',cod:'Thanh toán khi nhận hàng',momo:'MoMo'};
const mailLabels:Record<string,string>={PENDING:'Chờ gửi',SENDING:'Đang gửi',RETRY:'Chờ thử lại',ACCEPTED:'Nhà cung cấp đã nhận',DELIVERED:'Đã giao tới máy chủ thư',FAILED:'Gửi thất bại',DEFERRED:'Tạm hoãn',UNKNOWN:'Chưa xác định',BOUNCED:'Bị trả lại',PROVIDER_DEFERRED:'Nhà cung cấp tạm hoãn',SIMULATED:'Mô phỏng',SUPERSEDED:'Đã thay thế'};
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}):'—';
const money=(value:string)=>BigInt(value).toLocaleString('vi-VN')+' đ';
const href=(path:string,query:Record<string,string>,patch:Record<string,string>)=>path+'?'+new URLSearchParams({...query,...patch});

type List=Awaited<ReturnType<typeof listOnlineOrders>>;
type Row=List['items'][number];
type Detail=Awaited<ReturnType<typeof getOnlineOrder>>;

function DispatchState({status}:{status:string}){
  return <span className={`${styles.state} ${status==='ACCEPTED'?styles.accepted:status==='ASSIGNED'?styles.assigned:''}`}>{dispatchLabels[status]??'Chưa xác định'}</span>;
}

function Pagination({path,query,param='page',page,pageSize,total,label}:{path:string;query:Record<string,string>;param?:string;page:number;pageSize:number;total:number;label:string}){
  return <footer className="table-footer"><span>{total} {label} · Trang {page}/{Math.max(1,Math.ceil(total/pageSize))}</span><nav className="work-actions" aria-label={`Chuyển trang ${label}`}>
    {page>1&&<Link prefetch={false} href={href(path,query,{[param]:String(page-1)})}>Trang trước</Link>}
    {page*pageSize<total&&<Link prefetch={false} href={href(path,query,{[param]:String(page+1)})}>Trang sau</Link>}
  </nav></footer>;
}

function OrderList({data,query}:{data:List;query:Record<string,string>}){
  return <>
    <form className="work-filter" method="get" aria-label="Lọc đơn bán online">
      <label className="work-search">Tìm đơn / khách hàng<input name="q" defaultValue={query.q} maxLength={120} placeholder="Mã đơn, tên, điện thoại, email"/></label>
      <label>Điều phối<select name="dispatchStatus" defaultValue={query.dispatchStatus??''}><option value="">Tất cả</option>{Object.entries(dispatchLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Kho<select name="warehouseId" defaultValue={query.warehouseId??''}><option value="">Tất cả kho trong phạm vi</option>{data.warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
      <label>Trạng thái yêu cầu<select name="status" defaultValue={query.status??''}><option value="">Tất cả</option>{Object.entries(orderLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Từ ngày<input type="date" name="from" defaultValue={query.from}/></label><label>Đến ngày<input type="date" name="to" defaultValue={query.to}/></label>
      <button className="button button--primary" type="submit">Lọc đơn</button><Link className="button button--secondary" href={root}>Xóa bộ lọc</Link>
    </form>
    <section className="work-section">
      <div className={styles.table} role="region" aria-label="Danh sách đơn bán online" tabIndex={0}>
        <table className={`data-table ${styles.ordersTable}`}><colgroup><col style={{width:190}}/><col style={{width:240}}/><col style={{width:200}}/><col style={{width:240}}/><col style={{width:140}}/><col style={{width:155}}/><col style={{width:190}}/><col style={{width:155}}/><col style={{width:135}}/><col style={{width:100}}/></colgroup><thead><tr><th>Mã đơn / Ngày đặt</th><th>Khách hàng</th><th>Giao đến</th><th>Sản phẩm</th><th className={styles.number}>Số lượng (Gói)</th><th className={styles.number}>Tiền hàng</th><th>Kho</th><th>Điều phối</th><th>Yêu cầu</th><th>Chi tiết</th></tr></thead>
          <tbody>{data.items.map(order=><tr key={order.id}>
            <td><Link className="table-primary" prefetch={false} href={`${root}/${order.id}`}>{order.code}</Link><small>{date(order.createdAt)}</small></td>
            <td className={styles.contact}><strong>{order.contact.fullName}</strong><small>{order.contact.phone}</small><small>{order.contact.email}</small></td>
            <td className={styles.contact}>{order.contact.city}<small>{[order.contact.ward,order.contact.district].filter(Boolean).join(', ')}</small></td>
            <td className={styles.productSummary}>{order.lines.slice(0,2).map(line=>line.name).join(' · ')}{order.lines.length>2&&<small>Và {order.lines.length-2} sản phẩm khác</small>}</td>
            <td className={styles.number}>{order.lines.reduce((sum,line)=>sum+line.quantity,0)}</td><td className={styles.number}>{money(order.subtotal)}</td>
            <td>{order.dispatch.warehouseName??'Chưa giao kho'}</td><td><DispatchState status={order.dispatch.status}/></td><td>{orderLabels[order.status]??'Chưa xác định'}</td>
            <td><Link prefetch={false} href={`${root}/${order.id}`}>Xem đơn</Link></td>
          </tr>)}{!data.items.length&&<tr><td colSpan={10}>Chưa có đơn online phù hợp. Đơn đặt trên website sẽ xuất hiện tại đây theo phạm vi của bạn.</td></tr>}</tbody>
        </table>
      </div>
      <Pagination path={root} query={query} page={data.page} pageSize={data.pageSize} total={data.total} label="đơn"/>
    </section>
  </>;
}

function CustomerFacts({order}:{order:Row}){
  const contact=order.contact;
  return <dl className={styles.facts}>
    <dt>Khách hàng</dt><dd>{contact.fullName}</dd><dt>Điện thoại</dt><dd><a href={`tel:${contact.phone.replace(/[^+0-9]/g,'')}`}>{contact.phone}</a></dd>
    <dt>Email</dt><dd><a href={`mailto:${contact.email}`}>{contact.email}</a></dd>
    <dt>Giao đến</dt><dd><address className={styles.prewrap}>{[contact.address,contact.ward,contact.district,contact.city].filter(Boolean).join(', ')}</address></dd>
    <dt>Lời nhắn</dt><dd className={styles.prewrap}>{contact.note||'Không có lời nhắn'}</dd>
    <dt>Cách thanh toán đề nghị</dt><dd>{paymentLabels[order.paymentRequested]??'Chưa xác định'}</dd><dt>Thanh toán</dt><dd>{order.paid?'Đã ghi nhận thanh toán':'Chưa ghi nhận thanh toán'}</dd>
  </dl>;
}

function HandoverFacts({order}:{order:Row}){
  return <dl className={styles.facts}>
    <dt>Điều phối</dt><dd><DispatchState status={order.dispatch.status}/></dd><dt>Kho nhận</dt><dd>{order.dispatch.warehouseName??'Chưa giao kho'}</dd>
    <dt>Giao về kho lúc</dt><dd>{date(order.dispatch.assignedAt)}</dd><dt>Kho tiếp nhận lúc</dt><dd>{date(order.dispatch.acceptedAt)}</dd>
    <dt>Ghi chú bàn giao</dt><dd className={styles.prewrap}>{order.dispatch.note||'Chưa có ghi chú'}</dd>
    {order.linkedSalesOrder&&<><dt>Đơn bán liên quan</dt><dd>{order.linkedSalesOrder.code}</dd></>}
  </dl>;
}

function OrderLines({order}:{order:Row}){
  const vatKnown=order.lines.length>0&&order.lines.every(line=>line.vatRate!==undefined);
  return <section className="work-section"><h2>Sản phẩm khách đặt</h2><div className={`${styles.table} ${styles.lines}`} role="region" aria-label="Sản phẩm trong đơn online" tabIndex={0}>
    <table className="data-table"><thead><tr><th>Sản phẩm</th><th>Đơn vị</th><th className={styles.number}>Số lượng</th><th className={styles.number}>Đơn giá</th><th className={styles.number}>Thành tiền</th></tr></thead>
      <tbody>{order.lines.map((line,index)=><tr key={`${line.websiteId}-${index}`}><td><div className={styles.productCell}>{line.image&&<Image src={line.image} alt="" width={52} height={52} className={styles.productImage}/>}<span>{line.name}</span></div></td><td>{line.unit}</td><td className={styles.number}>{line.quantity}</td><td className={styles.number}>{money(line.unitPrice)}</td><td className={styles.number}>{money(line.lineTotal)}</td></tr>)}</tbody>
    </table>
  </div><p className={styles.total}><span>Tổng tiền hàng</span><strong>{money(order.subtotal)}</strong></p><p className="work-help">{vatKnown?'Giá đã gồm VAT theo đơn tại thời điểm đặt.':'Giữ giá tại thời điểm khách đặt.'} Phí giao hàng cần được xác nhận riêng.</p></section>;
}

function History({data,path,query}:{data:Detail['history'];path:string;query:Record<string,string>}){
  return <section className="work-section"><h2>Lịch sử điều phối và tiếp nhận</h2><div className={`${styles.table} ${styles.history}`} role="region" aria-label="Lịch sử điều phối đơn online" tabIndex={0}>
    <table className="data-table"><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Từ kho</th><th>Đến kho</th><th>Người thực hiện</th><th>Lý do / Ghi chú</th></tr></thead><tbody>
      {data.items.map(event=><tr key={event.id}><td>{date(event.createdAt)}</td><td>{event.action==='ACCEPT'?'Kho tiếp nhận':event.fromWarehouseName?'Điều phối lại':'Điều phối về kho'}</td><td>{event.fromWarehouseName||'—'}</td><td>{event.toWarehouseName||'—'}</td><td>{event.actorName||'—'}</td><td className={styles.prewrap}>{event.reason||'—'}</td></tr>)}{!data.items.length&&<tr><td colSpan={6}>Chưa có thao tác điều phối.</td></tr>}
    </tbody></table>
  </div><Pagination path={path} query={query} param="historyPage" page={data.page} pageSize={data.pageSize} total={data.total} label="lượt lịch sử"/></section>;
}

function MailHistory({data,path,query}:{data:Detail['mailJobs'];path:string;query:Record<string,string>}){
  return <section className="work-section"><h2>Thông báo email đơn mới</h2><p className="work-help">“Nhà cung cấp đã nhận” chưa có nghĩa người nhận đã đọc thư.</p><div className={`${styles.table} ${styles.mail}`} role="region" aria-label="Email thông báo đơn online" tabIndex={0}>
    <table className="data-table"><thead><tr><th>Thời gian</th><th>Người nhận</th><th>Trạng thái</th><th>Số lần thử</th><th>Kết quả gần nhất</th></tr></thead><tbody>
      {data.items.map(job=><tr key={job.id}><td>{date(job.createdAt)}<small>Cập nhật {date(job.updatedAt)}</small></td><td className={styles.recipients}><p>TO: {job.recipients.to.join(', ')||'—'}</p>{job.recipients.cc.length>0&&<p>CC: {job.recipients.cc.join(', ')}</p>}{job.recipients.bcc.length>0&&<p>BCC: {job.recipients.bcc.join(', ')}</p>}</td><td>{mailLabels[job.status]??'Chưa xác định'}</td><td>{job.attempts}</td><td className={styles.prewrap}>{job.lastError||'—'}</td></tr>)}{!data.items.length&&<tr><td colSpan={5}>Chưa có lịch sử email của đơn này.</td></tr>}
    </tbody></table>
  </div><Pagination path={path} query={query} param="mailPage" page={data.page} pageSize={data.pageSize} total={data.total} label="thông báo"/></section>;
}

async function scoped<T>(promise:Promise<T>){try{return await promise;}catch(error){if(error instanceof CrmError&&[403,404].includes(error.status))notFound();throw error;}}

export async function OnlineOrdersPage({user,id,query={}}:{user:Principal;id?:string;query?:Record<string,string>}){
  if(user.area!=='crm'||user.role!=='ADMIN'&&!isWarehouseRole(user.role))notFound();
  const admin=user.role==='ADMIN';
  if(!id){const data=await scoped(listOnlineOrders(user,query));return <div className={styles.page} data-online-orders-page><header className="portal-page-header"><div><h1>{admin?'Khách hàng bán online':'Đơn bán online tại kho'}</h1><p>{admin?'Tiếp nhận đơn từ website, kiểm tra thông tin khách và điều phối về kho.':'Các đơn Admin giao về kho bạn phụ trách, chờ kho xác nhận tiếp nhận.'}</p></div></header><OrderList data={data} query={query}/></div>;}
  const data=await scoped(getOnlineOrder(user,id,query)),order=data.order,path=`${root}/${order.id}`;
  return <div className={styles.page} data-online-order-detail={order.id}>
    <Link prefetch={false} className="work-back" href={root}>Quay lại {admin?'khách hàng bán online':'đơn bán online tại kho'}</Link>
    <header className="portal-page-header"><div><h1>{order.code}</h1><p>Khách đặt lúc {date(order.createdAt)} · {orderLabels[order.status]??'Chưa xác định'}</p></div><DispatchState status={order.dispatch.status}/></header>
    <div className={styles.detailGrid}><OrderLines order={order}/><section className="work-section"><h2>Khách hàng và giao nhận</h2><CustomerFacts order={order}/></section></div>
    <section className="work-section"><h2>Điều phối về kho</h2><HandoverFacts order={order}/><p className={styles.note}>Điều phối chưa ghi xuất kho hoặc thu tiền. Xuất kho, giao hàng và đối soát thanh toán tiếp tục theo quy trình chứng từ.</p><OnlineOrderActions id={order.id} version={order.version} warehouseId={order.dispatch.warehouseId} warehouses={data.warehouses} canDispatch={data.canDispatch} canAccept={data.canAccept} dispatchStatus={order.dispatch.status} closed={['REJECTED','CANCELLED'].includes(order.status)} linked={!!order.linkedSalesOrder}/></section>
    <History data={data.history} path={path} query={query}/>{admin&&<MailHistory data={data.mailJobs} path={path} query={query}/>}
  </div>;
}
