# Architecture

```text
External source
→ Source adapter
→ Raw snapshot storage
→ Normalized database tables
→ Derived indicators
→ Dashboard snapshots
→ Next.js API routes / Netlify Functions
→ Frontend
```

The browser calls only internal API routes. Third-party API keys stay server-side. Source failures return degraded, stale, unavailable, or mock states instead of crashing the UI.
