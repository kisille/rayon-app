const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'rayon.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- Mitarbeiter
    CREATE TABLE IF NOT EXISTS mitarbeiter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      personalnummer TEXT UNIQUE NOT NULL,
      telefon TEXT,
      email TEXT,
      stamm_rayon_id INTEGER,
      mitnahme_modus TEXT NOT NULL DEFAULT 'normal' CHECK(mitnahme_modus IN ('normal', 'teilweise', 'keine')),
      aktiv INTEGER DEFAULT 1,
      erstellt_am TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (stamm_rayon_id) REFERENCES rayone(id)
    );

    -- Rayone (Zustellbezirke)
    CREATE TABLE IF NOT EXISTS rayone (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nummer INTEGER UNIQUE NOT NULL,
      bezeichnung TEXT NOT NULL,
      gebiet TEXT,
      priorität TEXT NOT NULL DEFAULT 'normal',
      aktiv INTEGER DEFAULT 1
    );

    -- Kompetenzen: Welche Mitarbeiter können welche Rayone
    CREATE TABLE IF NOT EXISTS kompetenzen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id INTEGER NOT NULL,
      rayon_id INTEGER NOT NULL,
      level INTEGER NOT NULL CHECK(level IN (1, 2, 3)),
      UNIQUE(mitarbeiter_id, rayon_id),
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE,
      FOREIGN KEY (rayon_id) REFERENCES rayone(id) ON DELETE CASCADE
    );

    -- Monatliche Rayon-Zuteilungen
    CREATE TABLE IF NOT EXISTS monatszuteilungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monat TEXT NOT NULL,
      mitarbeiter_id INTEGER NOT NULL,
      rayon_id INTEGER NOT NULL,
      ist_teilzuteilung INTEGER DEFAULT 0,
      UNIQUE(monat, mitarbeiter_id),
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE,
      FOREIGN KEY (rayon_id) REFERENCES rayone(id) ON DELETE CASCADE
    );

    -- Abwesenheiten / Verfügbarkeit
    CREATE TABLE IF NOT EXISTS abwesenheiten (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id INTEGER NOT NULL,
      datum TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('anwesend', 'krank', 'urlaub', 'frei', 'sonstige')),
      bemerkung TEXT,
      UNIQUE(mitarbeiter_id, datum),
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    );

    -- Tagespläne: Welcher Mitarbeiter besetzt welchen Rayon an welchem Tag
    CREATE TABLE IF NOT EXISTS tagespläne (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datum TEXT NOT NULL,
      rayon_id INTEGER NOT NULL,
      mitarbeiter_id INTEGER,
      ist_vertretung INTEGER DEFAULT 0,
      ist_teilbesetzung INTEGER DEFAULT 0,
      vertritt_mitarbeiter_id INTEGER,
      bestätigt INTEGER DEFAULT 0,
      UNIQUE(datum, rayon_id),
      FOREIGN KEY (rayon_id) REFERENCES rayone(id),
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id),
      FOREIGN KEY (vertritt_mitarbeiter_id) REFERENCES mitarbeiter(id)
    );

    -- Mehrere Teilmitnahmen pro Rayon und Tag
    CREATE TABLE IF NOT EXISTS tagesplan_teilmitnahmen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datum TEXT NOT NULL,
      rayon_id INTEGER NOT NULL,
      mitarbeiter_id INTEGER NOT NULL,
      UNIQUE(datum, rayon_id, mitarbeiter_id),
      FOREIGN KEY (rayon_id) REFERENCES rayone(id) ON DELETE CASCADE,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    );

    -- Mitnahmeeinsätze für Fairness-Tracking
    CREATE TABLE IF NOT EXISTS vertretungseinsätze (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id INTEGER NOT NULL,
      datum TEXT NOT NULL,
      rayon_id INTEGER NOT NULL,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id),
      FOREIGN KEY (rayon_id) REFERENCES rayone(id)
    );

    -- Einsatzfahrzeuge
    CREATE TABLE IF NOT EXISTS fahrzeuge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kennzeichen TEXT UNIQUE NOT NULL,
      marke TEXT NOT NULL CHECK(marke IN ('Maxus', 'Peugeot', 'Mercedes')),
      modell TEXT,
      antrieb TEXT NOT NULL CHECK(antrieb IN ('Elektro', 'Diesel')),
      typ TEXT NOT NULL DEFAULT 'Zustellfahrzeug',
      status TEXT NOT NULL DEFAULT 'verfügbar' CHECK(status IN ('verfügbar', 'im_einsatz', 'werkstatt', 'ausser_betrieb')),
      mitarbeiter_id INTEGER,
      bemerkung TEXT,
      aktiv INTEGER DEFAULT 1,
      erstellt_am TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id)
    );

    -- Admin-Benutzer für Login
    CREATE TABLE IF NOT EXISTS benutzer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      benutzername TEXT UNIQUE NOT NULL,
      passwort_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      erstellt_am TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations: Spalten hinzufügen falls nicht vorhanden (für bestehende DBs)
  try { db.exec("ALTER TABLE mitarbeiter ADD COLUMN mitnahme_modus TEXT NOT NULL DEFAULT 'normal'"); } catch {}
  try { db.exec("ALTER TABLE rayone ADD COLUMN priorität INTEGER NOT NULL DEFAULT 5"); } catch {}
  try { db.exec("ALTER TABLE tagespläne ADD COLUMN ist_teilbesetzung INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE fahrzeuge ADD COLUMN mitarbeiter_id INTEGER REFERENCES mitarbeiter(id)"); } catch {}
  // Rayon-Priorität: alte Zahlenwerte in Modi umwandeln
  try { db.exec("UPDATE rayone SET priorität = 'normal' WHERE typeof(priorität) = 'integer' OR (priorität NOT IN ('wenig', 'normal', 'hoch'))"); } catch {}
  // Rayon-Bezeichnungen: feste "Rayon X"-Bezeichnung durch beschreibenden Gebietsnamen ersetzen
  try { db.exec("UPDATE rayone SET bezeichnung = gebiet WHERE bezeichnung = ('Rayon ' || CAST(nummer AS TEXT)) AND gebiet IS NOT NULL AND gebiet != ''"); } catch {}

  // Migration: UNIQUE(monat, mitarbeiter_id) → UNIQUE(monat, mitarbeiter_id, rayon_id)
  // Ermöglicht 1 Ganzmitnahme + max. 2 Teilmitnahmen pro Mitarbeiter pro Monat
  try {
    const tbl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='monatszuteilungen'").get();
    if (tbl && tbl.sql && !tbl.sql.includes('mitarbeiter_id, rayon_id')) {
      db.exec(`CREATE TABLE monatszuteilungen_mig (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monat TEXT NOT NULL,
        mitarbeiter_id INTEGER NOT NULL,
        rayon_id INTEGER NOT NULL,
        ist_teilzuteilung INTEGER DEFAULT 0,
        UNIQUE(monat, mitarbeiter_id, rayon_id),
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE,
        FOREIGN KEY (rayon_id) REFERENCES rayone(id) ON DELETE CASCADE
      )`);
      db.exec('INSERT OR IGNORE INTO monatszuteilungen_mig SELECT * FROM monatszuteilungen');
      db.exec('DROP TABLE monatszuteilungen');
      db.exec('ALTER TABLE monatszuteilungen_mig RENAME TO monatszuteilungen');
    }
  } catch (e) { console.error('Migration monatszuteilungen fehlgeschlagen:', e.message); }

  // Rayone 34–37 nachträglich einfügen falls noch nicht vorhanden
  const neueRayone = [
    [34, 'Rayon 34', 'Außenbezirk 7', 'normal'],
    [35, 'Rayon 35', 'Außenbezirk 8', 'normal'],
    [36, 'Rayon 36', 'Außenbezirk 9', 'normal'],
    [37, 'Rayon 37', 'Außenbezirk 10', 'normal'],
  ];
  for (const [nr, bez, geb, prio] of neueRayone) {
    try {
      db.prepare('INSERT OR IGNORE INTO rayone (nummer, bezeichnung, gebiet, priorität) VALUES (?, ?, ?, ?)').run(nr, bez, geb, prio);
    } catch {}
  }

  seedInitialData();
}

