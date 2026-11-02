"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type AuthGuardProps = {
  children: React.ReactNode;
  redirectTo?: string;
};

export default function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      if (!supabase) {
        if (mounted) setReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace(redirectTo);
        return;
      }
      if (mounted) setReady(true);
    }

    checkSession();

    const { data: sub } = supabase
      ? supabase.auth.onAuthStateChange((event, session) => {
          if (!session) router.replace(redirectTo);
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router, redirectTo]);

  if (!ready) return null;
  return <>{children}</>;
}
