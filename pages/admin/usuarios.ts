import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nicolas@bricchihnos.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Sin permisos" });
  }

  // GET — listar usuarios
  if (req.method === "GET") {
    const { data, error } = await supabase
      .schema("portal")
      .from("usuarios")
      .select("id, email, nombre, sector, is_admin, activo, created_at")
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // POST — crear usuario
  if (req.method === "POST") {
    const { email, nombre, sector } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });
    const { data, error } = await supabase
      .schema("portal")
      .from("usuarios")
      .insert({ email: email.toLowerCase().trim(), nombre, sector, is_admin: false, activo: true })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // DELETE — eliminar usuario
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase
      .schema("portal")
      .from("usuarios")
      .delete()
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
