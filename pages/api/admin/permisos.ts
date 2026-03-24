import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nicolas@bricchihnos.com";

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
      `${SUPABASE_URL}/rest/v1/usuario_modulos?select=usuario_id,modulo_id,habilitado`,
      { headers: headers() }
    );
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.message || "Error" });
    return res.json(data);
  }

  if (req.method === "POST") {
    const { usuario_id, modulo_id, habilitado } = req.body;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuario_modulos`, {
      method: "POST",
      headers: { ...headers(), "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ usuario_id, modulo_id, habilitado }),
    });
    if (!r.ok) {
      const data = await r.json();
      return res.status(500).json({ error: data.message || "Error" });
    }
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
