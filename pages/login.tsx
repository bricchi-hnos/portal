import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const verified = router.query.verify === "1";

  useEffect(() => {
    if (session) router.push("/");
  }, [session, router]);

  if (status === "loading") return null;

  async function handleSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const result = await signIn("email", {
      email: email.trim().toLowerCase(),
      redirect: false,
      callbackUrl: "/",
    });
    setLoading(false);
    if (result?.error) {
      setError("Este email no está habilitado para acceder al portal.");
    } else {
      setSent(true);
    }
  }

  const S: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f1923 0%, #1a2940 50%, #0f1923 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    },
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px",
      padding: "48px 52px",
      textAlign: "center",
      maxWidth: "400px",
      width: "100%",
      backdropFilter: "blur(20px)",
    },
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚙️</div>
        <h1 style={{ color: "#f0e6d3", fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>
          Bricchi Hnos.
        </h1>
        <p style={{ color: "#8a9bb0", fontSize: "14px", marginBottom: "36px" }}>
          Portal de Dashboards Internos
        </p>

        {verified || sent ? (
          <div style={{
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: "10px",
            padding: "20px",
          }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>📧</div>
            <p style={{ color: "#4ade80", fontWeight: "600", marginBottom: "8px" }}>
              ¡Revisá tu email!
            </p>
            <p style={{ color: "#6b7280", fontSize: "13px" }}>
              Te enviamos un link de acceso a <strong style={{ color: "#8a9bb0" }}>{email || "tu email"}</strong>.
              Válido por 24 horas.
            </p>
          </div>
        ) : (
          <>
            {router.query.error && (
              <div style={{
                background: "rgba(220,53,69,0.15)", border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: "8px", padding: "12px", marginBottom: "20px",
                color: "#ff8a8a", fontSize: "13px",
              }}>
                Acceso denegado. Tu email no está habilitado.
              </div>
            )}
            {error && (
              <div style={{
                background: "rgba(220,53,69,0.15)", border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: "8px", padding: "12px", marginBottom: "20px",
                color: "#ff8a8a", fontSize: "13px",
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: "12px", textAlign: "left" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#8a9bb0", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="tu@email.com"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "#e2e8f0",
                  padding: "11px 14px", fontSize: "14px",
                }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!email.trim() || loading}
              style={{
                width: "100%", padding: "13px",
                background: email.trim() && !loading
                  ? "linear-gradient(135deg, #c8971e, #e8b840)"
                  : "rgba(255,255,255,0.06)",
                border: "none", borderRadius: "10px",
                color: email.trim() && !loading ? "#1a1a1a" : "#4a5568",
                fontSize: "14px", fontWeight: "700",
                cursor: email.trim() && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Enviando..." : "Enviar link de acceso"}
            </button>

            <p style={{ color: "#374151", fontSize: "12px", marginTop: "20px" }}>
              Solo empleados de Bricchi Hnos. S.A.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
