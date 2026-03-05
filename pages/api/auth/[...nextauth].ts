import NextAuth, { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { createTransport } from "nodemailer";

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const transport = createTransport({
          host: process.env.EMAIL_SERVER_HOST,
          port: 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        });
        await transport.sendMail({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: "Acceso al portal de dashboards — Bricchi Hnos.",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d1520;color:#e2e8f0;border-radius:12px;">
              <h2 style="color:#c8971e;margin-bottom:8px;">Bricchi Hnos. — Dashboards</h2>
              <p style="color:#8a9bb0;margin-bottom:24px;">Hacé click en el botón para ingresar al portal.</p>
              <a href="${url}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#c8971e,#e8b840);color:#1a1a1a;font-weight:700;border-radius:8px;text-decoration:none;">
                Ingresar al portal
              </a>
              <p style="color:#4a5568;font-size:12px;margin-top:24px;">
                Este link es válido por 24 horas y de un solo uso.<br/>
                Si no solicitaste este acceso, ignorá este mensaje.
              </p>
            </div>
          `,
          text: `Ingresá al portal de dashboards: ${url}`,
        });
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const email = user.email?.toLowerCase() || "";
      return ALLOWED_EMAILS.includes(email);
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login",
  },
};

export default NextAuth(authOptions);
