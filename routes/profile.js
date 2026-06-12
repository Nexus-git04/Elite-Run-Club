const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getDb, save } = require("../db");
const { signToken, requireAuth } = require("../auth");
const email = require("../email");

const router = express.Router();

// ── Avatar upload config ──────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, "../public/uploads/avatars"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only JPG, PNG, or WebP images are allowed"));
  },
});

// ── Helpers ───────────────────────────────────────────────────────────

function rowsToObjects(result) {
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row) =>
    Object.fromEntries(cols.map((c, i) => [c, row[i]]))
  );
}

function safeUser(member) {
  const { password_hash, ...safe } = member;
  return safe;
}

// ── POST /api/auth/register ───────────────────────────────────────────

router.post("/register", async (req, res) => {
  try {
    const db = await getDb();
    const { name, email: userEmail, password, phone } = req.body;

    if (!name || !userEmail || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check duplicate
    const existing = db.exec(
      `SELECT id FROM members WHERE email = '${userEmail.toLowerCase().replace(/'/g, "''")}'`
    );
    if (existing.length && existing[0].values.length) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hash = await bcrypt.hash(password, 12);
    db.run(
      `INSERT INTO members (name, email, password_hash, phone) VALUES (?, ?, ?, ?)`,
      [name, userEmail.toLowerCase(), hash, phone || null]
    );
    save();

    // Fetch the new member
    const result = db.exec(
      `SELECT * FROM members WHERE email = '${userEmail.toLowerCase().replace(/'/g, "''")}'`
    );
    const member = rowsToObjects(result)[0];
    const token = signToken({ id: member.id, email: member.email });

    email.sendWelcomeEmail({ name, email: userEmail.toLowerCase() });

    res.status(201).json({ token, user: safeUser(member) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────

router.post("/login", async (req, res) => {
  try {
    const db = await getDb();
    const { email: userEmail, password } = req.body;

    if (!userEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = db.exec(
      `SELECT * FROM members WHERE email = '${userEmail.toLowerCase().replace(/'/g, "''")}'`
    );
    const member = rowsToObjects(result)[0];

    if (!member) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, member.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ id: member.id, email: member.email });
    res.json({ token, user: safeUser(member) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /api/profile ──────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM members WHERE id = ${req.user.id}`);
    const member = rowsToObjects(result)[0];
    if (!member) return res.status(404).json({ error: "User not found" });
    res.json(safeUser(member));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ── PATCH /api/profile ────────────────────────────────────────────────

router.patch("/", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { name, phone } = req.body;

    // Email changes need re-verification — not allowed here
    const fields = [];
    const params = [];
    if (name) { fields.push("name = ?"); params.push(name); }
    if (phone !== undefined) { fields.push("phone = ?"); params.push(phone || null); }

    if (!fields.length) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    params.push(req.user.id);
    db.run(`UPDATE members SET ${fields.join(", ")} WHERE id = ?`, params);
    save();

    const result = db.exec(`SELECT * FROM members WHERE id = ${req.user.id}`);
    res.json(safeUser(rowsToObjects(result)[0]));
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ── PATCH /api/profile/password ───────────────────────────────────────

router.patch("/password", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: "Both current and new password are required" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const result = db.exec(`SELECT * FROM members WHERE id = ${req.user.id}`);
    const member = rowsToObjects(result)[0];

    const valid = await bcrypt.compare(current_password, member.password_hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(new_password, 12);
    db.run(`UPDATE members SET password_hash = ? WHERE id = ?`, [hash, req.user.id]);
    save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

// ── POST /api/profile/avatar ──────────────────────────────────────────

router.post("/avatar", requireAuth, (req, res) => {
  avatarUpload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const db = await getDb();

      // Delete old avatar if it exists
      const existing = db.exec(`SELECT avatar FROM members WHERE id = ${req.user.id}`);
      const oldAvatar = rowsToObjects(existing)[0]?.avatar;
      if (oldAvatar) {
        const oldPath = path.join(__dirname, "../public", oldAvatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      db.run(`UPDATE members SET avatar = ? WHERE id = ?`, [avatarPath, req.user.id]);
      save();

      res.json({ avatar: avatarPath });
    } catch (err) {
      res.status(500).json({ error: "Failed to save avatar" });
    }
  });
});

// ── GET /api/profile/runs ─────────────────────────────────────────────

router.get("/runs", requireAuth, async (req, res) => {
  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT
        e.id, e.title, e.date, e.time, e.location,
        e.distance_km, e.difficulty,
        r.created_at AS rsvp_date,
        CASE WHEN date(e.date) >= date('now') THEN 'upcoming' ELSE 'past' END AS status
      FROM rsvps r
      JOIN events e ON e.id = r.event_id
      WHERE r.email = (SELECT email FROM members WHERE id = ${req.user.id})
      ORDER BY e.date DESC
    `);

    const runs = rowsToObjects(result);
    const upcoming = runs.filter((r) => r.status === "upcoming");
    const past = runs.filter((r) => r.status === "past");

    res.json({ upcoming, past });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch runs" });
  }
});

module.exports = router;