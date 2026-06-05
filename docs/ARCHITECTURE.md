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

The browser never calls third-party APIs directly. Secrets are read only in server-side routes, adapters, or Netlify Functions.

## Failure handling

- Missing environment variables return explicit messages.
- Failed adapters return clear missing-data notices.
- Stale cached snapshots remain visible with warnings.
- Mock data is clearly labeled.
