# Two Invite Variants Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support two wedding invite variants (dinner at 17:30 with dietary field, non-dinner at 19:30 without) from a single codebase using environment variables.

**Architecture:** Environment variables control the time display and dietary field visibility. The existing `/api/rsvp` endpoint already uses `PRIVATE_GOOGLE_SHEETS_URL` from env. Two Vercel projects deploy the same repo with different env vars.

**Tech Stack:** SvelteKit, Vercel, environment variables (`$env/static/public`)

---

### Task 1: Add Environment Variables Configuration

**Files:**
- Create: `src/lib/config.js`
- Create: `.env.example`

**Step 1: Create config module**

Create `src/lib/config.js`:
```javascript
import { env } from '$env/static/public';

export const config = {
    eventTime: env.PUBLIC_EVENT_TIME || '17:30PM',
    showDietary: env.PUBLIC_SHOW_DIETARY !== 'false'
};
```

**Step 2: Create .env.example for documentation**

Create `.env.example`:
```bash
# Event Configuration
PUBLIC_EVENT_TIME="17:30PM"
PUBLIC_SHOW_DIETARY="true"

# RSVP Backend (already exists)
PRIVATE_GOOGLE_SHEETS_URL="https://script.google.com/..."
CF_TURNSTILE_PRIVATE_KEY="..."
PUBLIC_EMAIL="..."
```

**Step 3: Commit**

```bash
git add src/lib/config.js .env.example
git commit -m "feat: add environment config for invite variants"
```

---

### Task 2: Update Poster.svelte to Use Config Time

**Files:**
- Modify: `src/components/Poster.svelte:1-10` (add import)
- Modify: `src/components/Poster.svelte:166-170` (pass prop to GlitchText)
- Modify: `src/components/Poster.svelte:206` (HTML fallback time)

**Step 1: Add import at top of script**

After line 5, add:
```javascript
import { config } from '$lib/config.js';
```

**Step 2: Pass eventTime prop to GlitchText**

Change line 168 from:
```svelte
<GlitchText effectParams={discoBallParams} />
```
to:
```svelte
<GlitchText effectParams={discoBallParams} eventTime={config.eventTime} />
```

**Step 3: Update HTML fallback time**

Change line 206 from:
```svelte
<p class="detail" class:loaded={fontsLoaded}>17:30PM</p>
```
to:
```svelte
<p class="detail" class:loaded={fontsLoaded}>{config.eventTime}</p>
```

**Step 4: Commit**

```bash
git add src/components/Poster.svelte
git commit -m "feat: use config for event time in Poster"
```

---

### Task 3: Update GlitchText.svelte to Accept Time Prop

**Files:**
- Modify: `src/components/GlitchText.svelte:10` (add prop)
- Modify: `src/components/GlitchText.svelte:269-277` (use prop)

**Step 1: Add eventTime prop**

After line 10 (`export let effectParams;`), add:
```javascript
export let eventTime = '17:30PM';
```

**Step 2: Update the time text mesh**

Change lines 269-277 from:
```javascript
const detail4 = createTextMesh('17:30PM', {
    font: CONDENSED_FONT,
    fontSize: 26,
    color: WHITE,
    y: detailY - detailSpacing * 3,
    letterSpacing: 0.15
});
```
to:
```javascript
const detail4 = createTextMesh(eventTime, {
    font: CONDENSED_FONT,
    fontSize: 26,
    color: WHITE,
    y: detailY - detailSpacing * 3,
    letterSpacing: 0.15
});
```

**Step 3: Commit**

```bash
git add src/components/GlitchText.svelte
git commit -m "feat: accept eventTime prop in GlitchText"
```

---

### Task 4: Update Rsvp.svelte - Conditional Dietary Field

**Files:**
- Modify: `src/components/Rsvp.svelte:1-5` (add import, remove hardcoded endpoint)
- Modify: `src/components/Rsvp.svelte:84-87` (conditional dietary field)

**Step 1: Add config import and remove hardcoded endpoint**

Replace lines 1-5:
```javascript
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    export let form;

    const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwJ2LwLcXS5SANMJFNJakHyncuXrKS7_BbEXwhrpu9VOT7U4K63wlXFXmm7Q5wijUfgZg/exec';
```
with:
```javascript
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { config } from '$lib/config.js';
    export let form;
```

