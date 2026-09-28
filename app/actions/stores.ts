"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRegionalManager } from "@/lib/viewer";

export type FormState = { error?: string; ok?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function createStore(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const name = text(fd, "name");
  if (!name) return { error: "Give the store a name." };

  const supabase = await createClient();
  const { data: departments, error: depError } = await supabase.from("departments").select("id");
  if (depError) return { error: depError.message };

  const enabled = new Set(fd.getAll("department").map(String));
  const disabled = departments.filter((d) => !enabled.has(d.id)).map((d) => d.id);

  const { data: storeId, error } = await supabase.rpc("create_store", {
    p_name: name,
    p_location: text(fd, "location"),
    p_disabled_department_ids: disabled,
  });
  if (error) {
    return { error: error.code === "23505" ? `There's already a store called "${name}".` : error.message };
  }

  revalidatePath("/stores", "layout");
  redirect(`/stores/${storeId}`);
}

export async function updateStoreDetails(storeId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const name = text(fd, "name");
  if (!name) return { error: "The store needs a name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ name, location: text(fd, "location") || null })
    .eq("id", storeId);
  if (error) {
    return { error: error.code === "23505" ? `There's already a store called "${name}".` : error.message };
  }

  revalidatePath("/stores", "layout");
  return { ok: "Saved" };
}

export async function updateStoreDepartments(storeId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const supabase = await createClient();
  const { data: departments, error: depError } = await supabase.from("departments").select("id, name");
  if (depError) return { error: depError.message };

  const enabled = new Set(fd.getAll("department").map(String));
  const rows = [];
  for (const d of departments) {
    const email = text(fd, `email:${d.id}`).toLowerCase();
    if (email && !EMAIL.test(email)) return { error: `${d.name}: "${email}" isn't a valid email address.` };
    rows.push({ store_id: storeId, department_id: d.id, enabled: enabled.has(d.id), email: email || null });
  }

  const { error } = await supabase.from("store_departments").upsert(rows);
  if (error) return { error: error.message };

  revalidatePath("/stores", "layout");
  return { ok: "Saved" };
}

export async function createStoreManager(storeId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const fullName = text(fd, "full_name");
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!fullName) return { error: "Enter the store manager's name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "The password needs at least 8 characters." };

  // Creating auth users needs the secret key; the role check above gates it.
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    const taken = authError?.code === "email_exists" || /already/i.test(authError?.message ?? "");
    return { error: taken ? "That email already has a login." : (authError?.message ?? "Couldn't create the login.") };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role: "store_manager",
    store_id: storeId,
  });
  if (profileError) {
    // Don't leave a login behind with no profile attached.
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      error: profileError.code === "23505" ? "This store already has a manager." : profileError.message,
    };
  }

  revalidatePath("/stores", "layout");
  return { ok: "Login created" };
}

export async function resetManagerPassword(storeId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "The password needs at least 8 characters." };

  // Look the manager up through the user-scoped client so it's RLS-checked.
  const supabase = await createClient();
  const { data: manager } = await supabase
    .from("profiles")
    .select("id")
    .eq("store_id", storeId)
    .eq("role", "store_manager")
    .maybeSingle();
  if (!manager) return { error: "This store has no manager login." };

  const { error } = await createAdminClient().auth.admin.updateUserById(manager.id, { password });
  if (error) return { error: error.message };
  return { ok: "Password updated" };
}
