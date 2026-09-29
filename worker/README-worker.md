# Deploying the FitLog sync worker

Fifteen minutes, once. Free tier covers this several thousand times over —
100,000 requests a day, and a heavy logging day uses about fifty.

You need a Cloudflare account (free, no card required) at
[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).

---

## Option A — the dashboard (no tools to install)

### 1. Create the KV namespace

In the Cloudflare dashboard: **Storage & Databases → KV → Create a namespace**.

Name it `fitlog` and create it. This is where your log will live.

### 2. Create the worker

**Compute (Workers) → Create → Start with Hello World! → Get started.**

Name it `fitlog-sync` and deploy it. Cloudflare gives you a throwaway starter worker;
you are about to replace its code.

### 3. Paste in the real code

On the worker's page: **Edit code** (or **</> Edit code** in the Deploy pane).

Delete everything in the editor, paste the entire contents of `worker.js` from this
folder, then **Deploy**.

### 4. Bind the namespace

Back on the worker: **Settings → Bindings → Add → KV namespace.**

- **Variable name:** `FITLOG` — exactly this, in capitals. The code looks for this name.
- **KV namespace:** the `fitlog` one you made in step 1.

**Deploy** again so the binding takes effect.

### 5. Check it

Your worker's URL is shown on its overview page and looks like:

```
https://fitlog-sync.<your-subdomain>.workers.dev
```

Open it in a browser. You should see *"FitLog sync worker is running."*

If you instead see an error mentioning `kv_not_bound`, the binding in step 4 did not
save — the variable name has to be `FITLOG`.

---

## Option B — the wrangler CLI

```bash
cd worker
npx wrangler kv namespace create FITLOG     # prints an id
# paste that id into wrangler.toml
npx wrangler deploy
```

---

## 6. Point FitLog at it

Open `js/config.js` in the site folder and put your worker URL in:

```js
window.FITLOG_CONFIG = {
  syncEndpoint: 'https://fitlog-sync.your-subdomain.workers.dev'
};
```

Push that to GitHub. Because the endpoint ships with the site, **every device picks it
up automatically** — you never type it again. If you leave it blank, FitLog still runs
perfectly as a local-only log, and you can paste an endpoint by hand in Settings → Sync.

---

## What gets stored

One JSON record per pairing code, under the key `log:<code>`:

```json
{ "rev": 14, "updatedAt": "2026-09-29T06:12:44.101Z", "data": { "...your log..." } }
```

Nobody can read it without the 32-character code, and the code never leaves your
devices. There is no user list, no email address and no account — Cloudflare sees an
opaque key and a blob.

To erase the cloud copy entirely, use **Settings → Sync → Delete cloud copy** in the
app, or delete the key from the KV namespace in the dashboard. Your devices keep their
local data either way.

## A note on KV consistency

Cloudflare KV is eventually consistent: a write can take up to a minute to be visible
from a different part of the world. In practice you are one person switching between a
phone and a laptop, so this never shows up.

If it ever did — you write on your phone and open your laptop seconds later — the
laptop might briefly see the previous state. It heals itself: FitLog merges day by day
using timestamps, so the phone's next sync restores anything the laptop's write did not
know about. Nothing is lost, it just takes one extra round trip.
