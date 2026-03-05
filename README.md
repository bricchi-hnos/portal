# Bricchi Dashboard Portal

Portal interno para publicar dashboards HTML sin tocar GitHub ni Vercel.

## Arquitectura

```
[Portal Next.js] → GitHub API → [Repo: bricchi-hnos/dashboards]
                                         ↓ auto-deploy
                              [Vercel: dashboards.bricchi.com]
                                         ↓
                                   URL estable por área/slug

[Supabase] ← logs de auditoría (quién subió qué y cuándo)
```

## Setup paso a paso

### 1. Crear el repo de dashboards en GitHub

1. Crear repo `bricchi-hnos/dashboards` (privado o público según preferencia)
2. Agregar un `index.html` vacío en la raíz para que no esté vacío
3. Copiar `dashboards-repo-vercel.json` como `vercel.json` en ese repo
4. Conectar ese repo a un proyecto en Vercel con dominio `dashboards.bricchi.com`

### 2. Crear GitHub Token de servicio

1. En GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
2. Permisos mínimos: `Contents: Read and write` en el repo `dashboards`
3. Guardar el token como `GITHUB_TOKEN`

### 3. Configurar Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0
2. Authorized redirect URIs: `https://portal.bricchi.com/api/auth/callback/google`
3. Guardar Client ID y Secret

### 4. Supabase: crear tabla de auditoría

Ejecutar el contenido de `supabase-migration.sql` en el SQL Editor de Supabase.

### 5. Deploy del portal en Vercel

1. Hacer fork/push de este repo a GitHub
2. Importar en Vercel como nuevo proyecto
3. Configurar las variables de entorno (ver `.env.example`)
4. Deploy → dominio `portal.bricchi.com`

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `NEXTAUTH_URL` | URL del portal (ej: https://portal.bricchi.com) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `GITHUB_TOKEN` | PAT con permisos en el repo dashboards |
| `GITHUB_OWNER` | Org/usuario de GitHub (ej: bricchi-hnos) |
| `GITHUB_REPO` | Nombre del repo (ej: dashboards) |
| `GITHUB_BRANCH` | Rama (main) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NO anon) |
| `ALLOWED_EMAILS` | Emails habilitados separados por coma |
| `DASHBOARDS_BASE_URL` | URL base del repo deployado |

## URLs resultantes

- Portal: `https://portal.bricchi.com`
- Dashboard maquinaria: `https://dashboards.bricchi.com/maquinaria/ventas-mensual/`
- Dashboard finanzas: `https://dashboards.bricchi.com/finanzas/flujo-caja/`

## Seguridad

- Login con Google SSO, whitelist de emails (o dominio @bricchi.com)
- Dashboards en dominio separado (`dashboards.` vs `portal.`)
- CSP headers en ambos dominios
- RLS en Supabase: solo la app puede leer/escribir auditoría
- GitHub token con permisos mínimos (solo ese repo)
- `noindex, nofollow` en el portal

## Flujo del usuario (empleado)

1. Entra a `portal.bricchi.com` → login con Google
2. Elige área (Maquinaria, Repuestos, Finanzas...)
3. Escribe un nombre (ej: "ventas mensual" → slug automático)
4. Arrastra el HTML (+ assets opcionales)
5. Click "Publicar" → commit en GitHub → Vercel deploy automático
6. Recibe la URL estable en ~60 segundos

## Rollback

Desde GitHub → Commits del repo `dashboards` → revertir el commit deseado.
Vercel re-deploya automáticamente al revertir.
