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
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "No autenticado" });
  }

  // Admin ve todos los dashboards
  if (session.user.email === ADMIN_EMAIL) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/dashboard_uploads?select=*&order=created_at.desc&limit=200`,
      { headers: headers() }
    );
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.message || "Error" });
    return res.json(data);
  }

  // Usuario normal: buscar su id en portal.usuarios
  const rUser = await fetch(
    `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(session.user.email)}&select=id`,
    {
      headers: {
        ...headers(),
        "Accept-Profile": "portal",
      }
    }
  );
  const usuarios = await rUser.json();
  if (!rUser.ok || !usuarios.length) return res.json([]);

  const usuario_id = usuarios[0].id;

  // Buscar dashboards habilitados para ese usuario
  const rPermisos = await fetch(
    `${SUPABASE_URL}/rest/v1/dashboard_permisos?usuario_id=eq.${usuario_id}&habilitado=eq.true&select=dashboard_id`,
    { headers: headers() }
  );
  const permisos = await rPermisos.json();
  if (!rPermisos.ok || !permisos.length) return res.json([]);

  const ids = permisos.map((p: any) => p.dashboard_id).join(",");
  const rDash = await fetch(
    `${SUPABASE_URL}/rest/v1/dashboard_uploads?id=in.(${ids})&select=*&order=created_at.desc`,
    { headers: headers() }
  );
  const dashboards = await rDash.json();
  if (!rDash.ok) return res.status(500).json({ error: dashboards.message || "Error" });
  return res.json(dashboards);
}
