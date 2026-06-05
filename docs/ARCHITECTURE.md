# Architecture

Frontend pages call internal Next.js API routes only. API routes and future Netlify Functions call server-side adapters. Adapters write raw source snapshots and normalized tables in Supabase, then generate dashboard snapshots consumed by the app.

Freshness statuses: fresh, delayed, stale, degraded, unavailable.
