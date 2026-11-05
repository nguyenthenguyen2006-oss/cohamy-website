export const WEBSITE_ORDER_MAIL_EVENT = 'website.order.received';

export const websiteOrderMailEvent = {
  event: WEBSITE_ORDER_MAIL_EVENT,
  label: 'Khách online → Có đơn mới',
  source: 'website-notification',
  action: 'order.received',
  table: 'website_orders',
  available: true,
  notificationOnly: true,
} as const;
