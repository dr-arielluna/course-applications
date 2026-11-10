"use strict";
/* Stop the Breach: Checkout — ISI 315 Week 8. Content copied verbatim from ../checkout-breach/server.js. */
const GAME = {
  story:
    "SkyLine Airways sells tickets on its website and app. At checkout, customers type their name, card number, expiry date, and security code. The checkout page runs a few small JavaScript programs in each customer's browser — some written by SkyLine, some borrowed from outside libraries. A baggage-handling partner also has remote login access to SkyLine's systems. One summer, someone attacks — and the attack runs for two weeks.",
  defenses: [
    { id: "A", name: "Two-step login for partners", desc: "a partner's login needs a one-time code, not just a password." },
    { id: "B", name: "Lock up the admin passwords", desc: "admin passwords live in a protected vault — never typed into files or scripts." },
    { id: "C", name: "File-change alarm", desc: "alerts the team the moment a website file changes without an approved release." },
    { id: "D", name: "Script fingerprint check", desc: "browsers refuse to run a script that doesn't match its known fingerprint (Subresource Integrity)." },
    { id: "E", name: "Approved-destinations list", desc: "the page may only load scripts from, and send data to, approved addresses (Content Security Policy)." },
    { id: "F", name: "Treat typed text as text", desc: "anything a user types is encoded on output, so it is shown — never run (output encoding)." },
  ],
  rounds: [
    { move: "An attacker gets the password of a staff member at the baggage partner and uses it to log in remotely.",
      works: ["A"], points: 10,
      why: "A two-step login (A) makes a stolen password useless on its own — the attacker still can't get in.",
      discuss: "The partner's staff member wasn't SkyLine's employee. Whose job was it to require a second step?" },
    { move: "Inside, the attacker searches shared files and finds an administrator's password typed in plain text.",
      works: ["B"], points: 10,
      why: "If admin passwords live only in a protected vault (B), there is nothing lying around to find.",
      discuss: "Why do busy IT teams end up writing passwords into files and scripts? What makes the safe way easier?" },
    { move: "Now acting as an administrator, the attacker quietly adds 22 lines of code to a JavaScript file the checkout page loads.",
      works: ["C"], points: 10,
      why: "A file-change alarm (C) should fire the moment a live checkout script changes without an approved release.",
      discuss: "Twenty-two lines in a big website. How would you even know a file changed — and who should get the alert?" },
    { move: "Meanwhile, a copycat tries a different trick: typing a script into the booking form's 'special requests' box, hoping it runs on staff screens.",
      works: ["F", "E"], points: 10,
      why: "That's cross-site scripting. Encoding output (F) displays the script as harmless text; an approved-destinations list (E) stops it calling home. Filtering input alone is easy to sneak past — the fix belongs on output.",
      discuss: "Why not just block the < and > characters on the way in? Think of a real customer that would break." },
    { move: "Customers open the checkout page. Their browsers download the changed script and run it.",
      works: ["D"], points: 10,
      why: "A fingerprint check (D) makes the browser refuse a script that no longer matches — so the edited code never runs.",
      discuss: "The browser did exactly what the page told it to. Is the browser wrong, or the page?" },
    { move: "As customers type, the script copies their card details and sends them to a look-alike web address the attacker registered — complete with a padlock icon.",
      works: ["E"], points: 20,
      why: "An approved-destinations list (E) blocks the data from going anywhere new. The padlock only means the connection is encrypted, not that the site is legitimate. Hardest to catch — double points.",
      discuss: "Customers saw a padlock. What does the padlock actually promise — and what doesn't it?" },
  ],
  bonus: { prompt: "If SkyLine could add only ONE of the six defenses, which would you choose?", points: 10 },
  reveal:
    "This really happened. It was British Airways in 2018. Attackers logged in with a stolen account belonging to a staff member at a baggage-handling partner — the remote-access system didn't ask for a second step. Inside, they found an administrator password stored in plain text, then changed a JavaScript file used on BA's payment pages. For about two weeks (21 Aug – 5 Sep 2018), card details typed into BA's website and app were sent to a look-alike site, baways.com. About 429,000 customers and staff were affected, and the UK data regulator (the ICO) fined BA £20 million.",
  lessons: [
    ["One partner login, no second step.", "A stolen password was all it took to get in (defense A was missing)."],
    ["The keys were lying around.", "An admin password in plain text turned a small break-in into full control (defense B was missing)."],
    ["Nobody noticed the change.", "The edited script ran for about two weeks; BA learned of it from an outside party, not its own monitoring (defense C was missing)."],
    ["The browser ran whatever it was given.", "Nothing checked the script's fingerprint or limited where it could send data (defenses D and E were missing). Same lesson as XSS: the fix belongs where output reaches the browser."],
  ],
  debrief: [
    "Tuesday's point: XSS is an output failure, not an input failure. Where did output go wrong in the BA attack?",
    "Defenses A–C protect the server; D–F protect the customer's browser. Which side did BA neglect more?",
    "If you could fund only TWO of the six defenses, which two would you buy, and why?",
  ],
};

module.exports = Object.assign({}, GAME, {
  "title": "Stop the Breach: Checkout",
  "kicker": "Week 8 · Software Security",
  "blurb": "British Airways 2018: stolen partner login, a tampered checkout script, and an XSS round.",
  "champion": "Breach Busters",
  "revealTitle": "The reveal",
  "lessonsTitle": "Why British Airways lost",
  "ui": {
    "choosing": "Students are choosing a defense on their devices…",
    "tap": "Tap the defense that stops this.",
    "right": "works!",
    "wrong": "wouldn't stop this",
    "bonusTap": "Pick the one you'd add first."
  },
  "lobby": {
    "label": "The six defenses",
    "note": ""
  },
  "id": "checkout-breach",
  "week": "Week 8",
  "day": "",
  "order": 3
});
