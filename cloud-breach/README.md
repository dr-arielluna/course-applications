# Stop the Breach: Cloud & IoT — live classroom web app (ISI 315 Week 9, Tuesday)

A Kahoot-style team game in two acts, built on the *Who Regulates You?* engine (each round can
bring its own answer choices). The teacher hosts on the projector; teams join on their phones
with the QR code or PIN and pick a defense each round.

- **Act 1 · Cloud (rounds 1–5)** — based on Capital One 2019: a misconfigured web-application
  firewall, a server tricked into handing over its cloud keys, an over-permissioned role,
  unwatched activity and downloads, and tokenization limiting the damage. Every defense sits on
  the customer's side of the shared-responsibility line.
- **Act 2 · IoT (rounds 6–10)** — based on Mirai 2016, on a fictional smart campus: devices
  reachable from the internet, factory passwords, spread across the network, a flood attack, and
  devices that can't be updated. The controls sit around the device, not on it.

## What makes it a game
- **Damage meters** (Records stolen, SSNs exposed, Campus devices hijacked, Attack traffic):
  at each reveal, if fewer than half the teams chose a working defense, the attacker gets through
  and that act's meter climbs. A sharp class keeps them at zero.
- **Streak bonus:** +5 each time a team reaches 3, 6, 9… correct answers in a row (🔥 on the
  scoreboard).
- **📊 Show the votes:** locks answers and shows how the class split, before the answer.
- **Round clock:** 2 minutes (bonus 1 minute); answers lock at 0:00 but nothing reveals until
  you click Reveal. ⏸ Pause and +30s next to Reveal.
- Fair ties (co-champions), End game for everyone, phones that rejoin after dropping.

## How a class runs (about 25 minutes, optional extra)
1. Open `/host.html` on the projector; read the story and Act 1's six defenses from the lobby.
2. Teams scan the QR code and pick a team name. Click **Start**.
3. Each round: read the move → teams discuss and pick → optionally **📊 Show the votes** →
   **Reveal** (meter result, answer, why, discussion prompt) → **Next**.
4. After round 10: bonus, the Capital One + Mirai reveal, lessons, and debrief prompts
   (with a host-only answer key). Then **End game for everyone**.

## Run locally
```bash
cd cloud-breach
npm install
npm start            # http://localhost:3000  → Host
ROUND_SECONDS=5 npm start   # short clock for testing
```
All teaching content lives in `server.js` under `GAME` (story, defenses, rounds, meters, reveal).
