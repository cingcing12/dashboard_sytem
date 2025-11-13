const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ✅ Your SheetDB base + tab
const SHEETDB_BASE_URL = "https://sheetdb.io/api/v1/yypvlujsl3w1v";
const SHEET_USERS = "Users";
function sheetUrl(sheetName) {
    return `${SHEETDB_BASE_URL}?sheet=${sheetName}`;
}

app.use(cors()); // allow all origins (for development)
app.use(express.json());

// ================================
// ⚙️ MULTER CONFIG (Private Folder)
// ================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "faces");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const email = req.body.email.replace(/[@.]/g, "_");
    cb(null, `${email}.jpg`);
  }
});

const upload = multer({ storage });

// ================================
// 🧍 REGISTER USER + SAVE IMAGE
// ================================
app.post("/api/register", upload.single("faceImage"), async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !req.file)
    return res.status(400).json({ error: "Missing required fields" });

  const safeEmail = email.replace(/[@.]/g, "_");
  const faceFilename = `${safeEmail}.jpg`;

  const userData = {
  "Email": email,
  "PasswordHash": password,
  "Role": role || "Staff",
  "IsBlocked": "FALSE",
  "LastLogin": "",
  "FaceImageFile": faceFilename
};

  try {
    const sheetRes = await fetch(sheetUrl(SHEET_USERS), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [userData] })
    });

    const json = await sheetRes.json();
    console.log("✅ Added user to SheetDB:", json);

    res.json({
      success: true,
      message: "User and face image saved to Users tab",
      faceFilename
    });
  } catch (err) {
    console.error("❌ Error saving user:", err);
    res.status(500).json({ error: "Failed to save user to SheetDB" });
  }
});

// ================================
// 📋 FETCH ALL USERS
// ================================
app.get("/api/users", async (req, res) => {
  try {
    const response = await fetch(sheetUrl(SHEET_USERS));
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ================================
// 🔒 GET FACE IMAGE (Private Access)
// ================================
app.get("/api/face/:email", async (req, res) => {
  const safeEmail = req.params.email.replace(/[@.]/g, "_");
  const facePath = path.join(__dirname, "faces", `${safeEmail}.jpg`);

  if (!fs.existsSync(facePath))
    return res.status(404).json({ error: "Face image not found" });

  res.sendFile(facePath);
});

// ================================
// 🚀 START SERVER
// ================================
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
