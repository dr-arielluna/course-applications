# Signature Lab

A browser-based Snort-style intrusion-detection sandbox for ISI 315 Week 6
(signature vs. anomaly detection, §8.3; Snort rules, §8.9).

Students inspect a feed of simulated traffic, write `content` rules (protocol, port,
match text, `nocase`), run detection, and see what they **caught**, **missed**, and
**false-alarmed** on. It drives three ideas:

- **Signatures are literal** — a precise `content` string catches the classic SQL
  injection; an over-broad one (e.g. `OR`) false-alarms on a benign search.
- **Evasion** — a URL-encoded SQL injection slips past an exact-match rule.
- **The blind spot** — a port scan has no payload to match, so *no* content signature
  can catch it. That's why anomaly/threshold detection exists.

Everything runs in the browser; the Node server only serves the static file.

## Run locally
```bash
cd signature-lab
npm install
npm start      # http://localhost:3000
```

## Deploy
Covered by the repo-root `render.yaml` (service `signature-lab`, `rootDir: signature-lab`).
See the repo root [`../README.md`](../README.md) for the full GitHub → Render steps.

## Editing the lab
The traffic feed (`EVENTS`) and the rule-matching engine live in
`public/index.html`. Each event has a `payload`, a `proto`/`port`, and a `mal`
(malicious) ground-truth flag; add or change events there.
