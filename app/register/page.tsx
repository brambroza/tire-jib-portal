"use client";

import { useState } from "react";
import Link from "next/link";
import ActionFeedback from "../../components/ui/ActionFeedback";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setError("กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    if (!email || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess("สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมล");
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Dream<span>makker</span> Admin</div>
        <div className="auth-sub">สมัครสมาชิกด้วยอีเมลและรหัสผ่าน</div>

        <form onSubmit={handleRegister}>
          <label className="auth-label">อีเมล</label>
          <input
            className="auth-input"
            placeholder="admin@tirehub.co"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="auth-label">รหัสผ่าน</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="auth-label">ยืนยันรหัสผ่าน</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <ActionFeedback
            error={error}
            success={success}
            onClearError={() => setError(null)}
            onClearSuccess={() => setSuccess(null)}
          />

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>

        <div className="auth-footer">
          มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
