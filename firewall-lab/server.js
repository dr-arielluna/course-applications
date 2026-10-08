"use strict";
// Firewall Lab — static server. All logic runs in the browser (single-user tool).
const path = require("path");
const express = require("express");
const app = express();
app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Firewall Lab running on port " + PORT));
