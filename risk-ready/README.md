# Risk Ready — live classroom web app (ISI 315 Week 9, Thursday)

A Kahoot-style team game for Chapter 14 (§§14.1–14.3), built on the *Who Regulates You?* engine.
It plays differently from the Tuesday attack-and-defend game: here teams **judge and decide**.

- **Act 1 · Name it** — asset, threat, vulnerability, or consequence?
- **Act 2 · Which lever?** — does a control lower the likelihood or the consequence?
- **Act 3 · Pick the approach** — baseline, informal, detailed, or combined, for a three-person
  office, a power-grid operator, and a university with a teaching hospital.

All scenarios are new, so the game doesn't give away the deck's labeling drill (slide 35) or
"Choose the approach" (slide 38); it works before or after them.

## What makes it a game
- **Risk meter** — "Risk left unmanaged (est.)": when fewer than half the teams answer correctly,
  that round's estimated loss is added.
- **Streak bonus** (+5 at 3, 6… in a row), **📊 Show the votes**, a **90-second** round clock,
  fair ties, End game for everyone, and phones that rejoin after dropping.

## How a class runs (about 15–20 minutes, optional extra)
1. Open `/host.html` on the projector; read the story and the four approaches from the lobby.
2. Teams scan the QR code. Click **Start**; each round: discuss → pick → (votes) → Reveal → Next.
3. Bonus: "Which approach fits OUR university?" Then the summary, three rules, debrief prompts
   (with a host-only answer key), and **End game for everyone**.

## Run locally
```bash
cd risk-ready
npm install
npm start            # http://localhost:3000  → Host
```
All teaching content lives in `server.js` under `GAME`.
