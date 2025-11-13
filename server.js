const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ---------------------------
// SheetDB Config
// ---------------------------
const SHEETDB_BASE_URL = "https://sheetdb.io/api/v1/1v70fvkbzklbs";
const SHEET_USERS = "Users";
function sheetUrl(sheetName) {
  return `${SHEETDB_BASE_URL}?sheet=${sheetName}`;
}

// ---------------------------
// GitHub Config
// ---------------------------
const GITHUB_OWNER = "cingcing12";
const GITHUB_REPO = "dashboard_sytem";
const GITHUB_FOLDER = "faces";
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json());

// ---------------------------
// Multer Config (temporary local storage)
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const emailSafe = req.body.email.replace(/[@.]/g, "_");
    cb(null, `${emailSafe}.jpg`);
  }
});
const upload = multer({ storage });

// ---------------------------
// GitHub Helper Functions
// ---------------------------
async function getFileSha(repoPath) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${repoPath}`;
  const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
  if (res.status === 200) {
    const data = await res.json();
    return data.sha;
  }
  return null;
}

async function uploadToGitHub(filePath, repoPath) {
  const content = fs.readFileSync(filePath, { encoding: "base64" });
  const sha = await getFileSha(repoPath);
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${repoPath}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: sha ? `Update face image ${repoPath}` : `Add face image ${repoPath}`,
      content,
      ...(sha && { sha })
    })
  });

  const data = await res.json();
  if (data.content && data.content.download_url) return data.content.download_url;
  throw new Error(`GitHub upload failed: ${JSON.stringify(data)}`);
}

// ---------------------------
// Register User Endpoint
// ---------------------------
app.post("/api/register", upload.single("faceImage"), async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !req.file)
    return res.status(400).json({ error: "Missing required fields" });

  const safeEmail = email.replace(/[@.]/g, "_");
  const localPath = req.file.path;
  const githubPath = `${GITHUB_FOLDER}/${safeEmail}.jpg`;

  try {
    // Upload image to GitHub
    const githubUrl = await uploadToGitHub(localPath, githubPath);
    console.log("✅ Uploaded to GitHub:", githubUrl);

    // Save user to SheetDB
    const userData = {
      Email: email,
      PasswordHash: password,
      Role: role || "Staff",
      IsBlocked: "FALSE",
      LastLogin: "",
      FaceImageFile: `${safeEmail}.jpg`
    };

    const sheetRes = await fetch(sheetUrl(SHEET_USERS), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [userData] })
    });

    const sheetJson = await sheetRes.json();
    if (!sheetRes.ok) {
      console.error("❌ SheetDB error:", sheetJson);
      return res.status(500).json({ error: "Failed to save user to SheetDB", details: sheetJson });
    }

    // Remove local temp file
    fs.unlinkSync(localPath);

    res.json({ success: true, message: "User saved with face image on GitHub", githubUrl });
  } catch (err) {
    console.error("❌ Error:", err);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    res.status(500).json({ error: "Failed to save user or upload image", details: err.message });
  }
});

// ---------------------------
// Fetch All Users
// ---------------------------
app.get("/api/users", async (req, res) => {
  try {
    const response = await fetch(sheetUrl(SHEET_USERS));
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ---------------------------
// Start Server
// ---------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
