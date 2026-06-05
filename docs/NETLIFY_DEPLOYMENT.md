# Netlify Deployment

Use `npm run build`, publish `.next`, and enable `@netlify/plugin-nextjs` through `netlify.toml`. Configure variables under Netlify Site configuration → Environment variables. Verify `/api/sources/status` after deploy.

Future scheduled jobs should be implemented in `netlify/functions` and write source runs plus dashboard snapshots to Supabase.
