# Codex guidelines

This repository's documentation is intended to help future Codex/AI-agent sessions work safely and accurately.

## Prime directive: keep affected documentation current

Documentation is part of an implementation when a change materially affects documented behavior, data flow, APIs, operations, or architecture. Update only the files whose scope is affected; minor code changes do not require documentation churn.

Documentation is not optional cleanup after coding. It is part of the implementation.

Use this routing:

- Feature, tab, card, or other user-visible behavior changed? Update `docs/features.md`.
- Architecture/routing/backend pattern changed? Update `docs/architecture.md`.
- Source/provider/cache/fallback/script/schema changed? Update `docs/data-sources.md`.
- Build/deploy/env/function scheduling changed? Update `docs/deployment.md`.
- Development workflow or agent rules changed? Update `docs/development.md` and this file.

## README maintenance policy

`README.md` is a stable, high-level overview of AlphaDigest. It is not a changelog or implementation journal. Do not update it merely because a code change was implemented, and do not append a new README section for each implementation task.

Change the README only when a change materially affects a major project-level concept, such as:

- the overall architecture or primary technology stack;
- a major data provider or the core data-flow model;
- major database domains;
- public developer setup;
- the security model; or
- the fundamental deployment model.

Put feature-specific detail in the documentation file responsible for it:

- provider, ingestion, persistence, retention, or fallback behavior -> `docs/data-sources.md`;
- feature, tab, card, or business behavior -> `docs/features.md`;
- architecture, caching, routing, or shared patterns -> `docs/architecture.md`;
- development, backfill, audit, validation, or debugging commands -> `docs/development.md`;
- schedules, environment configuration, deployment, or production operations -> `docs/deployment.md`.

Before editing `README.md`, ask:

> Would a new developer need this information to understand the overall AlphaDigest project, or is this primarily a detail about one feature or implementation?

If it is primarily an implementation detail, do not put it in the README. A request to “update documentation” does **not** automatically mean updating `README.md`; update only documentation whose scope is materially affected.

## Start-of-task audit

Before editing, inspect the relevant code instead of trusting old docs. For broad documentation work, review at least:

- `README.md`
- every file in `docs/`
- `package.json`
- `app/`
- `components/dashboard/`
- `components/shell/`
- `components/ui/`
- `lib/data/`
- `lib/constants/`
- `lib/api/`
- `lib/db/`
- `netlify/functions/`
- `scripts/`
- `public/data/`
- `public/assets/`
- `supabase/`
- `netlify.toml`
- `tailwind.config.ts`
- `app/globals.css`

## Accuracy rules

- Do not document a provider as active unless code fetches it and a page/API uses the result.
- Do not document a fallback unless code confirms it.
- If a source is only present in fixtures, settings, or methodology text, label it as fixture-backed, placeholder, planned, or not currently wired.
- If unsure, say what is uncertain and cite the code path in your implementation notes/final answer.
- Prefer exact route, function, script, and file names over generic descriptions.

## Current active vs fixture-backed boundaries

Active/live-or-fallback flows:

- Markets quote/heatmap flow through Finnhub and Yahoo Finance fallback helpers.
- Today featured articles through Unusual Whales featured news fetching.
- News & Calendar headline feed through Unusual Whales headline feed.
- Today and News & Calendar earnings through Unusual Whales earnings cache/live/static fallback flow.
- Today and News & Calendar economic events through Investing.com economic calendar fetching.

Fixture-backed or placeholder areas:

- Flow & Ownership page/API.
- Sentiment pages/API.
- Ticker detail page/API.
- Most generic refresh Netlify functions except the Unusual Whales earnings functions.

## High-risk coupling to avoid

- Do not merge Today featured news with News & Calendar headline feed without explicitly updating both flows and docs.
- Do not treat Today earnings and News & Calendar earnings as the same UI. They share source data but use different date filtering, limits, grouping, and display fields.
- Do not hard-code heatmap icons in components; update `lib/constants/asset-icons.ts` and `public/assets/heatmap-icons/`.
- Do not expose server-only keys in client components or `NEXT_PUBLIC_` variables.
- Do not turn placeholder functions into documented production jobs without implementing and validating them.
- Do not update static fallback JSON accidentally in unrelated work.

## Preferred implementation workflow

1. Read relevant docs and code.
2. Identify active files and connected flows.
3. Make the smallest accurate code/doc change.
4. Update all docs impacted by the change.
5. Run relevant validation commands.
6. Review `git diff` for accidental source-data churn or overbroad docs claims.
7. Commit changes on the current branch.

## Validation command selection

Default checks for most changes:

```bash
npm run typecheck
npm run lint
npm run build
```

Additional checks:

```bash
npm run validate:news-calendar
```

Run this when touching News & Calendar date selection, economic calendar flow, earnings calendar UI, or related helpers.

```bash
npm run format
```

Run this for broad Markdown/code formatting changes when feasible.

## Final response expectations for code/doc changes

Include:

- Concise summary with file citations.
- Files changed/added/renamed/deleted when the change is a docs reorganization.
- Major stale information corrected when doing documentation work.
- Location of the documentation maintenance rule.
- Validation commands and results.

For each test/check command, prefix the command with:

- ✅ for pass.
- ⚠️ for warning caused by environment/tooling limitation.
- ❌ for agent-caused failure.

## Documentation review checklist

Before finalizing documentation changes, verify:

1. README is user-facing and not overloaded with implementation details.
2. `docs/` files are technical enough for future Codex work.
3. Current tabs, route structure, data flows, scripts, serverless functions, processed data files, APIs, styling, deployment, and limitations are documented.
4. Internal links work.
5. Old file names are not referenced.
6. No unsupported live-data claims remain.
7. The documentation maintenance rule is present.
