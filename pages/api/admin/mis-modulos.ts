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
  if (!session?.user?.email) {
    return res.status(401).json({ error: "No autenticado" });
  }

  // Admin ve todos los módulos
  if (session.user.email === ADMIN_EMAIL) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/modulos?select=id,slug,nombre,url,icono,orden&activo=eq.true&order=orden.asc`,
      { headers: headers() }
    );
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.message || "Error" });
    return res.json(data);
  }

  // Buscar usuario
  const rUser = await fetch(
    `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(session.user.email)}&select=id`,
    { headers: headers() }
  );
  const usuarios = await rUser.json();
  if (!rUser.ok || !usuarios.length) return res.json([]);

  const usuario_id = usuarios[0].id;

  // Buscar módulos habilitados
  const rPermisos = await fetch(
    `${SUPABASE_URL}/rest/v1/usuario_modulos?usuario_id=eq.${usuario_id}&habilitado=eq.true&select=modulo_id`,
    { headers: headers() }
  );
  const permisos = await rPermisos.json();
  if (!rPermisos.ok || !permisos.length) return res.json([]);

  const ids = permisos.map((p: any) => p.modulo_id).join(",");
  const rModulos = await fetch(
    `${SUPABASE_URL}/rest/v1/modulos?id=in.(${ids})&activo=eq.true&select=id,slug,nombre,url,icono,orden&order=orden.asc`,
    { headers: headers() }
  );
  const modulos = await rModulos.json();
  if (!rModulos.ok) return res.status(500).json({ error: modulos.message || "Error" });
  return res.json(modulos);
}
