import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Values are never printed.");
    process.exit(1);
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client
    .from("dashboard_snapshots")
    .select("key,mode,generated_at,expires_at,payload,metadata")
    .order("key");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const rows = (data ?? []).map((row: any) => ({
    key: row.key,
    mode: row.mode,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    payloadBytes: Buffer.byteLength(JSON.stringify(row.payload ?? null)),
    metadataBytes: Buffer.byteLength(JSON.stringify(row.metadata ?? null)),
    topLevelPayloadKeys:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? Object.keys(row.payload).length
        : null
  }));
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: rows }, null, 2));
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
