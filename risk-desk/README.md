# Risk Desk: Silver Star Mines — live classroom web app (ISI 315 Week 10)

A Kahoot-style team game for **Chapter 14 §§14.4–14.5 and Chapter 15**, built on the Risk Ready
engine. Teams play the security analyst at Silver Star Mines, the textbook's own case study, so
every answer comes straight from the book's tables.

| Act | Rounds | Teams decide | Source |
|---|---|---|---|
| 1 · Rate the risk | 1–3 | Low / Medium / High / Extreme from likelihood × consequence | Table 14.4; registers 14.5, 14.6 |
| 2 · Treat the risk | 4–7 | Accept, avoid, transfer, reduce consequence, reduce likelihood | §14.4 Risk Treatment |
| 3 · Pick the control class | 8–10 | Management, operational, or technical | §15.2, Table 15.1 |
| 4 · Keep it working | 11–13 | Cost-benefit control choice, follow-up process, the SCADA finale | §§15.2, 15.5, 15.6 |

The last round of each act is worth double. A perfect team scores 200 (including streak bonuses).

## Game features
- **Damage meters:** Mine downtime (est.) and Losses & fines (est.). When fewer than half the
  teams answer correctly, that round's impact is added.
- **Streak bonus** (+5 at 3, 6, 9… in a row), **📊 Show the votes**, a **90-second** round clock
  (Pause, +30s), fair ties, End game for everyone, phones that rejoin after dropping, QR join.

## How a class runs (about 25–30 minutes)
1. Open `/host.html` on the projector; read the story and the five treatments from the lobby.
2. Teams scan the QR code. Click **Start**. Each round: discuss → pick → (📊 votes) → Reveal → Next.
3. Bonus: treat Silver Star's #2 risk (stored data, rated Extreme). Then the summary, four rules,
   debrief prompts with a host-only answer key, and **End game for everyone**.

## Run locally
```bash
cd risk-desk
npm install
npm start                  # http://localhost:3000 → Host
ROUND_SECONDS=5 npm start  # short clock for testing
```
All teaching content lives in `server.js` under `GAME`.
