# Netlify Deployment

Use Netlify GitHub integration.

- Build command: `npm run build`
- Publish directory: `.next`
- Plugin: `@netlify/plugin-nextjs`

Add variables under **Site configuration → Environment variables**. API routes are deployed server-side by the Netlify Next.js plugin. Future scheduled jobs should live in `netlify/functions/`.
