# ISI 315 Games — one platform for every live classroom game

One server, one web address, every game. The instructor opens `/host.html`, **picks today's game**
from the menu, and gets a PIN and QR code. Students always go to the same address and enter the PIN;
the PIN puts them in whichever game that room is running. Several classes can play different games
at the same time.

| Week | Game | File |
|---|---|---|
| 6 | Stop the Breach (Target 2013) | `games/stop-the-breach.js` |
| 7 | Who Regulates You? | `games/who-regulates-you.js` |
| 8 | Stop the Breach: Checkout (British Airways 2018) | `games/checkout-breach.js` |
| 9 · Tue | Stop the Breach: Cloud & IoT (Capital One, Mirai) | `games/cloud-breach.js` |
| 9 · Thu | Risk Ready | `games/risk-ready.js` |
| 10 | Risk Desk: Silver Star Mines (Ch 14–15) | `games/risk-desk.js` |
| 10 · Alternate | Risk Desk: The Web Design Company (Ch 14–15; the company from Case 2 and Lab 2) | `games/risk-desk-web.js` |

Game content was copied verbatim from each game's own app folder.

## Every game gets the same engine
Per-round answer choices, round clock (Pause, +30s; answers lock at 0:00, nothing reveals until you
click Reveal), 📊 Show the votes, streak bonus (+5 at 3, 6, 9… in a row), damage meters (games that
define them), fair ties with co-champions, End game for everyone, phones that rejoin after dropping,
and a host screen that resumes after a reload. In the lobby, **← Choose a different game** closes
the room and returns to the menu.

## Add a game
Create `games/<id>.js` that exports the game object (copy an existing file): `title`, `week`,
`kicker`, `blurb`, `order`, `story`, `defenses`, `rounds`, `bonus`, `reveal`, `lessons`, `debrief`,
and optionally `meters`, `ui`, `lobby`, `champion`, `revealTitle`, `lessonsTitle`, `debriefKey`,
`roundSeconds`. Restart the server; it appears in the menu.

## Run locally
```bash
cd game-platform
npm install
npm start                  # http://localhost:3000 → Host (instructor)
ROUND_SECONDS=5 npm start  # short clock for testing
```
