import Link from 'next/link';
import {commercialTodoRequests} from '@/lib/crm/order-requests';
import {listSalesOrders} from '@/lib/crm/sales-orders';
import {notifications} from '@/lib/crm/workspace';
import type {Principal} from '@/lib/crm/types';
export async function DealerCommercePanel({user}:{user:Principal}){
 const [todo,orders,news]=await Promise.all([commercialTodoRequests(user),listSalesOrders(user),notifications(user,'UNREAD')]);
 const status:Record<string,string>={DRAFT:'Kiểm tra bản nháp và đề nghị',PENDING_OWNER:'Duyệt đúng bản nhân viên đề nghị',READY:'Kiểm tra và gửi đến Cohamy',REJECTED:'Xem lý do và sửa bản nháp',PENDING_APPROVAL:'Chờ Cohamy xác nhận',CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy'};
 return <><section className="work-section"><div className="work-section-title"><h2>Việc mua hàng cần xử lý</h2><Link href="/portal/requests">Mở các đề nghị →</Link></div>{todo.length?<ul className="work-task-list">{todo.map(r=><li key={r.id}><div><Link href={'/portal/requests/'+r.id}>{r.code}</Link><p>{status[r.status]}</p></div></li>)}</ul>:<p>Không có đề nghị cần bạn xử lý.</p>}</section><section className="work-section"><div className="work-section-title"><h2>Đơn mua gần đây</h2><Link href="/portal/orders">Mở đơn của tôi →</Link></div>{orders.length?<ul className="work-task-list">{orders.slice(0,5).map(o=><li key={o.id}><div><Link href={'/portal/orders/'+o.id}>{o.code}</Link><p>{status[o.status]??'Đã từ chối'} · Mở đơn để xem giao hàng và thanh toán.</p></div></li>)}</ul>:<p>Chưa có đơn mua đã gửi đến Cohamy.</p>}</section><section className="work-section"><div className="work-section-title"><h2>Thông báo chưa đọc</h2><Link href="/portal/notifications">Mở thông báo →</Link></div>{news.length?<ul className="work-task-list">{news.slice(0,5).map(n=><li key={n.id}><p>{n.message}</p><Link href="/portal/notifications">Xem thông báo</Link></li>)}</ul>:<p>Không có thông báo chưa đọc đang đến hạn.</p>}</section></>;
}
