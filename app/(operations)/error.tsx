"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="crm-failure"><h1>CRM chưa xử lý được yêu cầu</h1><p>Kiểm tra phiên đăng nhập và kết nối database. Website công khai không phụ thuộc vào database CRM.</p><button className="button button--primary" onClick={reset}>Thử lại</button><Link href="/crm/login">Đăng nhập lại</Link></main>;}
