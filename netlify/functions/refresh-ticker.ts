export default async function handler() {
  return new Response(JSON.stringify({
    status: "placeholder",
    job: "refresh-ticker",
    message: "Future Netlify Scheduled Function: external source -> server-side adapter -> Supabase -> dashboard snapshot.",
    generatedAt: new Date().toISOString()
  }), { headers: { "content-type": "application/json" } });
}
