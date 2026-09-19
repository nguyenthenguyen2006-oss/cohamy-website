"use client";
import { EnvelopeSimple, Eye, EyeSlash, LockKey, SignIn } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
export function CrmLoginForm() {
  const router=useRouter();const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [secondFactor,setSecondFactor]=useState("");const [mfa,setMfa]=useState(false);const [show,setShow]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(pending)return;setPending(true);setError("");
    try {const response=await fetch("/api/crm/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password,...(mfa?{secondFactor}: {})})});const result=await response.json();
      if(!response.ok){if(response.status===428&&result.error==='MFA_REQUIRED'){setMfa(true);setError('Nhập mã 6 số từ ứng dụng xác thực hoặc một mã khôi phục chưa dùng.');return;}setError(response.status===401?(mfa?'Mã xác thực không đúng hoặc đã dùng.':'Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được cấp quyền.'):response.status===429?"Bạn đã thử đăng nhập quá nhiều lần. Thử lại sau 15 phút.":"CRM chưa kết nối được database hoặc cấu hình bảo mật. Liên hệ quản trị để kiểm tra.");return;}
      if(result.redirectTo!=="/crm"&&result.redirectTo!=="/portal")throw new Error();router.replace(result.redirectTo);router.refresh();
    }catch{setError("Không kết nối được CRM. Kiểm tra mạng rồi thử lại.");}finally{setPending(false);}
  }
  return <form className="auth-form" onSubmit={submit}>
    <div className="field"><label htmlFor="login-email">Email</label><div className="crm-login-input-wrap"><EnvelopeSimple aria-hidden size={19} weight="fill"/><input id="login-email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="Email đăng nhập" value={email} onChange={event=>setEmail(event.target.value)}/></div></div>
    <div className="field"><label htmlFor="login-password">Mật khẩu</label><div className="password-wrap"><LockKey aria-hidden size={19} weight="fill"/><input id="login-password" name="password" type={show?"text":"password"} autoComplete="current-password" required maxLength={72} placeholder="Mật khẩu" value={password} onChange={event=>setPassword(event.target.value)}/><button className="password-toggle" type="button" aria-label={show?"Ẩn mật khẩu":"Hiện mật khẩu"} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeSlash aria-hidden size={19}/>:<Eye aria-hidden size={19}/>}</button></div></div>
    {mfa&&<div className="field"><label htmlFor="login-mfa">Mã xác thực hai bước</label><input id="login-mfa" name="secondFactor" inputMode="numeric" autoComplete="one-time-code" required maxLength={9} placeholder="123456 hoặc XXXX-XXXX" value={secondFactor} onChange={event=>setSecondFactor(event.target.value.toUpperCase())}/></div>}
    {error&&<div className="form-status form-status--error" role="alert">{error}</div>}
    <button className="button button--primary" type="submit" disabled={pending}><SignIn aria-hidden size={19}/>{pending?"Đang xác thực":"Đăng nhập"}</button>
  </form>;
}
