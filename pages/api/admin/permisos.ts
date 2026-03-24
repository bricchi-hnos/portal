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

  // GET — listar todos los permisos actuales
  if (req.method === "GET") {
    const { data, error } = await supabase
      .schema("portal")
      .from("usuario_modulos")
      .select("usuario_id, modulo_id, habilitado");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // POST — toggle permiso (habilitar/deshabilitar)
  if (req.method === "POST") {
    const { usuario_id, modulo_id, habilitado } = req.body;

    // Upsert: si existe actualiza, si no existe crea
    const { error } = await supabase
      .schema("portal")
      .from("usuario_modulos")
      .upsert({ usuario_id, modulo_id, habilitado }, { onConflict: "usuario_id,modulo_id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
