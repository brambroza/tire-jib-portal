"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ActionFeedback from "../../components/ui/ActionFeedback";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
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

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess("เข้าสู่ระบบสำเร็จ");
      router.push("/");
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Dream<span>maker</span> Admin</div>
        <div className="auth-sub">ลงชื่อเข้าใช้เพื่อจัดการระบบหลังบ้าน</div>

        <form onSubmit={handleLogin}>
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

          <ActionFeedback
            error={error}
            success={success}
            onClearError={() => setError(null)}
            onClearSuccess={() => setSuccess(null)}
          />

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div className="auth-footer">
          ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link>
        </div>
      </div>
    </div>
  );
}
