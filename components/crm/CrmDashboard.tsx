import Link from 'next/link';
import {visibleModules} from '@/lib/crm/modules';
import type {Principal} from '@/lib/crm/types';
import {can} from '@/lib/crm/permissions';
import {canManageWork,listOrders,listTasks} from '@/lib/crm/work';
import {OrderTable,TaskList,WorkHeader} from './WorkPages';
import {CrmModuleIcon} from './ModuleIcon';
export async function CrmDashboard({user}:{user:Principal}){
 const modules=visibleModules(user),internal=user.area==='crm';
 const orders=internal&&can(user,'orders.read')?await listOrders(user,{status:'PENDING_REVIEW'}):null;
 const tasks=internal&&canManageWork(user)?await listTasks(user):[];
 return <><WorkHeader title={internal?'Bàn làm việc':'Không gian đại lý'} description={internal?`Chào ${user.displayName}. Bắt đầu từ yêu cầu mới và những việc cần theo dõi.`:`${user.organizationName} · Danh mục và thông tin trong phạm vi của bạn.`} action={can(user,'partners.write')?<Link className="button button--primary" href="/crm/customers/new">Thêm khách hàng</Link>:undefined}/>
 {orders&&<section className="work-section work-section--table"><div className="work-section-title"><div><h2>Yêu cầu mới cần tiếp nhận <span className="work-count">{orders.total}</span></h2><p>Phân công người xử lý, liên hệ và xác nhận nhu cầu.</p></div><Link href="/crm/orders">Xem tất cả yêu cầu →</Link></div><OrderTable orders={orders.items.slice(0,5)}/></section>}
 {internal&&canManageWork(user)&&<section className="work-section"><div className="work-section-title"><h2>Việc đang theo dõi</h2><Link href="/crm/tasks">Mở danh sách việc →</Link></div><TaskList tasks={tasks.slice(0,5)}/></section>}
 <section className="work-section"><h2>Truy cập nhanh</h2><div className="work-shortcuts">{modules.filter(m=>m.status==='CONNECTED').map(m=><Link href={`/${user.area}/${m.id}`} key={m.id}><CrmModuleIcon name={m.icon} size={22} aria-hidden/><span>{m.label}</span><span aria-hidden>→</span></Link>)}</div></section>
 <details className="work-disclosure work-roadmap"><summary>Các nghiệp vụ đang hoàn thiện</summary><p>Kho, ký gửi, thu chi và công nợ cần chính sách được chốt trước khi mở ghi sổ.</p><ul>{modules.filter(m=>m.status==='PENDING').map(m=><li key={m.id}><Link href={`/${user.area}/${m.id}`}>{m.label}</Link></li>)}</ul></details></>;
}
