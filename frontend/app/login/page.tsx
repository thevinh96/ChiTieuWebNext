"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Wallet } from "lucide-react";
import { getSupabaseClient, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void getSupabaseClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabaseConfigured) return;
    setBusy(true); setMessage("");
    const supabase = getSupabaseClient();
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "signup" && !result.data.session) {
      setMessage("Tài khoản đã được tạo. Hãy mở email để xác nhận rồi đăng nhập.");
      return;
    }
    router.replace("/");
  };

  return <main className="auth-page"><section className="auth-card"><div className="brand auth-brand"><div className="brand-mark"><Wallet size={19} /></div><span>chi tiêu<span className="brand-dot">.</span></span></div><div className="auth-eyebrow">TÀI CHÍNH CỦA BẠN, TRONG TẦM TAY</div><h1>{mode === "signin" ? "Chào mừng trở lại" : "Bắt đầu hành trình mới"}</h1><p className="auth-intro">Đăng nhập để xem và quản lý các giao dịch của bạn.</p>
    {!supabaseConfigured ? <div className="auth-config"><strong>Chưa kết nối Supabase</strong><p>Thêm URL và publishable key vào <code>frontend/.env.local</code>, sau đó khởi động lại frontend.</p></div> : <form className="auth-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@email.com" required /></label><label>Mật khẩu<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="Tối thiểu 8 ký tự" required /></label>{message && <p className="auth-message" role="status">{message}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Đang xử lý…" : mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}<ArrowRight size={16} /></button></form>}
    {supabaseConfigured && <div className="auth-switch">{mode === "signin" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}<button onClick={() => { setMessage(""); setMode(mode === "signin" ? "signup" : "signin"); }}>{mode === "signin" ? "Tạo tài khoản" : "Đăng nhập"}</button></div>}
    <div className="auth-foot">Dữ liệu tài chính của bạn được lưu riêng cho tài khoản.</div></section></main>;
}
