# Firewall Lab

A browser-based firewall-rulebase sandbox for ISI 315 Week 6 (firewalls & access
policy, §9.2–9.4).

Students are given a network (7 zones) and a policy (10 flows marked allow/deny).
They build an ordered ALLOW/DENY rulebase and test it. The firewall evaluates
**top-down, first match wins**, and **default-denies** anything unmatched. Results
show every flow as correct, a **security hole** (allowed something forbidden), or a
**broken flow** (blocked something legitimate). It drives:

- **Default-deny** — you only write ALLOW rules; everything else is blocked for free.
- **Least privilege** — a broad `any` ALLOW opens holes (e.g. the vendor reaching the
  registers — the Target hole).
- **Order matters** — a broad DENY above a specific ALLOW shadows it, breaking legit
  traffic; reorder or narrow.
- **The blind spot** — a firewall decides yes/no on a connection; it can't see a
  malicious payload on an allowed port (that's Signature Lab's job).

Everything runs in the browser; the Node server only serves the static file.

## Run locally
```bash
cd firewall-lab
npm install
npm start      # http://localhost:3000
```

## Deploy
Covered by the repo-root `render.yaml` (service `firewall-lab`, `rootDir: firewall-lab`).
See the repo root [`../README.md`](../README.md) for the full GitHub → Render steps.

## Editing the lab
The zones (`ZONES`), the policy (`FLOWS`, each with a `src`/`dst`/`port` and an `allow`
ground-truth flag), and the rule engine live in `public/index.html`.