**Step 2: Update handleSubmit to use server endpoint**

Replace lines 34-42:
```javascript
try {
    const response = await fetch(SHEETS_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    });
```
with:
```javascript
try {
    const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    });

    if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to submit');
    }
```

**Step 3: Wrap dietary field in conditional**

Replace lines 84-87:
```svelte
<div class="form-field">
    <label for="dietary" class:loaded={fontsLoaded}>DIETARY REQUIREMENTS</label>
    <textarea id="dietary" name="dietary" bind:value={formData.dietary}></textarea>
</div>
```
with:
```svelte
{#if config.showDietary}
    <div class="form-field">
        <label for="dietary" class:loaded={fontsLoaded}>DIETARY REQUIREMENTS</label>
        <textarea id="dietary" name="dietary" bind:value={formData.dietary}></textarea>
    </div>
{/if}
```

**Step 4: Commit**

```bash
git add src/components/Rsvp.svelte
git commit -m "feat: conditional dietary field, use server endpoint"
```

---

### Task 5: Update API Endpoint - Remove CAPTCHA Requirement

**Files:**
- Modify: `src/routes/api/rsvp/+server.js`

The current endpoint requires Cloudflare Turnstile CAPTCHA, but the form doesn't send it. Simplify to just forward to Google Sheets.

**Step 1: Simplify the endpoint**

Replace entire file with:
```javascript
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    const data = await request.json();

    try {
        const response = await fetch(env.PRIVATE_GOOGLE_SHEETS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (result.result !== 'success') {
            return json({ error: `Failed to submit. Please email: ${publicEnv.PUBLIC_EMAIL}` }, { status: 500 });
        }

        return json({ success: true, message: 'RSVP submitted successfully!' });
    } catch (err) {
        console.error('RSVP submission error:', err);
        return json({ error: `Failed to submit. Please email: ${publicEnv.PUBLIC_EMAIL}` }, { status: 500 });
    }
}
```

**Step 2: Commit**

```bash
git add src/routes/api/rsvp/+server.js
git commit -m "feat: simplify API endpoint, remove CAPTCHA requirement"
```

---

### Task 6: Test Locally

**Step 1: Create local .env file for dinner variant**

Create `.env` (not committed):
```bash
PUBLIC_EVENT_TIME="17:30PM"
PUBLIC_SHOW_DIETARY="true"
PRIVATE_GOOGLE_SHEETS_URL="https://script.google.com/macros/s/AKfycbwJ2LwLcXS5SANMJFNJakHyncuXrKS7_BbEXwhrpu9VOT7U4K63wlXFXmm7Q5wijUfgZg/exec"
PUBLIC_EMAIL="your@email.com"
```

**Step 2: Run dev server and verify**

```bash
pnpm dev
```

Verify:
- Time shows "17:30PM" on poster
- Dietary field is visible in RSVP form

**Step 3: Test non-dinner variant**

Change `.env`:
```bash
PUBLIC_EVENT_TIME="19:30PM"
PUBLIC_SHOW_DIETARY="false"
```

Restart dev server and verify:
- Time shows "19:30PM" on poster
- Dietary field is hidden in RSVP form

---

### Task 7: Configure Vercel Projects

**Step 1: Update existing Vercel project (dinner)**

In Vercel dashboard for `second-summer-of-love`:
- Add `PUBLIC_EVENT_TIME` = `17:30PM`
- Add `PUBLIC_SHOW_DIETARY` = `true`
- Verify `PRIVATE_GOOGLE_SHEETS_URL` is set to dinner endpoint

**Step 2: Create new Vercel project (non-dinner)**

1. Go to vercel.com → "Add New Project"
2. Import same GitHub repo
3. Name: `the-second-summer-of-love`
4. Add environment variables:
   - `PUBLIC_EVENT_TIME` = `19:30PM`
   - `PUBLIC_SHOW_DIETARY` = `false`
   - `PRIVATE_GOOGLE_SHEETS_URL` = (non-dinner endpoint)
   - `PUBLIC_EMAIL` = (same email)

**Step 3: Deploy and verify both sites**

Push changes to trigger deployment on both projects. Verify each site shows correct time and form fields.
