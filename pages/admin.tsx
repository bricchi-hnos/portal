import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "nicolas@bricchihnos.com";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  sector: string;
}
interface Dashboard {
  id: string;
  slug: string;
  area: string;
  dashboard_url: string;
  uploader_name: string;
  created_at: string;
}
interface Permiso {
  usuario_id: string;
  dashboard_id: string;
  habilitado: boolean;
}

function areaLabel(area: string) {
  const map: Record<string, string> = {
    "maquinarias": "🚜 Maquinarias",
    "repuestos": "🔧 Repuestos",
    "administracion/contable": "📒 Contable",
    "administracion/financiera": "📊 Financiera",
    "administracion/impositiva": "🧾 Impositiva",
    "administracion/rrhh": "👥 RRHH",
  };
  return map[area] || area;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoSector, setNuevoSector] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.email !== ADMIN_EMAIL) router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email === ADMIN_EMAIL) loadAll();
  }, [status, session]);

  async function loadAll() {
    setLoading(true);
    const [u, d, p] = await Promise.all([
      fetch("/api/admin/usuarios").then(r => r.json()),
      fetch("/api/admin/mis-dashboards").then(r => r.json()),
      fetch("/api/admin/permisos").then(r => r.json()),
    ]);
    setUsuarios(Array.isArray(u) ? u : []);
    setDashboards(Array.isArray(d) ? d : []);
    setPermisos(Array.isArray(p) ? p : []);
    setLoading(false);
  }

  function tienePermiso(usuarioId: string, dashboardId: string) {
    const p = permisos.find(x => x.usuario_id === usuarioId && x.dashboard_id === dashboardId);
    return p?.habilitado === true;
  }

  async function togglePermiso(usuarioId: string, dashboardId: string) {
    const key = `${usuarioId}-${dashboardId}`;
    setSaving(key);
    const actual = tienePermiso(usuarioId, dashboardId);
    await fetch("/api/admin/permisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: usuarioId, dashboard_id: dashboardId, habilitado: !actual }),
    });
    setPermisos(prev => {
      const exists = prev.find(x => x.usuario_id === usuarioId && x.dashboard_id === dashboardId);
      if (exists) return prev.map(x => x.usuario_id === usuarioId && x.dashboard_id === dashboardId ? { ...x, habilitado: !actual } : x);
      return [...prev, { usuario_id: usuarioId, dashboard_id: dashboardId, habilitado: !actual }];
    });
    setSaving(null);
  }

  async function agregarUsuario() {
    if (!nuevoEmail.trim()) return;
    setAgregando(true);
    setErrorMsg("");
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: nuevoEmail, nombre: nuevoNombre, sector: nuevoSector }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Error al agregar usuario");
    } else {
      setUsuarios(prev => [...prev, data]);
      setNuevoEmail(""); setNuevoNombre(""); setNuevoSector("");
    }
    setAgregando(false);
  }

  async function eliminarUsuario(id: string, email: string) {
    if (!confirm(`¿Eliminar usuario ${email}?`)) return;
    await fetch("/api/admin/usuarios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setUsuarios(prev => prev.filter(u => u.id !== id));
    setPermisos(prev => prev.filter(p => p.usuario_id !== id));
  }

  if (status === "loading" || loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6FA", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <p style={{ color: "#aaa" }}>Cargando...</p>
    </div>
  );

  if (session?.user?.email !== ADMIN_EMAIL) return null;

  // Agrupar dashboards por área
  const byArea: Record<string, Dashboard[]> = {};
  dashboards.forEach(d => {
    if (!byArea[d.area]) byArea[d.area] = [];
    byArea[d.area].push(d);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1a1a2e" }}>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "3px solid #C0392B",
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: "64px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "16px", fontWeight: "800", color: "#C0392B", letterSpacing: "0.5px" }}>BRICCHI HNOS.</span>
          <div style={{ width: "1px", height: "28px", background: "#e0e0e0" }} />
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#2C3E50" }}>Admin — Usuarios y Permisos</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a href="/" style={{ fontSize: "13px", color: "#7F8C8D", textDecoration: "none" }}>← Portal</a>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
            background: "transparent", border: "1px solid #ddd", borderRadius: "6px",
            color: "#7F8C8D", padding: "6px 14px", fontSize: "12px", cursor: "pointer",
          }}>Salir</button>
        </div>
      </header>

      <main style={{ padding: "32px", maxWidth: "1200px" }}>

        {/* Agregar usuario */}
        <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "24px", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#2C3E50", marginBottom: "16px" }}>➕ Agregar usuario</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr auto", gap: "12px", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "5px", textTransform: "uppercase" }}>Email *</label>
              <input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)}
                placeholder="usuario@bricchihnos.com"
                style={{ width: "100%", boxSizing: "border-box", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px", color: "#2C3E50", padding: "9px 12px", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "5px", textTransform: "uppercase" }}>Nombre</label>
              <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Nombre completo"
                style={{ width: "100%", boxSizing: "border-box", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px", color: "#2C3E50", padding: "9px 12px", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#7F8C8D", marginBottom: "5px", textTransform: "uppercase" }}>Sector</label>
              <input type="text" value={nuevoSector} onChange={e => setNuevoSector(e.target.value)}
                placeholder="Ej: Ventas"
                style={{ width: "100%", boxSizing: "border-box", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px", color: "#2C3E50", padding: "9px 12px", fontSize: "13px" }} />
            </div>
            <button onClick={agregarUsuario} disabled={!nuevoEmail.trim() || agregando}
              style={{
                padding: "9px 20px", border: "none", borderRadius: "8px",
                background: nuevoEmail.trim() ? "#C0392B" : "#e8e8e8",
                color: nuevoEmail.trim() ? "#fff" : "#aaa",
                fontSize: "13px", fontWeight: "700",
                cursor: nuevoEmail.trim() ? "pointer" : "not-allowed",
              }}>
              {agregando ? "..." : "Agregar"}
            </button>
          </div>
          {errorMsg && <p style={{ color: "#C0392B", fontSize: "12px", marginTop: "8px" }}>⚠️ {errorMsg}</p>}
        </div>

        {/* Matriz de permisos */}
        <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#2C3E50", marginBottom: "4px" }}>🔐 Permisos por usuario</h2>
          <p style={{ fontSize: "12px", color: "#aaa", marginBottom: "20px" }}>Tildá los dashboards que puede ver cada usuario. Los cambios se guardan al instante.</p>

          {usuarios.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: "13px" }}>No hay usuarios cargados todavía.</p>
          ) : dashboards.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: "13px" }}>No hay dashboards publicados todavía.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "11px", color: "#7F8C8D", fontWeight: "700", textTransform: "uppercase", borderBottom: "2px solid #e8e8e8", minWidth: "200px" }}>
                      Usuario
                    </th>
                    {dashboards.map(d => (
                      <th key={d.id} style={{ textAlign: "center", padding: "8px 6px", fontSize: "10px", color: "#7F8C8D", fontWeight: "700", borderBottom: "2px solid #e8e8e8", minWidth: "90px" }}>
                        <div style={{ fontSize: "10px", color: "#aaa", marginBottom: "2px" }}>{areaLabel(d.area)}</div>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#2C3E50" }}>{d.slug}</div>
                      </th>
                    ))}
                    <th style={{ padding: "10px 8px", borderBottom: "2px solid #e8e8e8" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#2C3E50" }}>{u.nombre || u.email}</div>
                        <div style={{ fontSize: "11px", color: "#aaa" }}>{u.email}</div>
                        {u.sector && <div style={{ fontSize: "10px", color: "#bbb" }}>{u.sector}</div>}
                      </td>
                      {dashboards.map(d => {
                        const key = `${u.id}-${d.id}`;
                        const checked = tienePermiso(u.id, d.id);
                        const isSaving = saving === key;
                        return (
                          <td key={d.id} style={{ textAlign: "center", padding: "12px 6px", borderBottom: "1px solid #f0f0f0" }}>
                            <button
                              onClick={() => togglePermiso(u.id, d.id)}
                              disabled={isSaving}
                              title={checked ? "Quitar acceso" : "Dar acceso"}
                              style={{
                                width: "28px", height: "28px", border: "none", borderRadius: "6px",
                                cursor: isSaving ? "wait" : "pointer",
                                background: checked ? "#C0392B" : "#e8e8e8",
                                color: checked ? "#fff" : "#bbb",
                                fontSize: "14px", fontWeight: "700",
                                transition: "all 0.15s",
                              }}>
                              {isSaving ? "·" : checked ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "center" }}>
                        <button
                          onClick={() => eliminarUsuario(u.id, u.email)}
                          style={{ background: "transparent", border: "1px solid #f0f0f0", borderRadius: "6px", color: "#ccc", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = "#C0392B"; e.currentTarget.style.color = "#C0392B"; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = "#f0f0f0"; e.currentTarget.style.color = "#ccc"; }}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
