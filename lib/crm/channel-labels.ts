// Client-safe labels for the distribution channel model (meeting 12/10/2026).
export const partnerTypeLabels:Record<string,string>={
 COHAMY:'Cohamy / Nhà máy',
 SHAREHOLDER:'Cổ đông / Đầu mối',
 DEALER_L1:'Đại lý cấp 1 / Tổng đại lý',
 DEALER_L2:'Đại lý cấp 2',
 STORE:'Cửa hàng / Siêu thị / Nhà hàng',
 END_CUSTOMER:'Khách hàng cuối',
};
export const regionLabels:Record<string,string>={NORTH:'Miền Bắc · Kho Hà Nội',SOUTH:'Miền Nam · Kho Hồ Chí Minh'};
export const promotionScopeLabels:Record<string,string>={ALL:'Toàn hệ thống',DESIGNATED:'Chỉ định đối tác / hạng',QUANTITY:'Theo số lượng mua'};
export const badgeLabels:Record<string,string>={HOT:'HOT',NEW:'Hàng mới',SALE:'Giảm giá'};
export const availabilityLabels:Record<string,string>={IN_STOCK:'Còn hàng',LOW:'Sắp hết',OUT:'Tạm hết',UNKNOWN:'Liên hệ'};
export const rewardLabels:Record<string,string>={UPGRADE_LEVEL:'Nâng hạng thành viên',DISCOUNT_PERCENT:'Chiết khấu cố định mới',GIFT_AMOUNT:'Quà tặng / thưởng tiền'};
export const periodLabels:Record<string,string>={MONTH:'Tháng',QUARTER:'Quý',YEAR:'Năm'};
export const transferStatusLabels:Record<string,string>={PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối'};
export const percentText=(bp:number|null|undefined)=>bp===null||bp===undefined?'Chưa cấu hình':(bp/100).toLocaleString('vi-VN',{maximumFractionDigits:2})+'%';
