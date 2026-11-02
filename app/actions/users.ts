"use server";

import { createClient } from "@supabase/supabase-js";

type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  is_active: boolean | null;
  menu_permissions: string[] | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  group_id?: string | null;
  site_id?: string | null;
  dealer_approved?: boolean | null;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase service role configuration");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

export async function fetchAuthUsers(): Promise<
  Array<{
    id: string;
    email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    role: string | null;
    is_active: boolean;
    menu_permissions: string[];
    full_name: string | null;
    phone: string | null;
    group_id: string | null;
    site_id: string | null;
    dealer_approved: boolean;
  }>
> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const users = (data?.users ?? []) as AuthUserRow[];
  const ids = users.map((u) => u.id);
  let profiles: ProfileRow[] = [];
  if (ids.length) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,role,is_active,menu_permissions,full_name,email,phone,group_id,site_id,dealer_approved")
      .in("id", ids);
    if (profileError) throw profileError;
    profiles = (profileData ?? []) as ProfileRow[];
  }
  const profileMap = new Map<string, ProfileRow>();
  profiles.forEach((row) => profileMap.set(row.id, row));
  return users.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      role: profile?.role ?? null,
      is_active: profile?.is_active ?? true,
      menu_permissions: profile?.menu_permissions ?? [],
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      group_id: profile?.group_id ?? null,
      site_id: profile?.site_id ?? null,
      dealer_approved: profile?.dealer_approved ?? false
    };
  });
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, is_active: isActive }, { onConflict: "id" });
  if (error) throw error;
}

export async function updateUserPermissions(userId: string, permissions: string[]) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, menu_permissions: permissions }, { onConflict: "id" });
  if (error) throw error;
}

export async function fetchProfileMeta() {
  const supabase = getAdminClient();
  const [groupRes, siteRes] = await Promise.all([
    supabase.from("customer_groups").select("id,name").order("name"),
    supabase.from("sites").select("id,name").order("name")
  ]);
  if (groupRes.error) throw groupRes.error;
  if (siteRes.error) throw siteRes.error;
  return { groups: groupRes.data ?? [], sites: siteRes.data ?? [] };
}

export async function upsertProfile(input: {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  group_id: string | null;
  site_id: string | null;
  dealer_approved: boolean;
}) {
  const supabase = getAdminClient();
  const { error } = await supabase.from("profiles").upsert(input, { onConflict: "id" });
  if (error) throw error;
}
