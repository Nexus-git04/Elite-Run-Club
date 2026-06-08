const express = require("express");
const cors = require("cors");
const path = require("path");
const { getDb, save } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static HTML pages
app.use(express.static(path.join(__dirname, "public")));
app.use("/static", express.static(path.join(__dirname, "static")));

// ─────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────

// GET /api/events?filter=all|weekend|weekday
app.get("/api/events", async (req, res) => {
  try {
    const db = await getDb();
    const { filter } = req.query;

    let query = `
      SELECT e.*,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS rsvp_count
      FROM events e
      WHERE date(e.date) >= date('now')
      ORDER BY e.date ASC, e.time ASC
    `;

    const results = db.exec(query);
    if (!results.length) return res.json([]);

    const cols = results[0].columns;
    let events = results[0].values.map((row) =>
      Object.fromEntries(cols.map((c, i) => [c, row[i]]))
    );

    // Filter by day type
    if (filter === "weekend") {
      events = events.filter((e) => {
        const day = new Date(e.date).getDay();
        return day === 0 || day === 6;
      });
    } else if (filter === "weekday") {
      events = events.filter((e) => {
        const day = new Date(e.date).getDay();
        return day >= 1 && day <= 5;
      });
    }

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// GET /api/events/next — for "Join Next Run" button
app.get("/api/events/next", async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT e.*,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS rsvp_count
      FROM events e
      WHERE date(e.date) >= date('now')
      ORDER BY e.date ASC, e.time ASC
      LIMIT 1
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ error: "No upcoming events" });
    }

    const cols = result[0].columns;
    const event = Object.fromEntries(
      cols.map((c, i) => [c, result[0].values[0][i]])
    );
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch next event" });
  }
});

// GET /api/events/:id
app.get("/api/events/:id", async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT e.*,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS rsvp_count
      FROM events e WHERE e.id = ${parseInt(req.params.id)}
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const cols = result[0].columns;
    const event = Object.fromEntries(
      cols.map((c, i) => [c, result[0].values[0][i]])
    );
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// POST /api/events/:id/rsvp
app.post("/api/events/:id/rsvp", async (req, res) => {
  try {
    const db = await getDb();
    const eventId = parseInt(req.params.id);
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Check event exists
    const eventCheck = db.exec(
      `SELECT id, max_participants FROM events WHERE id = ${eventId}`
    );
    if (!eventCheck.length || !eventCheck[0].values.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const maxParticipants = eventCheck[0].values[0][1];

    // Check capacity
    const countResult = db.exec(
      `SELECT COUNT(*) FROM rsvps WHERE event_id = ${eventId}`
    );
    const currentCount = countResult[0].values[0][0];

    if (maxParticipants && currentCount >= maxParticipants) {
      return res.status(409).json({ error: "Event is full" });
    }

    // Insert RSVP (UNIQUE constraint on event_id + email handles duplicates)
    try {
      db.run(
        `INSERT INTO rsvps (event_id, name, email, phone) VALUES (?, ?, ?, ?)`,
        [eventId, name, email.toLowerCase(), phone || null]
      );
      save();
      res.status(201).json({ message: "RSVP confirmed! See you at the run." });
    } catch (dupErr) {
      // SQLite UNIQUE constraint violation
      res.status(409).json({ error: "You've already RSVP'd for this event" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save RSVP" });
  }
});

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// GET /api/routes?difficulty=Easy|Moderate|Hard
app.get("/api/routes", async (req, res) => {
  try {
    const db = await getDb();
    const { difficulty } = req.query;

    let query = `SELECT * FROM routes WHERE approved = 1`;
    if (difficulty && ["Easy", "Moderate", "Hard"].includes(difficulty)) {
      query += ` AND difficulty = '${difficulty}'`;
    }
    query += ` ORDER BY created_at DESC`;

    const result = db.exec(query);
    if (!result.length) return res.json([]);

    const cols = result[0].columns;
    const routes = result[0].values.map((row) =>
      Object.fromEntries(cols.map((c, i) => [c, row[i]]))
    );
    res.json(routes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

// POST /api/routes — submit a new route for review
app.post("/api/routes", async (req, res) => {
  try {
    const db = await getDb();
    const { name, distance_miles, difficulty, description, submitted_by } =
      req.body;

    if (!name) {
      return res.status(400).json({ error: "Route name is required" });
    }

    db.run(
      `INSERT INTO routes (name, distance_miles, difficulty, description, submitted_by, approved)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        name,
        parseFloat(distance_miles) || null,
        difficulty || "Easy",
        description || null,
        submitted_by || null,
      ]
    );
    save();

    res
      .status(201)
      .json({ message: "Route submitted for review. Thanks for contributing!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit route" });
  }
});

// ─────────────────────────────────────────────
// MEMBERS
// ─────────────────────────────────────────────

// POST /api/members — join the club / get member kit
app.post("/api/members", async (req, res) => {
  try {
    const db = await getDb();
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    try {
      db.run(`INSERT INTO members (name, email) VALUES (?, ?)`, [
        name,
        email.toLowerCase(),
      ]);
      save();
      res.status(201).json({
        message: "Welcome to Elite Run Club! Check your email for next steps.",
      });
    } catch (dupErr) {
      res.status(409).json({ error: "You're already a member!" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register member" });
  }
});

// ─────────────────────────────────────────────
// PAGE ROUTES — serve HTML files
// ─────────────────────────────────────────────

const pages = {
  "/": "index.html",
  "/events": "events.html",
  "/routes": "routes.html",
  "/community": "community.html",
};

Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, "public", file));
  });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

app.listen(PORT, async () => {
  await getDb(); // ensure DB is initialized on start
  console.log(`Elite Run Club server running at http://localhost:${PORT}`);
});
