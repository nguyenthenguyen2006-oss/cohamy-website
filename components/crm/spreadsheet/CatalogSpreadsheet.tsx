'use client';
import React from 'react';
import Link from 'next/link';
import {CrmSpreadsheet, type SpreadsheetColumn} from './CrmSpreadsheet';
import {resolveProductImage} from '../CommercialForms';
import type {CatalogProduct} from '@/lib/crm/types';

export function CatalogSpreadsheet({
 items,
 root,
 canWrite,
}: {
 items: CatalogProduct[];
 root: string;
 canWrite: boolean;
}) {
 const columns: SpreadsheetColumn<CatalogProduct>[] = [
  {
   key: 'image',
   label: 'Hình ảnh',
   type: 'text',
   width: 72,
   sticky: true,
   getValue: r => r.sku,
   renderCell: r => (
    <img
     src={resolveProductImage(r.sku)}
     alt={r.name}
     className="crm-basket-thumb"
     loading="lazy"
    />
   ),
  },
  {
   key: 'sku',
   label: 'SKU ánh xạ',
   type: 'code',
   width: 145,
   sticky: true,
   getValue: r => r.sku,
   renderCell: r => (
    <Link className="table-primary crm-cell-strong-link" href={`${root}/${r.id}`}>
     {r.sku}
    </Link>
   ),
  },
  {
   key: 'name',
   label: 'Tên sản phẩm',
   type: 'text',
   width: 260,
   sticky: true,
   getValue: r => r.name,
   renderCell: r => <strong>{r.name}</strong>,
  },
  {
   key: 'category',
   label: 'Nhóm hàng',
   type: 'text',
   groupable: true,
   width: 150,
   getValue: r => r.category || 'Khác',
  },
  {
   key: 'weight_label',
   label: 'Quy cách website',
   type: 'text',
   width: 150,
   getValue: r => r.weight_label || '—',
  },
  {
   key: 'stock_unit',
   label: 'Đơn vị cơ sở (Gốc)',
   type: 'text',
   editable: canWrite,
   editorType: 'text',
   width: 140,
   getValue: r => r.stock_unit ?? '',
   renderCell: r => (r.stock_unit ? <strong>{r.stock_unit}</strong> : <span className="muted">Chưa khai báo</span>),
  },
  {
   key: 'units_per_case',
   label: 'Quy đổi / Thùng',
   type: 'number',
   editable: canWrite,
   editorType: 'number',
   summable: false,
   width: 135,
   getValue: r => r.units_per_case ?? '',
   renderCell: r =>
    r.units_per_case ? (
     <span className="crm-code-chip">
      1 Thùng = {r.units_per_case} {r.stock_unit || 'ĐV'}
     </span>
    ) : (
     <span className="muted">Chưa khai báo</span>
    ),
  },
  {
   key: 'retail_price',
   label: 'Giá niêm yết website (VND)',
   type: 'money',
   unitGroup: 'VND',
   summable: false,
   width: 175,
   getValue: r => r.retail_price,
   renderCell: r => <strong>{BigInt(r.retail_price).toLocaleString('vi-VN')} đ</strong>,
  },
  {
   key: 'active',
   label: 'Trạng thái kinh doanh',
   type: 'boolean',
   editable: canWrite,
   editorType: 'select',
   groupable: true,
   width: 150,
   editorOptions: [
    {value: 'true', label: 'Đang kinh doanh'},
    {value: 'false', label: 'Ngừng kinh doanh'},
   ],
   getValue: r => String(r.active),
   renderCell: r => (
    <span className={`status-badge ${r.active ? 'status-ready' : 'status-cancelled'}`}>
     {r.active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
    </span>
   ),
  },
  {
   key: 'mapping_status',
   label: 'Ánh xạ kho & đơn vị',
   type: 'status',
   groupable: true,
   width: 175,
   getValue: r => (r.stock_unit ? 'Đã cấu hình đơn vị gốc' : 'Danh mục, chưa xác nhận kho'),
   renderCell: r => (
    <span className="crm-cell-sub">{r.stock_unit ? `Đã khai báo (${r.stock_unit})` : 'Danh mục, chưa xác nhận kho'}</span>
   ),
  },
 ];

 return (
  <CrmSpreadsheet
   sheetKey="crm_goods_catalog"
   title="Bảng tính Danh mục Hàng hóa & Quy đổi Đơn vị"
   subtitle="Nhấp đúp hoặc nhấn F2 vào cột Đơn vị cơ sở, Quy đổi / Thùng hoặc Trạng thái để sửa nhanh và lưu hàng loạt"
   columns={columns}
   rows={items}
   getRowKey={r => r.id}
   getRowVersion={r => r.version ?? 1}
   totalDatasetCount={items.length}
   batchSaveEndpoint={canWrite ? '/api/crm/spreadsheet/catalog-cells' : undefined}
   drawerTitle={r => `${r.sku} · ${r.name}`}
   drawerFullPageHref={r => `${root}/${r.id}`}
   renderDrawer={r => (
    <div className="crm-drawer-stack">
     <div className="crm-drawer-kv-grid">
      <div>
       <span>Mã SKU</span>
       <strong>{r.sku}</strong>
      </div>
      <div>
       <span>Nhóm hàng</span>
       <strong>{r.category || '—'}</strong>
      </div>
      <div>
       <span>Quy cách website</span>
       <strong>{r.weight_label || '—'}</strong>
      </div>
      <div>
       <span>Giá niêm yết website</span>
       <strong className="crm-text-net">{BigInt(r.retail_price).toLocaleString('vi-VN')} đ</strong>
      </div>
      <div>
       <span>Đơn vị gốc</span>
       <strong>{r.stock_unit || 'Chưa khai báo'}</strong>
      </div>
      <div>
       <span>Quy đổi / Thùng</span>
       <strong>{r.units_per_case ? `1 Thùng = ${r.units_per_case} ${r.stock_unit ?? 'ĐV'}` : 'Chưa khai báo'}</strong>
      </div>
     </div>
     <div className="crm-drawer-links">
      <Link className="btn primary" href={`${root}/${r.id}`}>
       Mở cấu hình Đơn vị & Quy đổi thương mại ↗
      </Link>
     </div>
    </div>
   )}
  />
 );
}