function seedInitialData() {
  // INSERT OR IGNORE damit fehlende Rayone nachträglich ergänzt werden
  // (z.B. wenn die Migration Rayone 34-37 bereits eingefügt hat, aber 1-33 fehlen)
  const rayonData = [
    [1, 'Rayon 1', 'Stadtmitte Nord', 'normal'],
    [2, 'Rayon 2', 'Stadtmitte Süd', 'normal'],
    [3, 'Rayon 3', 'Westend', 'normal'],
    [4, 'Rayon 4', 'Ostend', 'normal'],
    [5, 'Rayon 5', 'Nordstadt', 'normal'],
    [6, 'Rayon 6', 'Südstadt', 'normal'],
    [7, 'Rayon 7', 'Altstadt', 'normal'],
    [8, 'Rayon 8', 'Neustadt', 'normal'],
    [9, 'Rayon 9', 'Industriegebiet West', 'normal'],
    [10, 'Rayon 10', 'Industriegebiet Ost', 'normal'],
    [11, 'Rayon 11', 'Wohngebiet A', 'normal'],
    [12, 'Rayon 12', 'Wohngebiet B', 'normal'],
    [13, 'Rayon 13', 'Wohngebiet C', 'normal'],
    [14, 'Rayon 14', 'Gewerbegebiet', 'normal'],
    [15, 'Rayon 15', 'Bahnhofsviertel', 'normal'],
    [16, 'Rayon 16', 'Universitätsviertel', 'normal'],
    [17, 'Rayon 17', 'Krankenhaus-Umgebung', 'normal'],
    [18, 'Rayon 18', 'Einkaufszentrum', 'normal'],
    [19, 'Rayon 19', 'Stadtpark-Umgebung', 'normal'],
    [20, 'Rayon 20', 'Vorort Nord', 'normal'],
    [21, 'Rayon 21', 'Vorort Süd', 'normal'],
    [22, 'Rayon 22', 'Vorort West', 'normal'],
    [23, 'Rayon 23', 'Vorort Ost', 'normal'],
    [24, 'Rayon 24', 'Dorf A', 'normal'],
    [25, 'Rayon 25', 'Dorf B', 'normal'],
    [26, 'Rayon 26', 'Dorf C', 'normal'],
    [27, 'Rayon 27', 'Dorf D', 'normal'],
    [28, 'Rayon 28', 'Außenbezirk 1', 'normal'],
    [29, 'Rayon 29', 'Außenbezirk 2', 'normal'],
    [30, 'Rayon 30', 'Außenbezirk 3', 'normal'],
    [31, 'Rayon 31', 'Außenbezirk 4', 'normal'],
    [32, 'Rayon 32', 'Außenbezirk 5', 'normal'],
    [33, 'Rayon 33', 'Außenbezirk 6', 'normal'],
    [34, 'Rayon 34', 'Außenbezirk 7', 'normal'],
    [35, 'Rayon 35', 'Außenbezirk 8', 'normal'],
    [36, 'Rayon 36', 'Außenbezirk 9', 'normal'],
    [37, 'Rayon 37', 'Außenbezirk 10', 'normal'],
  ];

  for (const [nummer, bezeichnung, gebiet, prio] of rayonData) {
    try {
      db.prepare('INSERT OR IGNORE INTO rayone (nummer, bezeichnung, gebiet, priorität) VALUES (?, ?, ?, ?)').run(nummer, bezeichnung, gebiet, prio);
    } catch(e) { console.error('Rayon seed Fehler:', nummer, e.message); }
  }

  // Standard-Admin anlegen falls noch keiner existiert
  const bcrypt = require('bcryptjs');
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM benutzer').get();
  if (Number(adminCount.count) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO benutzer (benutzername, passwort_hash, name) VALUES (?, ?, ?)').run('admin', hash, 'Administrator');
  }
}

module.exports = { getDb };
