import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuditEntry {
  id?: string;
  slug: string;
  area: string;
  dashboard_type: "static" | "embed" | "app";
  filename: string;
  uploader_email: string;
  uploader_name: string;
  github_commit_sha: string;
  dashboard_url: string;
  assets_count: number;
  created_at?: string;
}

export async function logUpload(entry: AuditEntry) {
  const { error } = await supabase.from("dashboard_uploads").insert(entry);
  if (error) console.error("Audit log error:", error);
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("dashboard_uploads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return data || [];
}
