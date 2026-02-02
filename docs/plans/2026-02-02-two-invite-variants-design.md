# Two Invite Variants Design

## Overview

Support two wedding invite variants (dinner and non-dinner) from a single codebase, deployed as separate Vercel projects with different environment variables.

## Requirements

- Guests should only see their relevant invite
- Code changes propagate to both variants automatically
- Only time, dietary field visibility, and submission endpoint differ

## Variant Configuration

| | Dinner | Non-Dinner |
|--|--------|------------|
| URL | `second-summer-of-love.vercel.app` | `the-second-summer-of-love.vercel.app` |
| Time | 17:30PM | 19:30PM |
| Dietary field | Shown | Hidden |
| Endpoint | Current Google Apps Script | New Google Apps Script |
| Date | Saturday 19 September | Same |
| Venue | Faith in Strangers, Margate | Same |

## Environment Variables

```
PUBLIC_EVENT_TIME="17:30PM"       # or "19:30PM"
PUBLIC_SHOW_DIETARY="true"        # or "false"
PRIVATE_GOOGLE_SHEETS_URL="..."   # variant-specific endpoint
```

## Code Changes

### 1. `src/components/Poster.svelte`
- Import `PUBLIC_EVENT_TIME` from `$env/static/public`
- Replace hardcoded `17:30PM` with the environment variable

### 2. `src/components/GlitchText.svelte`
- Accept `eventTime` as a prop from Poster
- Replace hardcoded time in WebGL text mesh

### 3. `src/components/Rsvp.svelte`
- Import `PUBLIC_SHOW_DIETARY` from `$env/static/public`
- Conditionally render dietary field based on env var
- Remove hardcoded Google Sheets endpoint
- Submit to `/api/rsvp` server endpoint instead (already configured to use `PRIVATE_GOOGLE_SHEETS_URL`)

## Deployment

1. Update existing Vercel project with new env var names
2. Create new Vercel project `the-second-summer-of-love` from same repo
3. Configure non-dinner env vars in new project

## What Stays Shared

- All visual styling, animations, WebGL shaders
- Date, venue, couple names
- Form validation logic
- Page structure and interactions
