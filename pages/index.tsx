import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Areas ────────────────────────────────────────────────────────────────────
const AREAS = [
  { value: "maquinarias",                label: "Maquinarias",   group: null },
  { value: "repuestos",                  label: "Repuestos",     group: null },
  { value: "administracion/contable",    label: "Contable",      group: "Administración" },
  { value: "administracion/financiera",  label: "Financiera",    group: "Administración" },
  { value: "administracion/impositiva",  label: "Impositiva",    group: "Administración" },
  { value: "administracion/rrhh",        label: "RRHH",          group: "Administración" },
];

type DashboardType = "static" | "embed" | "app";
type Tab = "upload" | "audit";

interface AuditEntry {
  id: string; slug: string; area: string; dashboard_type: string;
  filename: string; uploader_name: string; uploader_email: string;
  dashboard_url: string; github_commit_sha: string;
  assets_count: number; created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text: string) {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const ALLOWED_EXT = [".html",".htm",".css",".js",".json",".csv",".png",".jpg",".jpeg",".svg",".webp",".gif"];

// ── Styles ────────────────────────────────────────────────────────────────────
const C = {
  page:    { minHeight:"100vh", background:"#0d1520", color:"#e2e8f0", fontFamily:"'Segoe UI', system-ui, sans-serif" } as React.CSSProperties,
  header:  { background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"60px" } as React.CSSProperties,
  main:    { padding:"40px 32px", maxWidth:"760px" } as React.CSSProperties,
  label:   { display:"block", fontSize:"12px", color:"#8a9bb0", marginBottom:"6px", textTransform:"uppercase" as const, letterSpacing:"0.5px" },
  input:   { width:"100%", boxSizing:"border-box" as const, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", color:"#e2e8f0", padding:"10px 12px", fontSize:"14px" },
  card:    { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"10px", padding:"16px 20px" } as React.CSSProperties,
};

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const map: Record<string, [string, string]> = {
    static: ["#3b82f6","ZIP / HTML"],
    embed:  ["#8b5cf6","Embed"],
    app:    ["#10b981","App"],
  };
  const [color, label] = map[type] || ["#6b7280", type];
  return (
    <span style={{ background:`${color}22`, color, fontSize:"11px", padding:"2px 8px", borderRadius:"4px", marginRight:"6px" }}>
      {label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab]           = useState<Tab>("upload");
  const [dtype, setDtype]       = useState<DashboardType>("static");
  const [area, setArea]         = useState("maquinarias");
  const [slug, setSlug]         = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");

  // Static upload state
  const [files, setFiles]       = useState<File[]>([]);
  const [zipFile, setZipFile]   = useState<File | null>(null);
  const [useZip, setUseZip]     = useState(true);

  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState<{ url: string; commitSha: string } | null>(null);
  const [error, setError]       = useState("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  // ── Dropzone for ZIP ──────────────────────────────────────────────────────
  const onDropZip = useCallback((accepted: File[]) => {
    if (accepted[0]) { setZipFile(accepted[0]); setResult(null); setError(""); }
  }, []);
  const dzZip = useDropzone({ onDrop: onDropZip, accept: { "application/zip": [".zip"] }, maxFiles: 1 });

  // ── Dropzone for individual files ─────────────────────────────────────────
  const onDropFiles = useCallback((accepted: File[]) => {
    const valid = accepted.filter(f => ALLOWED_EXT.some(e => f.name.toLowerCase().endsWith(e)));
    setFiles(valid); setResult(null); setError("");
    const html = valid.find(f => f.name.endsWith(".html"));
    if (html && !slug) setSlug(slugify(html.name.replace(/\.html?$/, "")));
  }, [slug]);
  const dzFiles = useDropzone({ onDrop: onDropFiles, accept: { "text/html":[".html",".htm"], "text/css":[".css"], "application/javascript":[".js"], "application/json":[".json"], "text/csv":[".csv"], "image/*":[".png",".jpg",".jpeg",".svg",".webp",".gif"] } });

  // ── Upload handler ────────────────────────────────────────────────────────
  async function handleUpload() {
    setUploading(true); setError(""); setResult(null);
    try {
      let body: Record<string, any> = { type: dtype, area, slug: slugify(slug) };

      if (dtype === "static") {
        if (useZip) {
          if (!zipFile) throw new Error("Seleccioná un archivo ZIP");
          const zipContent = await toBase64(zipFile);
          body.zipContent = zipContent;
        } else {
          if (!files.length) throw new Error("Seleccioná archivos");
          const encoded = await Promise.all(
            files.map(async f => ({ path: f.name, content: await toBase64(f) }))
          );
          body.files = encoded;
        }
      } else {
        if (!embedUrl.trim()) throw new Error("Ingresá la URL del embed");
        body.embedUrl   = embedUrl.trim();
        body.embedTitle = embedTitle.trim() || slug;
      }

      const res  = await fetch("/api/upload", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setResult(data);
      setFiles([]); setZipFile(null); setSlug(""); setEmbedUrl(""); setEmbedTitle("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function loadAudit() {
    setLoadingAudit(true);
    try { const r = await fetch("/api/audit"); setAuditLog(await r.json()); }
    catch { setAuditLog([]); }
    finally { setLoadingAudit(false); }
  }
  useEffect(() => { if (tab === "audit") loadAudit(); }, [tab]);

  const canSubmit = !uploading && !!slug && (
    dtype !== "static" ? !!embedUrl.trim() :
    useZip ? !!zipFile : !!files.length
  );

  if (status === "loading" || !session) return null;

  return (
    <div style={C.page}>
      {/* Header */}
      <header style={C.header}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ fontSize:"20px" }}>⚙️</span>
          <span style={{ fontWeight:"700", fontSize:"16px", color:"#f0e6d3" }}>Bricchi</span>
          <span style={{ color:"#4a5568", fontSize:"14px" }}>/ Dashboards</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
          <span style={{ color:"#8a9bb0", fontSize:"13px" }}>{session.user?.name || session.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl:"/login" })} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"6px", color:"#8a9bb0", padding:"6px 12px", fontSize:"12px", cursor:"pointer" }}>
            Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"0 32px", display:"flex" }}>
        {(["upload","audit"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background:"transparent", border:"none", borderBottom: tab===t ? "2px solid #c8971e" : "2px solid transparent", color: tab===t ? "#c8971e" : "#6b7280", padding:"16px 20px", fontSize:"14px", fontWeight: tab===t ? "600":"400", cursor:"pointer" }}>
            {t === "upload" ? "📤  Publicar Dashboard" : "📋  Auditoría"}
          </button>
        ))}
      </div>

      <main style={C.main}>
        {tab === "upload" && (
          <>
            <h2 style={{ fontSize:"22px", fontWeight:"700", marginBottom:"6px", color:"#f0e6d3" }}>Publicar nuevo dashboard</h2>
            <p style={{ color:"#6b7280", fontSize:"14px", marginBottom:"28px" }}>Elegí el tipo y completá los datos. Se publica automáticamente via GitHub.</p>

            {/* Type selector */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"24px" }}>
              {([
                ["static","📁","ZIP / HTML","Subí un ZIP con index.html + assets"],
                ["embed","🔗","Embed link","Power BI, Excel Online, OneDrive..."],
                ["app","🚀","App externa","Streamlit, Metabase, cualquier URL"],
              ] as [DashboardType,string,string,string][]).map(([val,icon,label,desc]) => (
                <button key={val} onClick={() => setDtype(val)} style={{
                  background: dtype===val ? "rgba(200,151,30,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${dtype===val ? "#c8971e" : "rgba(255,255,255,0.08)"}`,
                  borderRadius:"10px", padding:"14px 12px", cursor:"pointer", textAlign:"left",
                }}>
                  <div style={{ fontSize:"20px", marginBottom:"6px" }}>{icon}</div>
                  <div style={{ color: dtype===val ? "#c8971e" : "#e2e8f0", fontSize:"13px", fontWeight:"600", marginBottom:"3px" }}>{label}</div>
                  <div style={{ color:"#4a5568", fontSize:"11px" }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Area + Slug */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"20px" }}>
              <div>
                <label style={C.label}>Área</label>
                <select value={area} onChange={e => setArea(e.target.value)} style={C.input}>
                  {AREAS.filter(a => !a.group).map(a => (
                    <option key={a.value} value={a.value} style={{ background:"#1a2940" }}>{a.label}</option>
                  ))}
                  {(() => {
                    const groups = Array.from(new Set(AREAS.filter(a => a.group).map(a => a.group)));
                    return groups.map(g => (
                      <optgroup key={g} label={g!} style={{ background:"#1a2940" }}>
                        {AREAS.filter(a => a.group === g).map(a => (
                          <option key={a.value} value={a.value} style={{ background:"#1a2940" }}>{a.label}</option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>
              <div>
                <label style={C.label}>Nombre (slug)</label>
                <input type="text" value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="ej: ventas-mensual" style={C.input} />
                {slug && <p style={{ color:"#4a5568", fontSize:"11px", marginTop:"4px" }}>URL: /{area}/{slug}/</p>}
              </div>
            </div>

            {/* Static upload */}
            {dtype === "static" && (
              <>
                {/* Toggle ZIP / files */}
                <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
                  {[true, false].map(z => (
                    <button key={String(z)} onClick={() => setUseZip(z)} style={{
                      padding:"7px 16px", borderRadius:"6px", fontSize:"13px", cursor:"pointer",
                      background: useZip===z ? "rgba(200,151,30,0.15)" : "transparent",
                      border: `1px solid ${useZip===z ? "#c8971e" : "rgba(255,255,255,0.1)"}`,
                      color: useZip===z ? "#c8971e" : "#6b7280",
                    }}>
                      {z ? "📦 Subir ZIP (recomendado)" : "📄 Archivos individuales"}
                    </button>
                  ))}
                </div>

                {useZip ? (
                  <div {...dzZip.getRootProps()} style={{
                    border:`2px dashed ${dzZip.isDragActive ? "#c8971e" : "rgba(255,255,255,0.12)"}`,
                    borderRadius:"12px", padding:"40px", textAlign:"center", cursor:"pointer",
                    background: dzZip.isDragActive ? "rgba(200,151,30,0.05)" : "rgba(255,255,255,0.02)",
                    marginBottom:"16px", transition:"all 0.2s",
                  }}>
                    <input {...dzZip.getInputProps()} />
                    <div style={{ fontSize:"32px", marginBottom:"10px" }}>{zipFile ? "📦" : "⬆️"}</div>
                    {zipFile ? (
                      <p style={{ color:"#4ade80", fontSize:"14px" }}>{zipFile.name} ({(zipFile.size/1024).toFixed(1)} KB)</p>
                    ) : (
                      <>
                        <p style={{ color:"#e2e8f0", fontSize:"14px", marginBottom:"4px" }}>Arrastrá el ZIP o hacé click</p>
                        <p style={{ color:"#4a5568", fontSize:"12px" }}>El ZIP debe tener index.html en la raíz</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div {...dzFiles.getRootProps()} style={{
                    border:`2px dashed ${dzFiles.isDragActive ? "#c8971e" : "rgba(255,255,255,0.12)"}`,
                    borderRadius:"12px", padding:"40px", textAlign:"center", cursor:"pointer",
                    background: dzFiles.isDragActive ? "rgba(200,151,30,0.05)" : "rgba(255,255,255,0.02)",
                    marginBottom:"16px",
                  }}>
                    <input {...dzFiles.getInputProps()} />
                    <div style={{ fontSize:"32px", marginBottom:"10px" }}>📁</div>
                    <p style={{ color:"#e2e8f0", fontSize:"14px", marginBottom:"4px" }}>Arrastrá archivos o hacé click</p>
                    <p style={{ color:"#4a5568", fontSize:"12px" }}>.html .css .js .json .csv .png .jpg .svg</p>
                  </div>
                )}

                {!useZip && files.length > 0 && (
                  <div style={{ ...C.card, marginBottom:"16px" }}>
                    {files.map(f => (
                      <div key={f.name} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", fontSize:"13px", color:"#8a9bb0" }}>
                        <span>{f.name}</span><span>{(f.size/1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Embed / App */}
            {(dtype === "embed" || dtype === "app") && (
              <div style={{ marginBottom:"16px" }}>
                <div style={{ marginBottom:"14px" }}>
                  <label style={C.label}>{dtype === "embed" ? "URL del embed (Power BI, Excel Online...)" : "URL de la aplicación (Streamlit, Metabase...)"}</label>
                  <input type="url" value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} placeholder="https://..." style={C.input} />
                </div>
                <div>
                  <label style={C.label}>Título del dashboard</label>
                  <input type="text" value={embedTitle} onChange={e => setEmbedTitle(e.target.value)} placeholder={slug || "Nombre visible en el header"} style={C.input} />
                </div>
                <div style={{ marginTop:"12px", background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", borderRadius:"8px", padding:"12px 14px" }}>
                  <p style={{ color:"#a78bfa", fontSize:"12px" }}>
                    Se va a generar un <strong>wrapper HTML</strong> con iframe + sandbox en <code style={{ background:"rgba(255,255,255,0.05)", padding:"1px 4px", borderRadius:"3px" }}>/{area}/{slug}/</code>.
                    La URL original queda encapsulada con header de Bricchi.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background:"rgba(220,53,69,0.1)", border:"1px solid rgba(220,53,69,0.3)", borderRadius:"8px", padding:"12px 16px", color:"#ff8a8a", fontSize:"13px", marginBottom:"16px" }}>
                ⚠️ {error}
              </div>
            )}

            {result && (
              <div style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:"8px", padding:"16px", marginBottom:"16px" }}>
                <p style={{ color:"#4ade80", fontSize:"14px", fontWeight:"600", marginBottom:"6px" }}>✅ Publicado. Deploy en curso (~60s en Vercel)</p>
                <a href={result.url} target="_blank" rel="noreferrer" style={{ color:"#c8971e", fontSize:"13px", wordBreak:"break-all" }}>{result.url}</a>
                <p style={{ color:"#374151", fontSize:"11px", marginTop:"6px" }}>Commit: {result.commitSha.slice(0,8)}</p>
              </div>
            )}

            <button onClick={handleUpload} disabled={!canSubmit} style={{
              width:"100%", padding:"14px", border:"none", borderRadius:"10px",
              background: canSubmit ? "linear-gradient(135deg,#c8971e,#e8b840)" : "rgba(255,255,255,0.05)",
              color: canSubmit ? "#1a1a1a" : "#4a5568",
              fontSize:"15px", fontWeight:"700",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}>
              {uploading ? "⏳ Publicando..." : "🚀 Publicar dashboard"}
            </button>
          </>
        )}

        {tab === "audit" && (
          <>
            <h2 style={{ fontSize:"22px", fontWeight:"700", marginBottom:"6px", color:"#f0e6d3" }}>Historial de publicaciones</h2>
            <p style={{ color:"#6b7280", fontSize:"14px", marginBottom:"28px" }}>Registro completo — quién subió qué y cuándo.</p>

            {loadingAudit ? <p style={{ color:"#4a5568" }}>Cargando...</p> :
             auditLog.length === 0 ? <p style={{ color:"#4a5568" }}>No hay publicaciones aún.</p> : (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {auditLog.map(e => (
                  <div key={e.id} style={C.card}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:"4px" }}>
                        <TypeBadge type={e.dashboard_type} />
                        <span style={{ background:"rgba(200,151,30,0.15)", color:"#c8971e", fontSize:"11px", padding:"2px 8px", borderRadius:"4px" }}>{e.area}</span>
                        <a href={e.dashboard_url} target="_blank" rel="noreferrer" style={{ color:"#e2e8f0", fontSize:"14px", fontWeight:"600", marginLeft:"4px" }}>{e.slug}</a>
                      </div>
                      <span style={{ color:"#4a5568", fontSize:"12px", whiteSpace:"nowrap", marginLeft:"8px" }}>
                        {e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix:true, locale:es }) : "—"}
                      </span>
                    </div>
                    <div style={{ marginTop:"8px", display:"flex", gap:"16px", flexWrap:"wrap" }}>
                      <span style={{ color:"#6b7280", fontSize:"12px" }}>👤 {e.uploader_name}</span>
                      <span style={{ color:"#6b7280", fontSize:"12px" }}>📄 {e.filename}{e.assets_count > 0 && ` + ${e.assets_count} assets`}</span>
                      <span style={{ color:"#374151", fontSize:"11px", fontFamily:"monospace" }}>{e.github_commit_sha?.slice(0,8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
