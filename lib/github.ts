import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const OWNER  = process.env.GITHUB_OWNER!;
const REPO   = process.env.GITHUB_REPO!;
const BRANCH = process.env.GITHUB_BRANCH || "main";

export type DashboardType = "static" | "embed" | "app";

export interface StaticFile {
  path: string;   // relative path inside slug folder, e.g. "index.html" or "assets/chart.js"
  content: string; // base64
}

export interface PublishOptions {
  type: DashboardType;
  area: string;       // e.g. "maquinarias" or "administracion/contable"
  slug: string;       // e.g. "ventas-mensual"
  uploaderEmail: string;
  // For static dashboards
  files?: StaticFile[];
  // For embed/app dashboards
  embedUrl?: string;
  embedTitle?: string;
}

// Allowed extensions for static uploads
export const ALLOWED_EXTENSIONS = [
  ".html", ".htm", ".css", ".js", ".json",
  ".csv", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif",
];

export function validateExtension(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function generateEmbedHtml(url: string, title: string, type: DashboardType): string {
  const label = type === "embed" ? "Dashboard embebido" : "Aplicación externa";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Bricchi Hnos.</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d1520; font-family: sans-serif; }
    .header {
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header span { color: #c8971e; font-weight: 700; font-size: 14px; }
    .header small { color: #4a5568; font-size: 12px; }
    iframe {
      width: 100%;
      height: calc(100vh - 45px);
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <span>⚙️ Bricchi Hnos.</span>
    <small>/ ${title}</small>
    <small style="margin-left:auto;color:#374151;">${label}</small>
  </div>
  <iframe
    src="${url}"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    allow="fullscreen"
    title="${title}"
  ></iframe>
</body>
</html>`;
}

async function getLatestCommitSha(): Promise<string> {
  const { data } = await octokit.rest.git.getRef({
    owner: OWNER, repo: REPO, ref: `heads/${BRANCH}`,
  });
  return data.object.sha;
}

async function getBaseTreeSha(commitSha: string): Promise<string> {
  const { data } = await octokit.rest.git.getCommit({
    owner: OWNER, repo: REPO, commit_sha: commitSha,
  });
  return data.tree.sha;
}

export async function publishDashboard(
  opts: PublishOptions
): Promise<{ commitSha: string; url: string }> {
  const { type, area, slug, uploaderEmail } = opts;
  const prefix = `${area}/${slug}`;

  let filesToCommit: StaticFile[] = [];

  if (type === "static") {
    if (!opts.files?.length) throw new Error("No hay archivos para subir");
    filesToCommit = opts.files.map((f) => ({
      path: f.path,
      content: f.content,
    }));
  } else {
    // embed or app — generate wrapper index.html
    const html = generateEmbedHtml(
      opts.embedUrl!,
      opts.embedTitle || slug,
      type
    );
    const b64 = Buffer.from(html).toString("base64");
    filesToCommit = [{ path: "index.html", content: b64 }];
  }

  const latestSha = await getLatestCommitSha();
  const baseTreeSha = await getBaseTreeSha(latestSha);

  // Create blobs
  const treeItems = await Promise.all(
    filesToCommit.map(async (f) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner: OWNER, repo: REPO,
        content: f.content,
        encoding: "base64",
      });
      return {
        path: `${prefix}/${f.path}`,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  const { data: newTree } = await octokit.rest.git.createTree({
    owner: OWNER, repo: REPO,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner: OWNER, repo: REPO,
    message: `dashboard(${type}): ${area}/${slug} — ${uploaderEmail}`,
    tree: newTree.sha,
    parents: [latestSha],
  });

  await octokit.rest.git.updateRef({
    owner: OWNER, repo: REPO,
    ref: `heads/${BRANCH}`,
    sha: newCommit.sha,
  });

  const url = `${process.env.DASHBOARDS_BASE_URL}/${area}/${slug}/`;
  return { commitSha: newCommit.sha, url };
}
