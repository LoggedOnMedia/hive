import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Department = { id: string; name: string };

export type StoreSummary = {
  id: string;
  name: string;
  location: string | null;
  manager: { name: string; email: string | null } | null;
  enabledDepartments: number;
};

export type StoreDepartment = Department & { enabled: boolean; email: string | null };

export type StoreDetail = {
  id: string;
  name: string;
  location: string | null;
  manager: { id: string; name: string; email: string | null } | null;
  departments: StoreDepartment[];
};

type ProfileRow = { id: string; full_name: string; email: string | null; role: string };

export async function listDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("id, name").order("sort_order");
  if (error) throw error;
  return data;
}

export async function listStores(): Promise<StoreSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, location, profiles!profiles_store_id_fkey(id, full_name, email, role), store_departments(enabled)")
    .order("name");
  if (error) throw error;

  return data.map((s) => {
    const manager = (s.profiles as ProfileRow[]).find((p) => p.role === "store_manager");
    return {
      id: s.id,
      name: s.name,
      location: s.location,
      manager: manager ? { name: manager.full_name, email: manager.email } : null,
      enabledDepartments: (s.store_departments as { enabled: boolean }[]).filter((d) => d.enabled).length,
    };
  });
}

export async function getStore(id: string): Promise<StoreDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, name, location, profiles!profiles_store_id_fkey(id, full_name, email, role), store_departments(enabled, email, departments(id, name, sort_order))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error?.code === "22P02") return null; // not a uuid
  if (error) throw error;
  if (!data) return null;

  const manager = (data.profiles as ProfileRow[]).find((p) => p.role === "store_manager");
  const departments = (
    data.store_departments as unknown as {
      enabled: boolean;
      email: string | null;
      departments: { id: string; name: string; sort_order: number };
    }[]
  )
    .sort((a, b) => a.departments.sort_order - b.departments.sort_order)
    .map((d) => ({ id: d.departments.id, name: d.departments.name, enabled: d.enabled, email: d.email }));

  return {
    id: data.id,
    name: data.name,
    location: data.location,
    manager: manager ? { id: manager.id, name: manager.full_name, email: manager.email } : null,
    departments,
  };
}
