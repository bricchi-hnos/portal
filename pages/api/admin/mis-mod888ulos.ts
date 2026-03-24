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
  if (!session?.user?.email) {
    return res.status(401).json({ error: "No autenticado" });
  }

  // Admin ve todos los módulos
  if (session.user.email === ADMIN_EMAIL) {
    const { data, error } = await supabase
      .schema("portal")
      .from("modulos")
      .select("id, slug, nombre, url, icono, orden")
      .eq("activo", true)
      .order("orden");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Usuarios normales: solo ven los módulos habilitados para ellos
  const { data: usuario } = await supabase
    .schema("portal")
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!usuario) return res.json([]); // no está en la tabla → no ve nada

  const { data, error } = await supabase
    .schema("portal")
    .from("usuario_modulos")
    .select("modulo_id, modulos(id, slug, nombre, url, icono, orden)")
    .eq("usuario_id", usuario.id)
    .eq("habilitado", true);

  if (error) return res.status(500).json({ error: error.message });

  const modulos = (data || [])
    .map((r: any) => r.modulos)
    .filter(Boolean)
    .sort((a: any, b: any) => a.orden - b.orden);

  return res.json(modulos);
}
