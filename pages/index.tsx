import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const LOGO_URL = "https://www.bricchihnos.com/assets/bricchi-hnos-logotype.png";
const DASHBOARDS_BASE = "https://dashboards-br.vercel.app";

const AREAS = [
  { value: "maquinarias",                label: "Maquinarias",   icon: "🚜", group: null },
  { value: "repuestos",                  label: "Repuestos",     icon: "🔧", group: null },
  { value: "motores",                    label: "Motores",  icon: "⚙️", group: null },
  { value: "comercial",                  label: "Comercial",     icon: "💼", group: null },
  { value: "administracion/contable",    label: "Contable",      icon: "📒", group: "Administración" },
  { value: "administracion/financiera",  label: "Financiera",    icon: "📊", group: "Administración" },
  { value: "administracion/impositiva",  label: "Impositiva",    icon: "🧾", group: "Administración" },
  { value: "administracion/rrhh",        label: "RRHH",          icon: "👥", group: "Administración" },
];

type DashboardType = "static" | "embed" | "app";
type Tab = "home" | "upload" | "audit";

interface AuditEntry {
  id: string; slug: string; area: string; dashboard_type: string;
  filename: string; uploader_name: string; uploader_email: string;
  dashboard_url: string; github_commit_sha: string;
  assets_count: number; created_at: string;
}

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej; r.readAsDataURL(file);
  });
}

const ALLOWED_EXT = [".html",".htm",".css",".js",".json",".csv",".png",".jpg",".jpeg",".svg",".webp",".gif"];

