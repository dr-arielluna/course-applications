# Stop the Breach — live classroom web app

A Kahoot-style live version of the ISI 315 Week 6 "Stop the Breach" game. The teacher
hosts on the projector and gets a 4-digit PIN; students join on their own phones/laptops,
pick a defense each round, and the scoreboard updates live across every device.

- **Host screen:** `/host.html` — the PIN, the live scoreboard, round controls.
- **Student device:** `/play.html` — enter the PIN + a name, then tap a defense each round.
- The **answer key lives only on the server**, so students can't read ahead in page source.
- Works across any modern browser (Edge, Chrome, Firefox) on any device.

> **Deploying?** See the repo root [`../README.md`](../README.md) for the full
> GitHub → Render walkthrough. (This app is a subfolder of the `course-applications`
> repo; Render's blueprint lives at the repo root and targets this folder via `rootDir`.)

## Run it locally
```bash
cd stop-the-breach
npm install
npm start
```
Open **http://localhost:3000** → **Host** on your screen. On another device on the same
Wi-Fi, open `http://<your-computer-ip>:3000` → **Join**. Needs Node 18+.

## How a class runs
1. Open `/host.html` on the projector; read the story and the six defenses aloud.
2. Students open the site → **Join** → PIN + name.
3. Click **Start**. Each round: read the attacker's move, let students pick, then **Reveal**
   (auto-scores: +10, final round +20). **Next** moves on.
4. Bonus round (+10), then the **Target reveal** and the winner.

## Editing the game
All teaching content — the story, the six defenses, the five rounds, the answer key,
the reveal, and the lessons — lives in `server.js` under the `GAME` object.
