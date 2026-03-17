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
      marke TEXT NOT NULL,
      modell TEXT,
      antrieb TEXT NOT NULL CHECK(antrieb IN ('Elektro', 'Diesel')),
      typ TEXT NOT NULL DEFAULT 'Zustellfahrzeug',
      status TEXT NOT NULL DEFAULT 'verfügbar' CHECK(status IN ('verfügbar', 'im_einsatz', 'werkstatt', 'ausser_betrieb')),
      mitarbeiter_id INTEGER,
      bemerkung TEXT,
      erstzulassung TEXT,
      letzte_vorführung TEXT,
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

  // Migration: fahrzeuge Tabelle neu aufbauen ohne marke CHECK-Constraint (erweiterte Marken)
  try {
    const tbl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='fahrzeuge'").get();
    if (tbl && tbl.sql && tbl.sql.includes("CHECK(marke IN")) {
      db.exec(`PRAGMA foreign_keys = OFF`);
      db.exec(`CREATE TABLE fahrzeuge_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kennzeichen TEXT UNIQUE NOT NULL,
        marke TEXT NOT NULL,
        modell TEXT,
        antrieb TEXT NOT NULL CHECK(antrieb IN ('Elektro', 'Diesel')),
        typ TEXT NOT NULL DEFAULT 'Zustellfahrzeug',
        status TEXT NOT NULL DEFAULT 'verfügbar' CHECK(status IN ('verfügbar', 'im_einsatz', 'werkstatt', 'ausser_betrieb')),
        mitarbeiter_id INTEGER,
        bemerkung TEXT,
        erstzulassung TEXT,
        letzte_vorführung TEXT,
        aktiv INTEGER DEFAULT 1,
        erstellt_am TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id)
      )`);
      db.exec(`INSERT INTO fahrzeuge_new (id, kennzeichen, marke, modell, antrieb, typ, status, mitarbeiter_id, bemerkung, aktiv, erstellt_am)
               SELECT id, kennzeichen, marke, modell, antrieb, typ, status, mitarbeiter_id, bemerkung, aktiv, erstellt_am FROM fahrzeuge`);
      db.exec(`DROP TABLE fahrzeuge`);
      db.exec(`ALTER TABLE fahrzeuge_new RENAME TO fahrzeuge`);
      db.exec(`PRAGMA foreign_keys = ON`);
    }
  } catch (e) { console.error('Migration fahrzeuge rebuild:', e.message); }

  // Migration: neue Spalten für Fahrzeuge (falls Rebuild nicht erfolgt ist)
  try { db.exec("ALTER TABLE fahrzeuge ADD COLUMN erstzulassung TEXT"); } catch {}
  try { db.exec("ALTER TABLE fahrzeuge ADD COLUMN letzte_vorführung TEXT"); } catch {}

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

  seedInitialData();
}

