const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data.db");

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    seed(db);
    save();
  }

  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function seed(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT NOT NULL,
      distance_km REAL,
      difficulty TEXT CHECK(difficulty IN ('Easy','Moderate','Hard')) DEFAULT 'Easy',
      max_participants INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(event_id, email)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      distance_miles REAL,
      difficulty TEXT CHECK(difficulty IN ('Easy','Moderate','Hard')) DEFAULT 'Easy',
      description TEXT,
      approved INTEGER DEFAULT 0,
      submitted_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      joined_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed events
  const now = new Date();
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  const nextSun = new Date(nextSat);
  nextSun.setDate(nextSat.getDate() + 1);
  const nextWed = new Date(now);
  nextWed.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));

  const fmt = (d) => d.toISOString().split("T")[0];

  db.run(`INSERT INTO events (title, description, date, time, location, distance_km, difficulty, max_participants) VALUES
    ('Morning Glory Run', 'Start your weekend strong with our flagship group run through Lucknow''s most scenic routes. All paces welcome.', '${fmt(nextSat)}', '06:00 AM', 'Janeshwar Mishra Park, Lucknow', 8.0, 'Easy', 50),
    ('Sunday Long Run', 'The weekly long run for those training for their next race. Structured pace groups.', '${fmt(nextSun)}', '06:30 AM', 'Gomti Riverfront, Lucknow', 15.0, 'Moderate', 30),
    ('Weekday Easy Run', 'Mid-week shakeout run. Short, social, stress-free.', '${fmt(nextWed)}', '06:00 AM', 'Ambedkar Park, Lucknow', 5.0, 'Easy', 40)
  `);

  // Seed routes
  db.run(`INSERT INTO routes (name, distance_miles, difficulty, description, approved) VALUES
    ('Gomti Riverfront Loop', 4.2, 'Easy', 'Flat paved path along the river. Great for beginners and morning jogs. Beautiful sunrise views.', 1),
    ('Janeshwar Mishra Park Circuit', 3.1, 'Easy', 'Well-maintained park loop with shade trees. Popular with families and club runners alike.', 1),
    ('Hazratganj Heritage Trail', 5.5, 'Moderate', 'Run through the heart of old Lucknow. Mix of roads and lanes. Best done early morning before traffic.', 1)
  `);

  console.log("Database seeded.");
}

module.exports = { getDb, save };