// Área label from value
function areaLabel(val: string) {
  const a = AREAS.find(x => x.value === val);
  return a ? `${a.icon} ${a.group ? a.group + " / " : ""}${a.label}` : val;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [dtype, setDtype] = useState<DashboardType>("static");
  const [area, setArea] = useState("maquinarias");
  const [slug, setSlug] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [useZip, setUseZip] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ url: string; commitSha: string } | null>(null);
  const [error, setError] = useState("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({
    maquinarias: true, repuestos: true, "Administración": true,
  });

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const onDropZip = useCallback((accepted: File[]) => {
    if (accepted[0]) { setZipFile(accepted[0]); setResult(null); setError(""); }
  }, []);
  const dzZip = useDropzone({ onDrop: onDropZip, accept: { "application/zip": [".zip"] }, maxFiles: 1 });

  const onDropFiles = useCallback((accepted: File[]) => {
    const valid = accepted.filter(f => ALLOWED_EXT.some(e => f.name.toLowerCase().endsWith(e)));
    setFiles(valid); setResult(null); setError("");
    const html = valid.find(f => f.name.endsWith(".html"));
    if (html && !slug) setSlug(slugify(html.name.replace(/\.html?$/, "")));
  }, [slug]);
  const dzFiles = useDropzone({ onDrop: onDropFiles });

  async function handleUpload() {
    setUploading(true); setError(""); setResult(null);
    try {
      let body: Record<string, any> = { type: dtype, area, slug: slugify(slug) };
      if (dtype === "static") {
        if (useZip) {
          if (!zipFile) throw new Error("Seleccioná un archivo ZIP");
          body.zipContent = await toBase64(zipFile);
        } else {
          if (!files.length) throw new Error("Seleccioná archivos");
          body.files = await Promise.all(files.map(async f => ({ path: f.name, content: await toBase64(f) })));
        }
      } else {
        if (!embedUrl.trim()) throw new Error("Ingresá la URL");
        body.embedUrl = embedUrl.trim();
        body.embedTitle = embedTitle.trim() || slug;
      }
      const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setResult(data);
      setFiles([]); setZipFile(null); setSlug(""); setEmbedUrl(""); setEmbedTitle("");
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function loadAudit() {
  setLoadingAudit(true);
  try { const r = await fetch("/api/admin/mis-dashboards"); setAuditLog(await r.json()); }
  catch { setAuditLog([]); }
  finally { setLoadingAudit(false); }
   }
  useEffect(() => { if (tab === "audit") loadAudit(); if (tab === "home") loadAudit(); }, [tab]);

  const canSubmit = !uploading && !!slug && (
    dtype !== "static" ? !!embedUrl.trim() : useZip ? !!zipFile : !!files.length
  );

  // Group audit by area for home view
  const byArea: Record<string, AuditEntry[]> = {};
  auditLog.forEach(e => {
    if (!byArea[e.area]) byArea[e.area] = [];
    byArea[e.area].push(e);
  });

  if (status === "loading" || !session) return null;

  const ROOT_AREAS = AREAS.filter(a => !a.group);
  const ADMIN_AREAS = AREAS.filter(a => a.group === "Administración");

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1a1a2e" }}>

      {/* Header */}
      <header style={{
        background: "#fff",
        borderBottom: "3px solid #C0392B",
        padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "64px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img src={LOGO_URL} alt="Bricchi Hnos." style={{ height: "36px", objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div style={{ width: "1px", height: "28px", background: "#e0e0e0" }} />
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#2C3E50" }}>Portal de Dashboards</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#7F8C8D" }}>{session.user?.name || session.user?.email}</span>
          {session.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
  <a href="/admin" style={{
    fontSize: "13px", color: "#C0392B", textDecoration: "none",
    fontWeight: "600", padding: "6px 14px",
    border: "1px solid #C0392B", borderRadius: "6px",
  }}>⚙️ Admin</a>
)}<button onClick={() => signOut({ callbackUrl: "/login" })} style={{
            background: "transparent", border: "1px solid #ddd", borderRadius: "6px",
            color: "#7F8C8D", padding: "6px 14px", fontSize: "12px", cursor: "pointer",
          }}>Salir</button>
        </div>
      </header>

      {/* Nav Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", display: "flex" }}>
        {([
          ["home",  "🏠  Inicio"],
          ["upload","📤  Publicar"],
          ["audit", "📋  Auditoría"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "transparent", border: "none",
            borderBottom: tab === t ? "3px solid #C0392B" : "3px solid transparent",
            color: tab === t ? "#C0392B" : "#7F8C8D",
            padding: "14px 20px", fontSize: "13px",
            fontWeight: tab === t ? "700" : "400",
            cursor: "pointer", transition: "color 0.15s",
          }}>{label}</button>
        ))}
      </div>

      <main style={{ padding: "32px", maxWidth: "900px" }}>

        {/* ── HOME ── */}
        {tab === "home" && (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#2C3E50", marginBottom: "6px" }}>
              Dashboards publicados
            </h2>
            <p style={{ color: "#7F8C8D", fontSize: "13px", marginBottom: "28px" }}>
              Hacé click en cualquier tablero para abrirlo en una nueva pestaña.
            </p>

            {loadingAudit ? (
              <p style={{ color: "#aaa" }}>Cargando...</p>
            ) : auditLog.length === 0 ? (
              <div style={{
                background: "#fff", border: "2px dashed #e0e0e0", borderRadius: "12px",
                padding: "48px", textAlign: "center",
              }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
                <p style={{ color: "#aaa", fontSize: "14px" }}>No hay dashboards publicados aún.</p>
                <button onClick={() => setTab("upload")} style={{
                  marginTop: "16px", background: "#C0392B", border: "none", borderRadius: "8px",
                  color: "#fff", padding: "10px 24px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                }}>Publicar el primero</button>
              </div>
            ) : (
              <>
                {/* Root areas */}
                {ROOT_AREAS.map(areaObj => {
                  const items = byArea[areaObj.value] || [];
                  const isOpen = expandedAreas[areaObj.value] !== false;
                  return (
                    <div key={areaObj.value} style={{ marginBottom: "24px" }}>
                      <button onClick={() => setExpandedAreas(p => ({ ...p, [areaObj.value]: !isOpen }))}
                        style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          background: "transparent", border: "none", cursor: "pointer",
                          fontSize: "15px", fontWeight: "700", color: "#2C3E50",
                          marginBottom: "12px", padding: 0,
                        }}>
                        <span style={{ color: "#C0392B" }}>{isOpen ? "▾" : "▸"}</span>
                        <span>{areaObj.icon} {areaObj.label}</span>
                        <span style={{ fontSize: "11px", color: "#aaa", fontWeight: "400" }}>({items.length})</span>
                      </button>
                      {isOpen && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                          {items.length === 0 ? (
                            <p style={{ color: "#ccc", fontSize: "13px", gridColumn: "1/-1" }}>Sin dashboards en esta área.</p>
                          ) : items.map(e => (
                            <a key={e.id} href={e.dashboard_url} target="_blank" rel="noreferrer"
                              style={{ textDecoration: "none" }}>
                              <div style={{
                                background: "#fff", border: "1px solid #e8e8e8", borderRadius: "10px",
                                padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
                                borderLeft: "4px solid #C0392B",
                              }}
                                onMouseOver={e2 => (e2.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
                                onMouseOut={e2 => (e2.currentTarget.style.boxShadow = "none")}
                              >
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#2C3E50", marginBottom: "4px" }}>{e.slug}</div>
                                <div style={{ fontSize: "11px", color: "#aaa" }}>
                                  {e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: es }) : "—"}
                                </div>
                                <div style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>por {e.uploader_name}</div>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Administración group */}
                {ADMIN_AREAS.some(a => (byArea[a.value] || []).length > 0) && (
                  <div style={{ marginBottom: "24px" }}>
                    <button onClick={() => setExpandedAreas(p => ({ ...p, "Administración": !(p["Administración"] !== false) }))}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        background: "transparent", border: "none", cursor: "pointer",
                        fontSize: "15px", fontWeight: "700", color: "#2C3E50",
                        marginBottom: "12px", padding: 0,
                      }}>
                      <span style={{ color: "#C0392B" }}>{expandedAreas["Administración"] !== false ? "▾" : "▸"}</span>
                      <span>🏢 Administración</span>
                    </button>
                    {expandedAreas["Administración"] !== false && ADMIN_AREAS.map(areaObj => {
                      const items = byArea[areaObj.value] || [];
                      if (!items.length) return null;
                      return (
                        <div key={areaObj.value} style={{ marginLeft: "20px", marginBottom: "16px" }}>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#7F8C8D", marginBottom: "8px" }}>
                            {areaObj.icon} {areaObj.label}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                            {items.map(e => (
                              <a key={e.id} href={e.dashboard_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                                <div style={{
                                  background: "#fff", border: "1px solid #e8e8e8", borderRadius: "10px",
                                  padding: "12px 14px", cursor: "pointer",
                                  borderLeft: "4px solid #F39C12",
                                }}
                                  onMouseOver={e2 => (e2.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
                                  onMouseOut={e2 => (e2.currentTarget.style.boxShadow = "none")}
                                >
                                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#2C3E50", marginBottom: "4px" }}>{e.slug}</div>
                                  <div style={{ fontSize: "11px", color: "#aaa" }}>
                                    {e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: es }) : "—"}
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── UPLOAD ── */}
        {tab === "upload" && (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#2C3E50", marginBottom: "6px" }}>Publicar nuevo dashboard</h2>
            <p style={{ color: "#7F8C8D", fontSize: "13px", marginBottom: "24px" }}>
              Elegí el tipo, completá los datos y publicá. Se despliega automáticamente via GitHub (~60s).
            </p>

            {/* Type selector */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px" }}>
              {([
                ["static","📁","ZIP / HTML","Dashboard estático con index.html"],
                ["embed","🔗","Embed link","Power BI, Excel Online, OneDrive"],
                ["app","🚀","App externa","Streamlit, Metabase u otra URL"],
              ] as [DashboardType,string,string,string][]).map(([val,icon,label,desc]) => (
                <button key={val} onClick={() => setDtype(val)} style={{
                  background: dtype === val ? "#FEF9F0" : "#fff",
                  border: `2px solid ${dtype === val ? "#C0392B" : "#e8e8e8"}`,
                  borderRadius: "10px", padding: "14px", cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: "22px", marginBottom: "6px" }}>{icon}</div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: dtype === val ? "#C0392B" : "#2C3E50", marginBottom: "3px" }}>{label}</div>
                  <div style={{ fontSize: "11px", color: "#aaa" }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Area + Slug */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Área</label>
                <select value={area} onChange={e => setArea(e.target.value)} style={{
                  width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: "8px",
                  color: "#2C3E50", padding: "10px 12px", fontSize: "13px",
                }}>
                  {ROOT_AREAS.map(a => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                  <optgroup label="Administración">
                    {ADMIN_AREAS.map(a => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Nombre (slug)</label>
                <input type="text" value={slug} onChange={e => setSlug(slugify(e.target.value))}
                  placeholder="ej: ventas-mensual" style={{
                    width: "100%", boxSizing: "border-box", background: "#fff",
                    border: "1px solid #ddd", borderRadius: "8px", color: "#2C3E50",
                    padding: "10px 12px", fontSize: "13px",
                  }} />
                {slug && <p style={{ color: "#aaa", fontSize: "11px", marginTop: "4px" }}>URL: /{area}/{slug}/</p>}
              </div>
            </div>

            {/* Static */}
            {dtype === "static" && (
              <>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {[true, false].map(z => (
                    <button key={String(z)} onClick={() => setUseZip(z)} style={{
                      padding: "7px 16px", borderRadius: "6px", fontSize: "12px", cursor: "pointer",
                      background: useZip === z ? "#FEF9F0" : "#fff",
                      border: `1px solid ${useZip === z ? "#C0392B" : "#ddd"}`,
                      color: useZip === z ? "#C0392B" : "#7F8C8D", fontWeight: useZip === z ? "600" : "400",
                    }}>
                      {z ? "📦 Subir ZIP (recomendado)" : "📄 Archivos individuales"}
                    </button>
                  ))}
                </div>

                <div {...(useZip ? dzZip.getRootProps() : dzFiles.getRootProps())} style={{
                  border: `2px dashed ${(useZip ? dzZip.isDragActive : dzFiles.isDragActive) ? "#C0392B" : "#ddd"}`,
                  borderRadius: "12px", padding: "40px", textAlign: "center", cursor: "pointer",
                  background: (useZip ? dzZip.isDragActive : dzFiles.isDragActive) ? "#FEF9F0" : "#fafafa",
                  marginBottom: "14px", transition: "all 0.15s",
                }}>
                  <input {...(useZip ? dzZip.getInputProps() : dzFiles.getInputProps())} />
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>
                    {useZip ? (zipFile ? "📦" : "⬆️") : (files.length ? "📁" : "⬆️")}
                  </div>
                  {useZip ? (
                    zipFile
                      ? <p style={{ color: "#27AE60", fontSize: "14px", fontWeight: "600" }}>{zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)</p>
                      : <><p style={{ color: "#2C3E50", fontSize: "14px", marginBottom: "4px" }}>Arrastrá el ZIP o hacé click</p>
                        <p style={{ color: "#aaa", fontSize: "12px" }}>El ZIP debe tener index.html en la raíz</p></>
                  ) : (
                    files.length
                      ? files.map(f => <p key={f.name} style={{ color: "#2C3E50", fontSize: "13px", margin: "2px 0" }}>{f.name}</p>)
                      : <><p style={{ color: "#2C3E50", fontSize: "14px", marginBottom: "4px" }}>Arrastrá archivos o hacé click</p>
                        <p style={{ color: "#aaa", fontSize: "12px" }}>.html .css .js .json .csv .png .jpg .svg</p></>
                  )}
                </div>
              </>
            )}

            {/* Embed/App */}
            {(dtype === "embed" || dtype === "app") && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {dtype === "embed" ? "URL del embed" : "URL de la aplicación"}
                  </label>
                  <input type="url" value={embedUrl} onChange={e => setEmbedUrl(e.target.value)}
                    placeholder="https://..." style={{
                      width: "100%", boxSizing: "border-box", background: "#fff",
                      border: "1px solid #ddd", borderRadius: "8px", color: "#2C3E50",
                      padding: "10px 12px", fontSize: "13px",
                    }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Título</label>
                  <input type="text" value={embedTitle} onChange={e => setEmbedTitle(e.target.value)}
                    placeholder={slug || "Nombre visible"} style={{
                      width: "100%", boxSizing: "border-box", background: "#fff",
                      border: "1px solid #ddd", borderRadius: "8px", color: "#2C3E50",
                      padding: "10px 12px", fontSize: "13px",
                    }} />
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "#FDF2F2", border: "1px solid #F5C6CB", borderRadius: "8px", padding: "12px 16px", color: "#C0392B", fontSize: "13px", marginBottom: "14px" }}>
                ⚠️ {error}
              </div>
            )}
            {result && (
              <div style={{ background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: "8px", padding: "16px", marginBottom: "14px" }}>
                <p style={{ color: "#27AE60", fontSize: "14px", fontWeight: "700", marginBottom: "6px" }}>✅ Publicado. Deploy en curso (~60s)</p>
                <a href={result.url} target="_blank" rel="noreferrer" style={{ color: "#C0392B", fontSize: "13px" }}>{result.url}</a>
                <p style={{ color: "#aaa", fontSize: "11px", marginTop: "4px" }}>Commit: {result.commitSha.slice(0, 8)}</p>
              </div>
            )}

            <button onClick={handleUpload} disabled={!canSubmit} style={{
              width: "100%", padding: "14px", border: "none", borderRadius: "10px",
              background: canSubmit ? "#C0392B" : "#e8e8e8",
              color: canSubmit ? "#fff" : "#aaa",
              fontSize: "15px", fontWeight: "700",
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}>
              {uploading ? "⏳ Publicando..." : "🚀 Publicar dashboard"}
            </button>
          </>
        )}

        {/* ── AUDIT ── */}
        {tab === "audit" && (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#2C3E50", marginBottom: "6px" }}>Historial de publicaciones</h2>
            <p style={{ color: "#7F8C8D", fontSize: "13px", marginBottom: "24px" }}>Registro completo — quién publicó qué y cuándo.</p>
            {loadingAudit ? <p style={{ color: "#aaa" }}>Cargando...</p> :
              auditLog.length === 0 ? <p style={{ color: "#aaa" }}>No hay publicaciones aún.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {auditLog.map(e => (
                    <div key={e.id} style={{
                      background: "#fff", border: "1px solid #e8e8e8", borderRadius: "10px",
                      padding: "14px 18px", borderLeft: "4px solid #C0392B",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ background: "#FDF2F2", color: "#C0392B", fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: "600" }}>
                            {areaLabel(e.area)}
                          </span>
                          <a href={e.dashboard_url} target="_blank" rel="noreferrer"
                            style={{ color: "#2C3E50", fontSize: "14px", fontWeight: "700" }}>{e.slug} ↗</a>
                        </div>
                        <span style={{ color: "#aaa", fontSize: "12px", whiteSpace: "nowrap", marginLeft: "8px" }}>
                          {e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: es }) : "—"}
                        </span>
                      </div>
                      <div style={{ marginTop: "6px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <span style={{ color: "#7F8C8D", fontSize: "12px" }}>👤 {e.uploader_name}</span>
                        <span style={{ color: "#7F8C8D", fontSize: "12px" }}>📄 {e.filename}</span>
                        <span style={{ color: "#bbb", fontSize: "11px", fontFamily: "monospace" }}>{e.github_commit_sha?.slice(0, 8)}</span>
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
