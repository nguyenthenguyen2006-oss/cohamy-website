import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pageUser } from "@/lib/crm/http";
import { can, CrmError } from "@/lib/crm/permissions";
import { visibleModules } from "@/lib/crm/modules";
import { getOrganization, listAccounts, listCatalog, listOrganizationOptions, listOrganizations, listWarehouses } from "@/lib/crm/repository";
import { roleLabels, type Area, type Principal } from "@/lib/crm/types";
import { AccountToggle, RecordForm } from "./RecordForm";
import { EntityWork, OrdersPage, TasksPage, WarehouseAssignment, PartnerDuplicates, CatalogDetail, ReportsPage } from './WorkPages';
import { AccountTools, PasswordForm } from './WorkForms';

function Empty({children}:{children:React.ReactNode}) {return <div className="crm-status-note" role="status">{children}</div>;}
function Header({title,description}:{title:string;description:string}) {return <header className="portal-page-header"><div><h1>{title}</h1><p>{description}</p></div></header>;}
export function Profile({user}:{user:Principal}) {return <><Header title="Hồ sơ và phiên đăng nhập" description="Quyền và tổ chức dưới đây lấy từ phiên database, không lấy từ trình duyệt."/><dl className="crm-readonly"><dt>Tài khoản</dt><dd>{user.displayName} · {user.email}</dd><dt>Vai trò</dt><dd>{roleLabels[user.role]}</dd><dt>Tổ chức</dt><dd>{user.organizationName}</dd><dt>Phạm vi truy cập</dt><dd>{user.area==="portal"?"Tổ chức của bạn. Không truy cập dữ liệu đại lý khác.":"Theo vai trò và đối tác/kho được giao."}</dd></dl></>;}
export async function CrmModulePage({area,segments,query}:{area:Area;segments:string[];query:Record<string,string|string[]|undefined>}) {
  const user=await pageUser(area);const [slug,id]=segments;
  if(segments.length>2)notFound();
  if(slug==="profile"&&!id)return <><Profile user={user}/><section className="work-section"><h2>Bảo mật tài khoản</h2><PasswordForm/></section></>;
  if(slug==='partners'&&id){const partner=await getOrganization(user,id);redirect(`/${area}/${partner.kind==='DEALER'?'dealers':'customers'}/${id}`);}
  const selectedModule=visibleModules(user).find(item=>item.id===slug);
  if(!selectedModule)return <><Header title="Không có quyền truy cập" description="Tài khoản của bạn không được cấp quyền mở phân hệ này."/><Link className="button button--secondary" href={`/${area}`}>Về trang chủ</Link></>;
  const q=typeof query.q==="string"?query.q:"";const page=typeof query.page==="string"?Math.min(100000,Math.max(1,Math.floor(Number(query.page)||1))):1;
  const root=`/${area}/${slug}`;
  const workQuery=Object.fromEntries(Object.entries(query).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
  if(slug==='orders'&&area==='crm')return <OrdersPage user={user} id={id} query={workQuery}/>;
  if(slug==='tasks'&&area==='crm'&&!id)return <TasksPage user={user} query={workQuery}/>;
  if(slug==='goods'&&id)return <CatalogDetail user={user} id={id}/>;
  if(slug==='reports'&&area==='crm'&&!id)return <ReportsPage user={user}/>;
  if(area==="crm"&&["customers","dealers"].includes(slug)) {
    const kind=slug==="customers"?"CUSTOMER":"DEALER";
    if(id==="new") {if(!can(user,"partners.write"))notFound();return <><Header title={`Thêm ${kind==="CUSTOMER"?"khách hàng":"đại lý"}`} description="Hồ sơ chưa tự tạo khoản nợ hoặc tồn kho. Một đại lý có thể tham gia mua đứt và ký gửi."/><RecordForm resource="partners" kind={kind}/></>;}
    if(id) {
      const record=await getOrganization(user,id).catch(error=>{if(error instanceof CrmError&&error.status===404)notFound();throw error;});
      if(record.kind!==kind)notFound();
      return <><Link className="work-back" href={root}>← Danh sách hồ sơ</Link><Header title={record.name} description={`Mã ${record.code} · phiên bản ${record.version}`}/>{can(user,"partners.write")?<RecordForm resource="partners" record={record}/>:<dl className="crm-readonly"><dt>Điện thoại</dt><dd>{record.phone||"Chưa ghi nhận"}</dd><dt>Email</dt><dd>{record.email||"Chưa ghi nhận"}</dd><dt>Địa chỉ</dt><dd>{record.address||"Chưa ghi nhận"}</dd></dl>}<PartnerDuplicates user={user} id={id}/><EntityWork user={user} type="partner" id={id}/></>;
    }
    const collection=await listOrganizations(user,{kind,q,page});
    const href=(next:number)=>`${root}?${new URLSearchParams({q,page:String(next)})}`;
    return <><Header title={`Quản lý ${kind==="CUSTOMER"?"khách hàng":"đại lý"}`} description={`Tổng số: ${collection.total} hồ sơ trong phạm vi quyền.`}/>
      <form className="table-toolbar" method="get"><div className="field"><label htmlFor="partner-search">Tên, mã, điện thoại hoặc email</label><input id="partner-search" name="q" defaultValue={q} maxLength={120}/></div><button className="button button--primary">Tìm kiếm</button>{can(user,"partners.write")&&<Link className="button button--secondary" href={`${root}/new`}>Thêm mới</Link>}</form>
      {!collection.items.length?<Empty>Không có hồ sơ phù hợp. Hệ thống không tạo dữ liệu kinh doanh mẫu.</Empty>:<div className="crm-table-wrap" role="region" aria-label="Danh sách hồ sơ" tabIndex={0}><table className="data-table"><caption className="sr-only">Danh sách hồ sơ</caption><thead><tr><th scope="col">Hồ sơ</th><th scope="col">Điện thoại</th><th scope="col">Email</th><th scope="col">Trạng thái</th><th scope="col">Tạo lúc</th></tr></thead><tbody>{collection.items.map(item=><tr key={item.id}><td><Link className="table-primary" href={`${root}/${item.id}`}><strong>{item.name}</strong><span>{item.code}</span></Link></td><td>{item.phone||"Chưa ghi nhận"}</td><td>{item.email||"Chưa ghi nhận"}</td><td>{item.active?"Hoạt động":"Đã khóa"}</td><td>{new Date(item.created_at).toLocaleDateString("vi-VN")}</td></tr>)}</tbody></table></div>}
      <footer className="table-footer"><span>Trang {collection.page} · {collection.total} hồ sơ</span><nav aria-label="Phân trang">{page>1&&<Link className="button button--secondary" href={href(page-1)}>Trang trước</Link>}{page*20<collection.total&&<Link className="button button--secondary" href={href(page+1)}>Trang sau</Link>}</nav></footer></>;
  }
  if(slug==="goods"&&!id) {
    const products=await listCatalog(user,q);
    return <><Header title={area==="crm"?"Danh mục hàng hóa":"Danh mục đặt hàng"} description="Ánh xạ danh mục website. SKU tạm WEB-*; chưa có quy đổi đơn vị, lô hoặc giá đại lý đã duyệt."/><form className="table-toolbar" method="get"><div className="field"><label htmlFor="catalog-search">Tên hoặc SKU</label><input id="catalog-search" name="q" defaultValue={q}/></div><button className="button button--primary">Tìm kiếm</button></form>{area==="portal"&&<Empty>Chưa mở đặt hàng đại lý: cần bảng giá, kỳ hạn và hạn mức đã duyệt.</Empty>}{products.length?<div className="crm-table-wrap" role="region" aria-label="Danh mục website" tabIndex={0}><table className="data-table"><caption className="sr-only">Danh mục website</caption><thead><tr><th scope="col">SKU ánh xạ</th><th scope="col">Tên</th><th scope="col">Quy cách website</th>{area==="crm"&&<th scope="col">Giá niêm yết website</th>}<th scope="col">Ánh xạ</th></tr></thead><tbody>{products.map(item=><tr key={item.id}><td><Link href={`${root}/${item.id}`}>{item.sku}</Link></td><td>{item.name}</td><td>{item.weight_label}</td>{area==="crm"&&<td>{BigInt(item.retail_price).toLocaleString("vi-VN")} đ</td>}<td>Danh mục, chưa xác nhận kho</td></tr>)}</tbody></table></div>:<Empty>Chưa có hàng hóa phù hợp. Chạy lệnh nhập danh mục website sau migration.</Empty>}</>;
  }
  if(slug==="inventory") {
    if(id==="new"&&can(user,"warehouses.write")) {const orgs=await listOrganizationOptions(user);return <><Header title="Thêm kho" description="Kho thuộc tổ chức. Tạo kho không tăng tồn; chỉ chứng từ thực nhận được xác nhận mới tăng tồn."/><RecordForm resource="warehouses" organizations={orgs}/></>;}
    if(id)notFound();const warehouses=await listWarehouses(user);
    return <><Header title={selectedModule.label} description="Danh mục kho theo phạm vi quyền. Sổ biến động, lô, hạn dùng và tồn đầu kỳ chưa triển khai."/>{can(user,"warehouses.write")&&<Link className="button button--primary" href={`${root}/new`}>Thêm kho</Link>}{warehouses.length?<div className="crm-table-wrap" role="region" aria-label="Kho được cấp quyền" tabIndex={0}><table className="data-table"><caption className="sr-only">Danh mục kho</caption><thead><tr><th scope="col">Mã</th><th scope="col">Kho</th><th scope="col">Tổ chức sở hữu</th><th scope="col">Trạng thái</th></tr></thead><tbody>{warehouses.map(item=><tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.organization_name}</td><td>{item.active?"Hoạt động":"Đã khóa"}<WarehouseAssignment user={user} id={item.id}/></td></tr>)}</tbody></table></div>:<Empty>Chưa có kho trong phạm vi quyền. Không suy diễn tồn từ lượng đã giao.</Empty>}</>;
  }
  if(slug==="accounts"&&area==="crm") {
    if(id==="new") {const orgs=await listOrganizationOptions(user);return <><Header title="Cấp tài khoản" description="Tài khoản Cohamy độc lập CMS. Vai trò nội bộ chỉ thuộc Cohamy; chủ/nhân viên đại lý thuộc đại lý."/><RecordForm resource="accounts" organizations={orgs}/></>;}
    const accounts=await listAccounts(user);if(id){const account=accounts.find(a=>a.id===id);if(!account)notFound();return <><Link className="work-back" href="/crm/accounts">← Danh sách tài khoản</Link><Header title={account.display_name} description={account.email+" · "+account.organization_name}/><section className="work-section"><h2>Quyền và bảo mật</h2><AccountTools id={account.id} role={account.role} self={account.id===user.membershipId}/></section></>;}
    return <><Header title="Tài khoản và quyền" description="Cấp tài khoản, phân vai trò và quản lý quyền truy cập của đội ngũ."/><Link href={`${root}/new`} className="button button--primary">Cấp tài khoản</Link><div className="crm-table-wrap" role="region" aria-label="Tài khoản CRM" tabIndex={0}><table className="data-table"><caption className="sr-only">Tài khoản CRM</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Email</th><th scope="col">Vai trò</th><th scope="col">Tổ chức</th><th scope="col">Truy cập</th></tr></thead><tbody>{accounts.map(item=><tr key={item.id}><td>{item.display_name}</td><td>{item.email}</td><td>{roleLabels[item.role as keyof typeof roleLabels]}</td><td>{item.organization_name}</td><td><AccountToggle id={item.id} active={item.active} self={item.id===user.membershipId}/><Link className="work-account-link" href={"/crm/accounts/"+item.id}>Quyền và bảo mật</Link></td></tr>)}</tbody></table></div></>;
  }
  if(id)notFound();
  return <><Header title={selectedModule.label} description="Phân hệ chưa triển khai giao dịch. Không có số dư hoặc chứng từ kinh doanh để báo cáo."/><Empty>Chưa mở ghi sổ. Cohamy cần xác nhận mốc chuyển sở hữu và ghi nợ mua đứt, giá đối soát ký gửi, bảng giá/hạn mức/kỳ hạn và phạm vi kho trước khi triển khai luồng này.</Empty><Link href={`/${area}`} className="button button--secondary">Về trang chủ CRM</Link></>;
}
