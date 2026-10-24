export type MailFile={type:'FLOW'|'VAT'|'BUSINESS'|'PRIVATE';id:string;filename:string;checksum:string};
export type MailRecipients={to:string[];cc:string[];bcc:string[]};
export const coreMailEvents=[
  {event:'factory.request.sent',label:'Đề nghị → Xác nhận gửi nhà máy'},
  {event:'factory.request.accepted',label:'Đề nghị → Nhà máy tiếp nhận'},
  {event:'factory.dispatch.confirmed',label:'Nhà máy → Xác nhận chuyển kho'},
  {event:'factory.receipt.confirmed',label:'Kho → Xác nhận nhập từ nhà máy'},
  {event:'factory.receipt.discrepancy',label:'Kho → Nhận hàng có chênh lệch'},
  {event:'warehouse.issue.confirmed',label:'Kho → Xác nhận xuất / giao hàng'},
  {event:'vat.saved',label:'VAT → Lưu tài liệu gốc'},
  {event:'vat.replaced',label:'VAT → Admin thay thế tài liệu'},
  {event:'document.amended',label:'Chứng từ → Admin đính chính'},
] as const;
