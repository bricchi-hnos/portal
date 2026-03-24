import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nicolas@bricchihnos.com";

// Headers para acceder al schema portal
function headers() {
  return {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": "portal",
    "Content-Profile": "portal",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Sin permisos" });
  }

  if (req.method === "GET") {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?select=id,email,nombre,sector,is_admin,activo,created_at&order=created_at.asc`,
      { headers: headers() }
    );
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.message || "Error" });
    return res.json(data);
  }

  if (req.method === "POST") {
    const { email, nombre, sector } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
      method: "POST",
      headers: { ...headers(), "Prefer": "return=representation" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), nombre, sector, is_admin: false, activo: true }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.message || "Error" });
    return res.json(Array.isArray(data) ? data[0] : data);
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!r.ok) {
      const data = await r.json();
      return res.status(500).json({ error: data.message || "Error" });
    }
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
