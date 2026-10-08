# Course Applications

Web apps built for course activities. Each app lives in its own subfolder; this
repo root carries the shared Render blueprint.

| App | Folder | What it is |
|---|---|---|
| Stop the Breach | [`stop-the-breach/`](stop-the-breach/) | ISI 315 Week 6 — live, multi-device security game (Node + Socket.IO). |
| Signature Lab | [`signature-lab/`](signature-lab/) | ISI 315 Week 6 — write Snort-style IDS rules against simulated traffic; see catches, misses, and false alarms (§8.3 & §8.9). |

The blueprint defines **both** services, so one Render deploy creates `stop-the-breach`
**and** `signature-lab`, each from its own subfolder.

---

## Deploy to Render (free)

Render builds from this GitHub repo. The blueprint `render.yaml` at the repo root
tells Render which subfolder to build (`rootDir: stop-the-breach`). ~10–15 min the first time.

### 0. One-time installs (skip what you have)
- **Git** — https://git-scm.com/download/win (Windows) · preinstalled on macOS
- **Node 18+** — https://nodejs.org (only for testing locally; Render installs its own)
- A **GitHub** account and a **Render** account (free, sign in with GitHub)

### 1. Put this repo on GitHub
Create an **empty** repo on github.com named `course-applications` — do **not** add a
README, .gitignore, or license (this folder already has them). Then, from this folder:

```bash
# a git repo is already initialized here with a first commit, on branch main
git remote add origin https://github.com/<your-username>/course-applications.git
git push -u origin main
```
If Git asks for a password, use a **Personal Access Token** (GitHub → Settings →
Developer settings → Personal access tokens, with the `repo` scope).

### 2. Deploy on Render
1. Log in at **render.com**.
2. **New +** → **Blueprint** → pick your `course-applications` repo.
3. Render reads `render.yaml`, sees `rootDir: stop-the-breach`, and shows a **free Node
   web service** named `stop-the-breach`. Click **Apply**.
4. It runs `npm install` then `npm start` inside `stop-the-breach/` and gives you a URL
   like **`https://stop-the-breach.onrender.com`**.

**No Blueprint option?** New + → **Web Service** → pick the repo → set **Root Directory**
to `stop-the-breach`, **Build** `npm install`, **Start** `npm start`, **Instance** Free → Create.

### 3. Use it in class
- Teacher: open `https://<app>.onrender.com/host.html` on the projector → read the PIN.
- Students (Edge/Chrome/Firefox, any PC, any network): open the base URL → **Join** → PIN + name.

### 4. Free-tier note
A free Render service **sleeps after ~15 min idle** and takes ~30–60 s to wake, so
**open the host page 2–3 minutes before class**. For a can't-fail session, switch the
service to **Starter (~$7/mo)** in Render settings (reversible).

### Updating later
```bash
git add -A && git commit -m "what changed" && git push
```
Render redeploys automatically on every push to `main`.

---

### Adding another app later
1. Put it in a new subfolder (e.g. `another-app/`).
2. Add a service block to `render.yaml` with `rootDir: another-app`.
3. Commit and push — Render picks up the new service from the blueprint.
