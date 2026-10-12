import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {PriceCalculation} from '../../lib/crm/pricing-model';

/**
 * Meeting 12/10/2026 — cổ đông/đầu mối, hạng thành viên, khuyến mãi 3 cơ chế, chiết khấu tài khoản,
 * chuyển cây duyệt tập trung, chuỗi quản lý, catalog đặt hàng, hoá đơn, báo thiếu, doanh số theo kỳ, KPI.
 */
process.env.BLOG_SOURCE='legacy';
const postgres=process.env.CRM_DATABASE_MODE==='postgres';
if(!postgres){process.env.CRM_DATABASE_MODE='pglite';process.env.CRM_ENVIRONMENT='LOCAL';process.env.CRM_LOCAL_DATA_DIR='.local/crm-qa-meeting-1012-'+randomUUID();}

async function main(){
 const {createQaFixture,qaPassword}=await import('./qa-fixture');
 const {database}=await import('../../lib/crm/db');
 const auth=await import('../../lib/crm/auth');
 const repo=await import('../../lib/crm/repository');
 const prices=await import('../../lib/crm/pricing');
 const fixture=await import('./pricing-fixture');
 const policy=await import('../../lib/crm/order-policy');
 const requests=await import('../../lib/crm/order-requests');
 const orders=await import('../../lib/crm/sales-orders');
 const distribution=await import('../../lib/crm/distribution');
 const inventory=await import('../../lib/crm/inventory');
 const channel=await import('../../lib/crm/channel');
 const reports=await import('../../lib/crm/period-reports');
 const {can}=await import('../../lib/crm/permissions');
 const {installQaRuntime}=await import('./qa-runtime');

 const ids=await createQaFixture();const owner=await database();const close=await installQaRuntime(owner);const db=await database();
 const cases:{name:string;status:'PASS'|'FAIL'}[]=[];
 const test=async(name:string,run:()=>Promise<void>)=>{try{await run();cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){cases.push({name,status:'FAIL'});console.error('FAIL '+name,error);throw error;}};
 const rejects=async(run:()=>Promise<unknown>,code:string)=>{await assert.rejects(run,(e:unknown)=>(e as {code?:string}).code===code,'expected '+code);};

 const admin=(await auth.login('admin@crm-qa.invalid',qaPassword)).user;
 const userA=(await auth.login('a@crm-qa.invalid',qaPassword)).user;
 const userB=(await auth.login('b@crm-qa.invalid',qaPassword)).user;
 const warehouseUser=(await auth.login('warehouse@crm-qa.invalid',qaPassword)).user;
 const cohamy=admin.organizationId;
 await db.query('UPDATE cohamy_crm.warehouses SET organization_id=$1,region=$3 WHERE id=$2',[cohamy,ids.warehouseA,'NORTH']);
 await fixture.createPriceProducts(admin);
 const catalog=await repo.listCatalog(admin);const prodA=catalog.find(p=>p.sku==='QA_PRICE_A')!,prodB=catalog.find(p=>p.sku==='QA_PRICE_B')!;
 const loc=(await inventory.createLocation(admin,{warehouseId:ids.warehouseA,code:'LOC_1012',name:'Kho Hà Nội QA',kind:'PICK',idempotencyKey:randomUUID()})) as {id:string};
 await inventory.postReceipt(warehouseUser,{locationId:loc.id,lines:[{productId:prodA.id,lotCode:'LOT-1012-A',manufacturedOn:'2026-01-01',expiresOn:'2028-01-01',quantity:'1000'},{productId:prodB.id,lotCode:'LOT-1012-B',manufacturedOn:'2026-01-01',expiresOn:'2028-01-01',quantity:'10'}],referenceType:'PO',referenceId:'PO-1012',reason:'QA stock for meeting 12/10',idempotencyKey:randomUUID()});
 const book=await prices.savePriceBook(admin,{version:0,name:'QA meeting 12/10',definition:{...fixture.qaPriceDefinition,lines:[{sku:'QA_PRICE_A',unitPrice:'100000',thresholds:[]},{sku:'QA_PRICE_B',unitPrice:'200000',thresholds:[]}]},idempotencyKey:randomUUID()});
 await prices.publishPriceBook(admin,{id:book.id,version:book.version,versionId:book.versionId,action:'PUBLISH',reason:'QA publish meeting 12/10',idempotencyKey:randomUUID()});
 await policy.saveOrderPolicy(admin,{version:0,definition:{enabled:true,requireOwnerApproval:false,alwaysManagerApproval:false,managerApprovalAmount:null,creditRequiresApproval:false,nonSelfApproval:false,acceptedQuotePrice:'UNTIL_QUOTE_EXPIRY',pendingPrice:'UNTIL_REQUEST_EXPIRY',requiredPartnerFields:[],approvalRoles:['ADMIN','MANAGER'],confirmationRoles:['ADMIN','MANAGER','SALES']},reason:'QA policy meeting 12/10',idempotencyKey:randomUUID()});
 const basket=(quantity:string,sku='QA_PRICE_A')=>({lines:[{sku,unitCode:'BASE',quantity}],discountBasisPoints:0,creditTerms:false});
 const preview=async(user:typeof admin,org:string,quantity:string,sku='QA_PRICE_A')=>(await prices.previewPrice(user,{organizationId:org,basket:basket(quantity,sku)})).calculation as PriceCalculation;
 const levels=await channel.listMembershipLevels();const level=(code:string)=>levels.find(l=>l.code===code)!;
 const storeC=randomUUID();
 await db.query("INSERT INTO cohamy_crm.organizations(id,code,name,kind,partner_type) VALUES($1,'QA_STORE_C','LOCAL QA · Cửa hàng C','DEALER','STORE')",[storeC]);

 await test('M01: Bốn hạng Đồng/Bạc/Vàng/Kim cương có sẵn, chưa gán % (doanh nghiệp tự nhập)',async()=>{
  assert.deepEqual(levels.map(l=>l.code),['BRONZE','SILVER','GOLD','DIAMOND']);assert.ok(levels.every(l=>l.fixed_percent_bp===null));
 });
 await test('M02: Đối tác chưa cấu hình kênh → tính giá giữ nguyên như cũ (không có lớp kênh)',async()=>{
  const c=await preview(admin,ids.dealerA,'10');assert.equal(c.channel,undefined);assert.equal(c.lines[0].unitPrice,'100000');assert.equal(c.lines[0].listUnitPrice,undefined);
 });
 await test('M03: Hạng Bạc 30% áp dụng cố định cho đối tác được xếp hạng; lưu lịch sử nâng hạng',async()=>{
  const s=level('SILVER');await channel.saveMembershipLevel(admin,{id:s.id,version:s.version,code:s.code,name:s.name,rank:s.rank,method:'FIXED_PERCENT',fixedPercent:30,tiers:[],color:s.color,description:s.description,active:true,reason:'QA cấu hình hạng Bạc'});
  await channel.setPartnerProfile(admin,{organizationId:ids.dealerA,membershipLevelId:s.id,region:'NORTH',reason:'QA xếp hạng Bạc'});
  const c=await preview(admin,ids.dealerA,'10');assert.equal(c.lines[0].accountPercentBp,3000);assert.equal(c.lines[0].unitPrice,'70000');assert.equal(c.channel?.accountSource,'MEMBERSHIP');assert.equal(c.channel?.levelName,'Bạc');assert.equal(c.channel?.listSubtotal,'1000000');
  const p=await channel.partnerChannelProfile(admin,ids.dealerA);assert.equal(p.events.length,1);assert.equal(p.organization.region,'NORTH');
 });
 await test('M04: Chiết khấu riêng của tài khoản (fix 40%) ưu tiên hơn % theo hạng',async()=>{
  await channel.saveChildDiscount(admin,{organizationId:ids.dealerA,method:'FIXED_PERCENT',fixedPercent:40,reason:'QA đại lý A 40%'});
  const c=await preview(admin,ids.dealerA,'10');assert.equal(c.lines[0].unitPrice,'60000');assert.equal(c.channel?.accountSource,'ACCOUNT');
 });
 await test('M05: Khuyến mãi toàn hệ thống 10% HOT cộng dồn tuần tự trước chiết khấu tài khoản',async()=>{
  const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+10*86400000).toISOString();
  await channel.savePromotion(admin,{sku:'QA_PRICE_A',name:'Mừng sản phẩm mới',campaign:'Khai trương',percent:10,scope:'ALL',badge:'HOT',startsAt:start,endsAt:end,reason:'QA KM toàn hệ thống'});
  const c=await preview(admin,ids.dealerA,'10'),l=c.lines[0];assert.equal(l.listUnitPrice,'100000');assert.equal(l.priceAfterPromo,'90000');assert.equal(l.promoPercentBp,1000);assert.equal(l.unitPrice,'54000');assert.equal(l.promotionBadge,'HOT');
  const b=await preview(admin,ids.dealerB,'10');assert.equal(b.lines[0].unitPrice,'90000','Đối tác khác cũng được KM toàn hệ thống');
 });
 await test('M06: Khuyến mãi chỉ định chỉ áp dụng cho đối tác/hạng được chọn',async()=>{
  const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+86400000).toISOString();
  await channel.savePromotion(admin,{sku:'QA_PRICE_B',name:'Riêng đại lý B',percent:20,scope:'DESIGNATED',targetOrganizationIds:[ids.dealerB],startsAt:start,endsAt:end,reason:'QA KM chỉ định'});
  assert.equal((await preview(admin,ids.dealerB,'1','QA_PRICE_B')).lines[0].unitPrice,'160000');
  assert.equal((await preview(admin,ids.dealerA,'1','QA_PRICE_B')).lines[0].promoPercentBp??0,0);
 });
 await test('M07: Khuyến mãi theo số lượng chỉ áp dụng khi đạt ngưỡng',async()=>{
  const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+86400000).toISOString();
  await channel.savePromotion(admin,{sku:'QA_PRICE_B',name:'Mua từ 20 gói',percent:15,scope:'QUANTITY',minBaseQuantity:'20',startsAt:start,endsAt:end,reason:'QA KM theo số lượng'});
  assert.equal((await preview(admin,ids.dealerA,'19','QA_PRICE_B')).lines[0].promoPercentBp??0,0);
  assert.equal((await preview(admin,ids.dealerA,'20','QA_PRICE_B')).lines[0].promoPercentBp,1500);
  await rejects(()=>channel.savePromotion(userA,{sku:'QA_PRICE_B',name:'x',percent:5,scope:'ALL',startsAt:start,endsAt:end,reason:'không được'}),'FORBIDDEN');
 });
 await test('M08: Cổ đông là gốc cây; đối tác bên dưới ghi danh đầu mối',async()=>{
  await channel.setPartnerProfile(admin,{organizationId:ids.dealerB,partnerType:'SHAREHOLDER',reason:'QA cổ đông Hoan'});
  await distribution.saveDistributionRelation(admin,{parentOrganizationId:ids.dealerB,childOrganizationId:ids.dealerA,reason:'QA A thuộc cổ đông B',idempotencyKey:randomUUID()});
  await distribution.saveDistributionRelation(admin,{parentOrganizationId:ids.dealerA,childOrganizationId:storeC,reason:'QA C thuộc A',idempotencyKey:randomUUID()});
  const n=await channel.networkOverview(admin);const sh=n.shareholders.find(s=>s.id===ids.dealerB)!;assert.equal(sh.members,2);
  assert.equal(n.partners.find(p=>p.id===storeC)?.anchorId,ids.dealerB);
  const portal=await channel.networkOverview(userA);assert.ok(portal.partners.every(p=>([ids.dealerA,storeC] as string[]).includes(p.id)),'Đại lý chỉ thấy nhánh của mình, không thấy cổ đông phía trên');
 });
 await test('M09: Đại lý đặt chiết khấu cho cấp dưới trực tiếp, không vượt mức mình nhận',async()=>{
  await rejects(()=>channel.saveChildDiscount(userA,{organizationId:storeC,method:'FIXED_PERCENT',fixedPercent:45,reason:'QA vượt trần'}),'DISCOUNT_EXCEEDS_UPSTREAM');
  await channel.saveChildDiscount(userA,{organizationId:storeC,method:'FIXED_PERCENT',fixedPercent:30,reason:'QA C 30%'});
  await rejects(()=>channel.saveChildDiscount(userB,{organizationId:storeC,method:'FIXED_PERCENT',fixedPercent:10,reason:'QA không trực tiếp'}),'NOT_DIRECT_CHILD');
  const row=(await db.query<{seller_organization_id:string;fixed_percent_bp:number}>("SELECT seller_organization_id,fixed_percent_bp FROM cohamy_crm.account_discount_policies WHERE buyer_organization_id=$1 AND status='ACTIVE'",[storeC])).rows[0];assert.equal(row.seller_organization_id,ids.dealerA);assert.equal(row.fixed_percent_bp,3000);
 });
 await test('M10: Chuỗi quản lý hiện cấp 1, 2…; cấp dưới không thấy phía trên; nhà máy liên hệ quản lý gần nhất',async()=>{
  const mk=async(org:string,seller:string,parent:string|null,creator:string,membership:string,area:'crm'|'portal')=>{const id=randomUUID();await db.query("INSERT INTO cohamy_crm.commercial_requests(id,code,organization_id,creator_id,creator_membership_id,creator_area,creator_role,channel,status,seller_organization_id,parent_request_id) VALUES($1,$2,$3,$4,$5,$6,'DEALER_OWNER','PORTAL','SUBMITTED',$7,$8)",[id,'QA-CH-'+id.slice(0,6),org,creator,membership,area,seller,parent]);return id;};
  const r1=await mk(storeC,ids.dealerA,null,userA.id,ids.membershipA,'portal'),r2=await mk(ids.dealerA,ids.dealerB,r1,userA.id,ids.membershipA,'portal'),r3=await mk(ids.dealerB,cohamy,r2,userB.id,ids.membershipB,'portal');
  const full=await channel.requestManagementChain(admin,r1);assert.deepEqual(full.nodes.map(n=>n.label),['Đơn vị đặt hàng','Quản lý cấp 1','Quản lý cấp 2','Nhà máy Cohamy']);assert.equal(full.nearestManager?.organizationId,ids.dealerB);assert.equal(full.levels,2);
  const fromA=await channel.requestManagementChain(userA,r2);assert.deepEqual(fromA.nodes.map(n=>n.organizationId),[storeC,ids.dealerA],'A không thấy cổ đông B phía trên');
  const fromB=await channel.requestManagementChain(userB,r3);assert.equal(fromB.nodes.length,3,'Cấp trên thấy toàn bộ phía dưới');
  const net=await channel.networkRequests(userB);assert.ok(net.some(r=>r.id===r1)&&net.some(r=>r.id===r2));
 });
 await test('M11: Xin chuyển cây phải được quản trị duyệt; duyệt xong mới đổi cây',async()=>{
  const t=await channel.createTransferRequest(userA,{organizationId:storeC,toParentId:ids.dealerB,reason:'QA C xin sang B',idempotencyKey:randomUUID()});
  await rejects(()=>channel.createTransferRequest(userA,{organizationId:storeC,toParentId:ids.dealerB,reason:'QA trùng',idempotencyKey:randomUUID()}),'TRANSFER_ALREADY_PENDING');
  assert.equal((await distribution.getActiveParentOrganization(db,storeC))?.id,ids.dealerA,'Chưa duyệt thì chưa đổi');
  await rejects(()=>channel.decideTransferRequest(userA,{id:t.id,decision:'APPROVE',reason:'tự duyệt'}),'FORBIDDEN');
  await rejects(()=>channel.createTransferRequest(admin,{organizationId:ids.dealerB,toParentId:storeC,reason:'QA vòng lặp',idempotencyKey:randomUUID()}),'DISTRIBUTION_CYCLE_DETECTED');
  await channel.decideTransferRequest(admin,{id:t.id,decision:'APPROVE',reason:'QA duyệt chuyển'});
  assert.equal((await distribution.getActiveParentOrganization(db,storeC))?.id,ids.dealerB);
  assert.equal((await channel.listTransferRequests(admin)).find(r=>r.id===t.id)?.status,'APPROVED');
 });
 await test('M12: Catalog đặt hàng: ảnh/giá/KM/HOT và trạng thái còn hàng, không lộ số tồn',async()=>{
  const b=await channel.orderCatalog(userB);const a=b.items.find(i=>i.sku==='QA_PRICE_A')!,bb=b.items.find(i=>i.sku==='QA_PRICE_B')!;
  assert.equal(a.availability,'IN_STOCK');assert.equal(bb.availability,'LOW');assert.equal(a.promotion?.badge,'HOT');assert.equal(a.estimatedUnitPrice,'90000');assert.ok(!('available' in a));
  const fromA=await channel.orderCatalog(userA);assert.equal(fromA.items.find(i=>i.sku==='QA_PRICE_A')?.availability,'OUT','A mua từ cổ đông B (kho B chưa có hàng)');assert.equal(fromA.items[0].sku,'QA_PRICE_A','Sản phẩm HOT lên đầu');
 });
 let orderId='',orderTotal='';
 await test('M13: Đơn từ catalog → gửi → xác nhận; đơn giá lưu theo giá kênh',async()=>{
  const draft=await requests.saveCommercialRequest(userB,{version:0,organizationId:ids.dealerB,channel:'PORTAL',basket:basket('30'),delivery:{recipient:'Cổ đông B',phone:'0900000000',address:'Hồ Chí Minh'},note:'QA catalog',idempotencyKey:randomUUID()});
  let head=await requests.commercialRequestAccess(db,userB,draft.id);await requests.requestAction(userB,{id:head.id,version:head.version,versionId:head.latest_version_id,action:'PROPOSE',reason:'QA đề xuất',idempotencyKey:randomUUID()});
  head=await requests.commercialRequestAccess(db,userB,draft.id);const sub=await orders.submitSalesRequest(userB,{id:head.id,version:head.version,versionId:head.latest_version_id,reason:'QA gửi',idempotencyKey:randomUUID()}) as {id:string};
  const sale=await orders.salesOrderAccess(db,admin,sub.id);await orders.salesOrderAction(admin,{id:sale.id,version:sale.version,versionId:sale.latest_version_id,action:'CONFIRM',reason:'QA xác nhận',idempotencyKey:randomUUID()});
  orderId=sale.id;const v=(await db.query<{total:string;unit:string}>("SELECT v.snapshot#>>'{quote,calculation,total}' AS total,v.snapshot#>>'{quote,calculation,lines,0,unitPrice}' AS unit FROM cohamy_crm.sales_orders s JOIN cohamy_crm.sales_order_versions v ON v.id=s.confirmed_version_id WHERE s.id=$1",[orderId])).rows[0];
  assert.equal(v.unit,'90000');orderTotal=v.total;
 });
 await test('M14: Xuất hoá đơn cho chính đơn vị hoặc công ty thương mại khác',async()=>{
  await channel.setInvoiceRecipient(userB,{orderId,kind:'COMPANY',companyName:'Công ty TM QA',taxCode:'0101234567',address:'Hà Nội',email:'',reason:'QA hoá đơn công ty'});
  const r=(await db.query<{invoice_recipient:{kind:string;taxCode:string}}>('SELECT invoice_recipient FROM cohamy_crm.sales_orders WHERE id=$1',[orderId])).rows[0].invoice_recipient;assert.equal(r.kind,'COMPANY');assert.equal(r.taxCode,'0101234567');
  await rejects(()=>channel.setInvoiceRecipient(userB,{orderId,kind:'COMPANY',companyName:'',taxCode:'',address:'',reason:'thiếu'}),'INVALID_FIELDS');
  await rejects(()=>channel.setInvoiceRecipient(userA,{orderId,kind:'BUYER',reason:'không phải đơn của A'}),'NOT_FOUND');
 });
 await test('M15: Kho báo thiếu → thông báo quản lý trực tiếp kèm tồn kho miền khác, không tự đặt ngày',async()=>{
  const south=await repo.createWarehouse(admin,{code:'QA_HCM',name:'Kho Hồ Chí Minh QA',organizationId:cohamy,region:'SOUTH'});
  const sLoc=(await inventory.createLocation(admin,{warehouseId:south.id,code:'LOC_HCM',name:'HCM pick',kind:'PICK',idempotencyKey:randomUUID()})) as {id:string};
  await db.query('INSERT INTO cohamy_crm.warehouse_assignments(membership_id,warehouse_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[ids.warehouse,south.id]);
  await inventory.postReceipt(warehouseUser,{locationId:sLoc.id,lines:[{productId:prodA.id,lotCode:'LOT-HCM',manufacturedOn:'2026-01-01',expiresOn:'2028-01-01',quantity:'50'}],referenceType:'PO',referenceId:'PO-HCM',reason:'QA HCM stock',idempotencyKey:randomUUID()});
  assert.equal((await repo.listWarehouses(admin)).find(w=>w.id===south.id)?.region,'SOUTH');
  await channel.reportShortage(warehouseUser,{orderId,sku:'QA_PRICE_A',needed:'30',available:'10',note:''});
  const n=(await db.query<{message:string}>("SELECT n.message FROM cohamy_crm.notifications n JOIN cohamy_crm.users u ON u.id=n.user_id WHERE u.email='b@crm-qa.invalid' AND n.event_key LIKE 'shortage:%'")).rows[0];
  assert.ok(n,'Đơn vị đặt (quản lý trực tiếp) nhận thông báo');assert.match(n.message,/Kho Hồ Chí Minh QA/);assert.match(n.message,/Chưa xác định/);
  const wh=await channel.regionWarehouses(db,cohamy,ids.dealerA);assert.equal(wh.warehouses[0].region,'NORTH','Kho gần nhất theo vùng đơn vị mua lên đầu');
 });
 await test('M16: Doanh số theo tháng/quý/năm, theo đầu mối, sản phẩm và ma trận',async()=>{
  for(const type of ['MONTH','QUARTER','YEAR'] as const){const r=await reports.periodSalesReport(admin,{periodType:type,view:'DIRECT'});assert.equal(r.totals.orders,1);assert.equal(r.totals.revenue,orderTotal);}
  const r=await reports.periodSalesReport(admin,{periodType:'QUARTER',view:'NETWORK'});assert.equal(r.anchors[0].id,ids.dealerB);assert.equal(r.matrix.rows[0].cells[0],'30');assert.equal(r.monthly.length,3);
  const mine=await reports.periodSalesReport(userB,{periodType:'MONTH',view:'PURCHASES'});assert.equal(mine.totals.orders,1);
  const other=await reports.periodSalesReport(userA,{periodType:'MONTH',view:'PURCHASES'});assert.equal(other.totals.orders,0,'Không thấy doanh số của đơn vị khác');
  await rejects(()=>reports.periodSalesReport(admin,{periodType:'MONTH',periodKey:'2026-Q4'}),'INVALID_PERIOD');
 });
 await test('M17: KPI đạt mục tiêu → quản lý duyệt nâng hạng Kim cương; không trao 2 lần, không trao khi chưa đạt',async()=>{
  const p=await reports.saveIncentiveProgram(admin,{name:'Tháng đạt doanh số lên Kim cương',periodType:'MONTH',periodKey:reports.currentPeriodKey('MONTH'),metric:'REVENUE',target:'1000000',audience:'ALL',rewardType:'UPGRADE_LEVEL',rewardLevelId:level('DIAMOND').id,reason:'QA chương trình KPI'});
  const progress=await reports.incentiveProgress(admin,p.id);assert.equal(progress.rows.find(r=>r.organizationId===ids.dealerB)?.reached,true);assert.equal(progress.rows.find(r=>r.organizationId===ids.dealerA)?.reached,false);
  await rejects(()=>reports.awardIncentive(admin,{programId:p.id,organizationId:ids.dealerA,reason:'chưa đạt'}),'TARGET_NOT_REACHED');
  await reports.awardIncentive(admin,{programId:p.id,organizationId:ids.dealerB,reason:'QA đạt chỉ tiêu'});
  const prof=await channel.partnerChannelProfile(admin,ids.dealerB);assert.equal(prof.level?.code,'DIAMOND');assert.equal(prof.events[0].source,'INCENTIVE');
  await rejects(()=>reports.awardIncentive(admin,{programId:p.id,organizationId:ids.dealerB,reason:'lần 2'}),'ALREADY_AWARDED');
  const portal=await reports.listIncentivePrograms(userB);assert.equal(portal.own[0].awarded,true);
 });
 await test('M18: Phân quyền: chỉ ADMIN/MANAGER quản trị kênh; chủ đại lý xem mạng lưới & doanh số của mình',async()=>{
  assert.equal(can(admin,'channel.manage'),true);assert.equal(can(userA,'channel.manage'),false);assert.equal(can(userA,'channel.network'),true);assert.equal(can(warehouseUser,'reports.period'),false);
  await rejects(()=>channel.listPromotions(userA),'FORBIDDEN');await rejects(()=>channel.setPartnerProfile(userA,{organizationId:storeC,membershipLevelId:null,reason:'không được'}),'FORBIDDEN');
 });

 const failed=cases.filter(c=>c.status==='FAIL').length;
 await fs.mkdir('docs/crm/test-results',{recursive:true});
 await fs.writeFile('docs/crm/test-results/meeting-1012-'+(postgres?'postgres':'local')+'.json',JSON.stringify({testedAt:new Date().toISOString(),environment:postgres?'PostgreSQL':'LOCAL PGlite',total:cases.length,failed,cases},null,2));
 console.log(`Meeting 12/10: ${cases.length-failed}/${cases.length} PASS`);
 await close();await owner.close();
 if(failed)process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1);});
