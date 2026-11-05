# The sync worker

This is optional. Skip the whole folder and FitLog is a complete local-only log
with manual backup and restore.

Deploy it and your devices stay in step: no account, no password, nothing that
expires. The pairing code is the credential.

Free tier is enough — 100,000 reads and 1,000 writes a day, and FitLog only
writes when something actually changed.

---

## The short version

1. Cloudflare dashboard → **Storage & Databases → KV → Create** a namespace called `FITLOG`.
2. **Compute → Workers → Create** → start from Hello World → **Deploy**.
3. Open the worker → **Edit code**, select everything in `worker.js`, paste in the
   contents of `worker.js` from this folder → **Deploy**.
4. Worker → **Settings → Bindings → Add → KV namespace**. Variable name `FITLOG` (exactly),
   namespace the one you made. **Deploy** again.
5. Click **Visit**. You should see *FitLog sync worker is running*.
6. Copy that URL into `js/config.js` in the site, and push the site.

---

## Step by step

### 1. A KV namespace to hold the data

Cloudflare dashboard → **Storage & Databases → KV → Create a namespace**.
Call it `FITLOG`. That is all; there is nothing to configure inside it.

### 2. A worker to serve it

**Compute (Workers) → Workers & Pages → Create → Start with Hello World → Deploy.**

Cloudflare names it for you — something like `old-dawn-3db0`. Workers cannot be
renamed after creation and the name only shows up in the URL, so either live with
it or delete it and create one with the name you want.

### 3. Replace the code

Open the worker → **Edit code**. The editor opens on `worker.js` with the Hello
World handler in it.

**Select all of it and paste over it.** Do not drag `worker.js` from this folder
into the file list — that adds a *second* file alongside the entry point, and the
worker keeps running the original. If you see two files in the sidebar, delete the
one you added and paste into the first instead.

Then press the blue **Deploy** button at the top right. `Ctrl+S` saves to the
editor's scratch copy, not to Cloudflare, and on some browsers it fails outright
with *No file system handle registered* — ignore it and use **Deploy**.

If the tab title still shows a dot, the editor has unsaved changes and has not
deployed what you are looking at. Reload the page and check the code is the
pasted version before deploying again.

### 4. Bind the namespace

The worker cannot see KV until you tell it to.

**Settings → Bindings → Add → KV namespace.**

| | |
|---|---|
| Variable name | `FITLOG` |
| KV namespace | the one from step 1 |

The variable name must be exactly `FITLOG` — that is the name the code looks for.
Save, then **Deploy** once more so the binding reaches the live version.

### 5. Check it

Click **Visit** next to Deploy. You should see:

> FitLog sync worker is running.
> This endpoint stores nothing you can read without a pairing code.

Still "Hello World"? The paste did not deploy. Go back to step 3.

### 6. Tell the app where it is

Copy the worker URL — `https://<name>.<your-subdomain>.workers.dev` — into
`js/config.js`:

```js
window.FITLOG_CONFIG = {
  syncEndpoint: 'https://your-worker.your-subdomain.workers.dev'
};
```

Push the site. Every device picks the endpoint up from the site itself, so this is
the only place it is ever typed.

### 7. Pair your devices

On the device that already holds your history: **Settings → Sync → Turn on sync
here**. It generates a pairing code and uploads your log.

On every other device: point the camera at the QR code and open the link, or open
the site and paste the code into **Settings → Sync → Use an existing code**.

Any number of devices can share one code. They are peers — no master, no slave.
Each one pulls, merges and pushes, so whichever device you log on, the others see
it next time they sync.

---

## With wrangler instead

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler kv namespace create FITLOG       # copy the id it prints
# paste that id into wrangler.toml
wrangler deploy
```

`wrangler.toml` in this folder has everything but the namespace id.

---

## What it does and does not do

```
GET    /v1/log/<code>   -> { rev, updatedAt, data }
PUT    /v1/log/<code>   <- { rev, days, dels, enc, payload }    409 if rev is stale
DELETE /v1/log/<code>   -> { ok: true }
GET    /                -> a health page
```

**Already deployed an earlier copy?** Replace it with this one. The app works either
way — if the worker answers 400 to a compressed push it sends the log uncompressed
instead and tells you in Settings — but the current version compresses, which is
roughly six times less data, and refuses a push that would replace a full log with
an empty one.

- **The code is the credential.** 128 bits of randomness, so it is not guessable,
  but anyone holding it can read and write your log. Keep it out of group chats.
  **Settings → Delete cloud copy** erases the stored value and the code with it.
- **Writes are checked.** A client sends the revision it last read; if the stored
  copy has moved on, the write is refused with 409 and the client merges and
  retries. Nothing is overwritten blindly.
- **An empty push cannot wipe your devices.** The client states how many days it
  is sending and how many deletions it carries. A push of zero days against a
  stored log that has days in it is refused with the live copy attached, so the
  device merges and pushes that instead. A device that really did delete
  everything carries tombstones and is allowed through; erasing the cloud copy
  on purpose is DELETE.
- **It stores one opaque blob per code.** Gzipped on the device before it is sent.
  The worker does not parse your log, and there is no endpoint that lists codes.
- **20 MB ceiling** per code — roughly a decade of daily logging.

## Cost

Reads: a device syncing every few minutes all day is a few hundred reads.
Writes: one per actual change. A heavy day of logging is perhaps thirty.
Both sit far inside the free tier, and KV storage of a few megabytes is free.
