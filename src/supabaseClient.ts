import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

function extractProjectRefFromJwt(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { ref?: string };
    return decoded.ref ?? null;
  } catch {
    return null;
  }
}

function resolveSupabaseUrl(rawUrl: string, anonKey: string): string {
  const url = rawUrl.replace(/\/+$/, "");
  if (SUPABASE_URL_PATTERN.test(url)) return url;

  const ref = extractProjectRefFromJwt(anonKey);
  if (ref) {
    const derived = `https://${ref}.supabase.co`;
    if (rawUrl && rawUrl !== derived) {
      console.warn(
        `[Supabase] VITE_SUPABASE_URL inválida ("${rawUrl}"). Usando URL derivada del anon key: ${derived}`
      );
    }
    return derived;
  }

  return url;
}

const rawUrl = trimEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = trimEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
const supabaseUrl = resolveSupabaseUrl(rawUrl, supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Faltan variables de entorno. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env de la raíz del proyecto."
  );
} else if (!SUPABASE_URL_PATTERN.test(supabaseUrl)) {
  console.error(
    `[Supabase] URL no válida: "${supabaseUrl}". Debe ser https://<ref>.supabase.co`
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://invalid.local",
  supabaseAnonKey,
  {
    auth: { persistSession: false },
    global: {
      // Evita que el service worker o caché del navegador interfieran con la API.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  }
);

export const SUPABASE_PROJECT_URL = supabaseUrl;
export const SUPABASE_PROJECT_REF =
  supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ??
  extractProjectRefFromJwt(supabaseAnonKey) ??
  "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL_PATTERN.test(supabaseUrl) && supabaseAnonKey);
}

export function getSupabaseConfigError(): string | null {
  if (!supabaseAnonKey) return "Falta VITE_SUPABASE_ANON_KEY en .env";
  if (!SUPABASE_URL_PATTERN.test(supabaseUrl)) {
    return `VITE_SUPABASE_URL inválida. Use https://<ref>.supabase.co (actual: "${rawUrl || "(vacía)"}")`;
  }
  return null;
}
