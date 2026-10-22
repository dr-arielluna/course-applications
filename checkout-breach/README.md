# Stop the Breach: Checkout — live classroom web app

ISI 315 Week 8 (Software Security) — the Stop the Breach engine with a new scenario based on
the British Airways breach of 2018 (stolen partner login, plaintext admin password, a modified
checkout script, plus an XSS round). The teacher
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
cd checkout-breach
npm install
npm start
```
Open **http://localhost:3000** → **Host** on your screen. On another device on the same
Wi-Fi, open `http://<your-computer-ip>:3000` → **Join**. Needs Node 18+.

## How a class runs
1. Open `/host.html` on the projector; read the story and the six defenses aloud (both are
   shown on the lobby screen under the PIN).
2. Students open the site → **Join** → PIN + name.
3. Click **Start**. Each round: read the attacker's move, let students pick, then **Reveal**
   (auto-scores: +10, final round +20). Students can change their pick until you reveal.
   **Next** moves on.
4. Bonus round (+10), then the **British Airways reveal**, the winner, and debrief prompts.
   **Round clock:** each round has a 2-minute countdown (bonus: 1 minute) on the projector and
   every phone. At 0:00 answers lock, but nothing reveals until you click **Reveal**. The
   clock holds once every team has answered; **⏸ Pause** and **+30s** (which also re-opens
   answers after time-up) sit next to the Reveal button. For testing, `ROUND_SECONDS` /
   `BONUS_SECONDS` environment variables shorten it.
   **Ties:** tied teams share a place (1st, 1st, 3rd) and are listed alphabetically. A tie for
   the top score names everyone as **co-champions**; if nobody scores, there is no champion.
5. When class is done, click **End game for everyone** on the results screen. (Phones that
   lock or drop Wi-Fi keep their seat and score; a host screen that sleeps has 10 minutes to
   come back.)

## Editing the game
All teaching content — the story, the six defenses, the six rounds, the answer key,
the reveal, and the lessons — lives in `server.js` under the `GAME` object.
