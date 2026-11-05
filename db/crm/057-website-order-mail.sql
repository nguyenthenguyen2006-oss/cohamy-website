-- Notify only newly received website orders. No order/job backfill and no
-- replacement of an administrator's existing rule or future recipient choices.
INSERT INTO cohamy_crm.document_mail_rules
  (id,event,enabled,recipients,subject,body,attachments)
VALUES (
  '9aee2910-76ba-4c56-b759-646109d52339',
  'website.order.received',
  true,
  '{"to":["kangminamhd@gmail.com","nguyenptkthd@gmail.com"],"cc":[],"bcc":[]}'::jsonb,
  'Có đơn online mới · {{code}}',
  $body$Có đơn đặt hàng mới từ website Cohamy.
Mã đơn: {{code}}
Thời điểm tiếp nhận (giờ Việt Nam): {{date}}
Trạng thái lúc tiếp nhận: Chờ Admin điều phối về kho.
Xem và điều phối đơn: {{url}}$body$,
  'EVENT'
)
ON CONFLICT DO NOTHING;