function seedInitialData() {
  // Platzhalter-Rayone entfernen falls noch nicht genutzt
  const placeholderGebiete = [
    'Stadtmitte Nord', 'Stadtmitte Süd', 'Westend', 'Ostend', 'Nordstadt', 'Südstadt',
    'Altstadt', 'Neustadt', 'Industriegebiet West', 'Industriegebiet Ost',
    'Wohngebiet A', 'Wohngebiet B', 'Wohngebiet C', 'Gewerbegebiet', 'Bahnhofsviertel',
    'Universitätsviertel', 'Krankenhaus-Umgebung', 'Einkaufszentrum', 'Stadtpark-Umgebung',
    'Vorort Nord', 'Vorort Süd', 'Vorort West', 'Vorort Ost',
    'Dorf A', 'Dorf B', 'Dorf C', 'Dorf D',
    'Außenbezirk 1', 'Außenbezirk 2', 'Außenbezirk 3', 'Außenbezirk 4', 'Außenbezirk 5',
    'Außenbezirk 6', 'Außenbezirk 7', 'Außenbezirk 8', 'Außenbezirk 9', 'Außenbezirk 10',
  ];
  try {
    const placeholders = db.prepare(
      `SELECT id FROM rayone WHERE gebiet IN (${placeholderGebiete.map(() => '?').join(',')})
       AND NOT EXISTS (SELECT 1 FROM kompetenzen WHERE rayon_id = rayone.id)
       AND NOT EXISTS (SELECT 1 FROM monatszuteilungen WHERE rayon_id = rayone.id)
       AND NOT EXISTS (SELECT 1 FROM tagespläne WHERE rayon_id = rayone.id)
       AND NOT EXISTS (SELECT 1 FROM mitarbeiter WHERE stamm_rayon_id = rayone.id)`
    ).all(...placeholderGebiete);
    for (const r of placeholders) {
      db.prepare('DELETE FROM rayone WHERE id = ?').run(r.id);
    }
  } catch (e) { console.error('Cleanup placeholder Rayone:', e.message); }

  // Echte Zustellbezirke aus Österreichische Post
  const rayonData = [
    [10,   'Rayon 0010', null, 'normal'],
    [20,   'Rayon 0020', null, 'normal'],
    [40,   'Rayon 0040', null, 'normal'],
    [60,   'Rayon 0060', null, 'normal'],
    [80,   'Rayon 0080', null, 'normal'],
    [90,   'Rayon 0090', null, 'normal'],
    [100,  'Rayon 0100', null, 'normal'],
    [130,  'Rayon 0130', null, 'normal'],
    [140,  'Rayon 0140', null, 'normal'],
    [150,  'Rayon 0150', null, 'normal'],
    [160,  'Rayon 0160', null, 'normal'],
    [9010, 'Rayon 9010', null, 'normal'],
    [9020, 'Rayon 9020', null, 'normal'],
    [9030, 'Rayon 9030', null, 'normal'],
    [9040, 'Rayon 9040', null, 'normal'],
    [9050, 'Rayon 9050', null, 'normal'],
    [9060, 'Rayon 9060', null, 'normal'],
    [9070, 'Rayon 9070', null, 'normal'],
    [9080, 'Rayon 9080', null, 'normal'],
    [9090, 'Rayon 9090', null, 'normal'],
    [9100, 'Rayon 9100', null, 'normal'],
    [9110, 'Rayon 9110', null, 'normal'],
    [9120, 'Rayon 9120', null, 'normal'],
    [9130, 'Rayon 9130', null, 'normal'],
    [9140, 'Rayon 9140', null, 'normal'],
    [9150, 'Rayon 9150', null, 'normal'],
    [9160, 'Rayon 9160', null, 'normal'],
    [9170, 'Rayon 9170', null, 'normal'],
    [9180, 'Rayon 9180', null, 'normal'],
    [9200, 'Rayon 9200', null, 'normal'],
    [9210, 'Rayon 9210', null, 'normal'],
    [9220, 'Rayon 9220', null, 'normal'],
    [9230, 'Rayon 9230', null, 'normal'],
    [9240, 'Rayon 9240', null, 'normal'],
    [9250, 'Rayon 9250', null, 'normal'],
    [9260, 'Rayon 9260', null, 'normal'],
  ];

  for (const [nummer, bezeichnung, gebiet, prio] of rayonData) {
    try {
      db.prepare('INSERT OR IGNORE INTO rayone (nummer, bezeichnung, gebiet, priorität) VALUES (?, ?, ?, ?)').run(nummer, bezeichnung, gebiet, prio);
    } catch(e) { console.error('Rayon seed Fehler:', nummer, e.message); }
  }

  // Fahrzeuge aus Fahrzeugstand
  // [kennzeichen, marke, antrieb, typ, status]
  const fahrzeugData = [
    // Peugeot (Diesel, Zustellfahrzeug)
    ['PT 10824', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 92132', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11192', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11194', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11195', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11196', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11218', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11219', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11220', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11221', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 10945', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 13876', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 92052', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 92060', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 92218', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 11947', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 13971', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 14049', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 14022', 'Peugeot', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    // Renault (Diesel, Zustellfahrzeug)
    ['PT 11581', 'Renault', 'Diesel', 'Zustellfahrzeug', 'verfügbar'],
    // Fiat (außer Betrieb - durchgestrichen)
    ['PT 10491', 'Fiat', 'Diesel', 'Zustellfahrzeug', 'ausser_betrieb'],
    // Mercedes-Benz (Elektro, Grosspaketfahrzeug)
    ['PT 92494', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 92470', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 92660', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 92661', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 92766', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 92659', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 93021', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 93020', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 92955', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 93022', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 93023', 'Mercedes', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    // Maxus (Elektro, Zustellfahrzeug)
    ['PT 16282', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16284', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16288', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16287', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16289', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16296', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16293', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16291', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16285', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16290', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16880', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16892', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16884', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16882', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16876', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16878', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16887', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16888', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16817', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16883', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16881', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    ['PT 16821', 'Maxus', 'Elektro', 'Zustellfahrzeug', 'verfügbar'],
    // Jumug (Elektro, Grosspaketfahrzeug)
    ['PT 104158', 'Jumug', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
    ['PT 104160', 'Jumug', 'Elektro', 'Grosspaketfahrzeug', 'verfügbar'],
  ];

  for (const [kennzeichen, marke, antrieb, typ, status] of fahrzeugData) {
    try {
      db.prepare(`INSERT OR IGNORE INTO fahrzeuge (kennzeichen, marke, antrieb, typ, status) VALUES (?, ?, ?, ?, ?)`)
        .run(kennzeichen, marke, antrieb, typ, status);
    } catch(e) { console.error('Fahrzeug seed Fehler:', kennzeichen, e.message); }
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
