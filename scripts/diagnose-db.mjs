import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";

// Temporary build-time probe. Never print connection details or secret values.
const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!raw || !key) {
  console.log(`[db-check] missing_url=${!raw} missing_key=${!key}`);
  process.exit(0);
}

let url;
try {
  url = new URL(raw.trim());
} catch {
  console.log("[db-check] invalid_url=true");
  process.exit(0);
}

const host = url.hostname;
const looksPlaceholder = /example|placeholder|your|sample|project|xxxx|localhost|127\.0\.0\.1|프로젝트/i.test(host);
const hostType = host.endsWith(".supabase.co") ? "supabase.co"
  : host.endsWith(".supabase.com") ? "supabase.com" : "other";
const keyType = key.startsWith("sb_secret_") ? "secret"
  : key.startsWith("eyJ") ? "legacy_jwt" : "other";
const hostFingerprint = createHash("sha256").update(host).digest("hex").slice(0, 16);
const matchesPausedProject = hostFingerprint === "5494fea0d2cc4c1d";
const keyLooksPlaceholder = /replace|placeholder|example|sample|your[_-]|test[_-]/i.test(key);
console.log(`[db-check] scheme=${url.protocol} host_type=${hostType} placeholder=${looksPlaceholder} matches_paused_project=${matchesPausedProject} key_type=${keyType} key_placeholder=${keyLooksPlaceholder}`);
try {
  await lookup(host);
  console.log("[db-check] dns=ok");
} catch (error) {
  console.log(`[db-check] dns=${String(error?.code ?? "unknown").replace(/[^A-Z0-9_]/gi, "").slice(0, 40)}`);
  process.exit(0);
}

try {
  const endpoint = new URL("/rest/v1/users?select=id&limit=0", url);
  const response = await fetch(endpoint, {
    headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(8_000),
  });
  console.log(`[db-check] rest_status=${response.status}`);
} catch (error) {
  const code = String(error?.cause?.code ?? error?.name ?? "unknown").replace(/[^A-Z0-9_]/gi, "").slice(0, 40);
  console.log(`[db-check] rest_network_error=${code}`);
}
