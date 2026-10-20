# Who Regulates You? — live classroom web app

A Kahoot-style live game for ISI 315 Week 7 (Compliance, Regulation, and Security
Frameworks). Built on the Stop the Breach engine. The teacher hosts on the projector and
gets a PIN and QR code; students join on their phones or laptops. Each round describes a
real kind of organization, and teams pick which rule governs its security:

A HIPAA · B GLBA · C PCI DSS · D HIPAA + PCI DSS · E GLBA + PCI DSS · F None of the three

- **Host screen:** `/host.html` — QR code and PIN, the story and six choices to read aloud, round controls, live scoreboard.
- **Student device:** `/play.html` — enter the PIN and a name, then tap a choice each round.
- The **answer key lives only on the server**, so students can't read ahead in page source.

## How a class runs (~30 min play + ~10 min debrief)
1. Open `/host.html` on the projector. Read the story and the six choices aloud.
2. Students scan the QR code (or open the site → **Join**) and enter the PIN and a team name.
3. Click **Start**. Each round: read the organization, let teams pick, then **Reveal**
   (auto-scores +10; round 6, the "trap" round, is +20). The reveal shows the answer, the
   reason, and a discussion question. **Next** moves on.
4. Bonus round (+10 for any answer), then the winner, the Target twist, three
   takeaways, and the debrief questions.
5. When class is done, click **End game for everyone** on the results screen. (Phones that
   lock or drop Wi-Fi keep their seat and score; a host screen that sleeps has 10 minutes to
   come back.)

| Round | Organization | Answer |
|---|---|---|
| 1 | Dental practice: bills insurance electronically, takes cards | D |
| 2 | CSI financial aid office | B |
| 3 | Cloud company storing a hospital's patient records | A |
| 4 | Car dealership arranging auto loans, takes cards | E |
| 5 | Free mobile game, collects emails only | F |
| 6 | Direct-to-consumer fitness app, card subscriptions (×2) | C |
| 7 | Public company CEO/CFO certifying financial reports | D: SOX |
| 8 | CSI registrar: grades and transcripts | E: FERPA |
| 9 | Staten Island shop with customers in France and Germany | F: GDPR |
| 10 | Monthly patching (vs. auditing that it worked) | A: Due care |

Rounds 7–10 ("beyond the big three") bring their own choices — HIPAA, GLBA, PCI DSS, SOX, FERPA, GDPR, or due care vs. due diligence — and cover the Quiz 7 items the slides don't.

## Run it locally
```bash
cd who-regulates-you
npm install
npm start
```
Open **http://localhost:3000** → **Host**. Needs Node 18+.

## Editing the game
All teaching content — story, six choices, rounds, answer key, bonus, twist, takeaways,
and debrief — lives in `server.js` under the `GAME` object.
