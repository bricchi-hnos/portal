import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { publishDashboard, validateExtension, DashboardType } from "../../lib/github";
import { logUpload } from "../../lib/supabase";
import { extractZip } from "../../lib/zip";

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autorizado" });

  const { type, area, slug: rawSlug, files, zipContent, embedUrl, embedTitle } = req.body as {
    type: DashboardType;
    area: string;
    slug: string;
    files?: { path: string; content: string }[];
    zipContent?: string;
    embedUrl?: string;
    embedTitle?: string;
  };

  const slug = slugify(rawSlug || "");
  if (!slug) return res.status(400).json({ error: "Slug inválido" });
  if (!area)  return res.status(400).json({ error: "Área requerida" });

  try {
    let resolvedFiles: { path: string; content: string }[] = [];
    let filename = "";
    let assetsCount = 0;

    if (type === "static") {
      if (zipContent) {
        // ZIP upload
        resolvedFiles = await extractZip(zipContent);
        filename = "dashboard.zip (extraído)";
      } else if (files?.length) {
        // Individual files upload
        for (const f of files) {
          if (!validateExtension(f.path)) {
            return res.status(400).json({ error: `Extensión no permitida: ${f.path}` });
          }
        }
        resolvedFiles = files;
        filename = files.find((f) => f.path.endsWith(".html"))?.path || files[0].path;
      } else {
        return res.status(400).json({ error: "Se requiere ZIP o archivos para dashboard estático" });
      }
      assetsCount = resolvedFiles.filter((f) => !f.path.endsWith(".html")).length;

    } else if (type === "embed" || type === "app") {
      if (!embedUrl) return res.status(400).json({ error: "URL de embed requerida" });
      filename = embedUrl;
    } else {
      return res.status(400).json({ error: "Tipo de dashboard inválido" });
    }

    const { commitSha, url } = await publishDashboard({
      type,
      area,
      slug,
      uploaderEmail: session.user.email,
      files: resolvedFiles,
      embedUrl,
      embedTitle: embedTitle || slug,
    });

    await logUpload({
      slug,
      area,
      dashboard_type: type,
      filename,
      uploader_email: session.user.email,
      uploader_name: session.user.name || session.user.email,
      github_commit_sha: commitSha,
      dashboard_url: url,
      assets_count: assetsCount,
    });

    return res.status(200).json({ url, commitSha });
  } catch (err: any) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message || "Error al publicar" });
  }
}
