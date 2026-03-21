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
      status TEXT NOT NULL CHECK(status IN ('anwesend', 'krank', 'urlaub', 'frei', 'kur', 'sonstige')),
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
      rolle TEXT NOT NULL DEFAULT 'admin',
      erstellt_am TEXT DEFAULT (datetime('now'))
    );

    -- Audit-Log: Wer hat wann was geändert
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zeitstempel TEXT DEFAULT (datetime('now')),
      benutzer_id INTEGER,
      benutzername TEXT NOT NULL,
      methode TEXT NOT NULL,
      pfad TEXT NOT NULL,
      details TEXT
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
  try { db.exec("ALTER TABLE benutzer ADD COLUMN rolle TEXT NOT NULL DEFAULT 'admin'"); } catch {}

  // Migration: abwesenheiten CHECK constraint um 'kur' erweitern
  try {
    const tbl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='abwesenheiten'").get();
    if (tbl && tbl.sql && !tbl.sql.includes("'kur'")) {
      db.exec(`PRAGMA foreign_keys = OFF`);
      db.exec(`CREATE TABLE abwesenheiten_mig (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mitarbeiter_id INTEGER NOT NULL,
        datum TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('anwesend', 'krank', 'urlaub', 'frei', 'kur', 'sonstige')),
        bemerkung TEXT,
        UNIQUE(mitarbeiter_id, datum),
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
      )`);
      db.exec('INSERT OR IGNORE INTO abwesenheiten_mig SELECT * FROM abwesenheiten');
      db.exec('DROP TABLE abwesenheiten');
      db.exec('ALTER TABLE abwesenheiten_mig RENAME TO abwesenheiten');
      db.exec(`PRAGMA foreign_keys = ON`);
    }
  } catch (e) { console.error('Migration abwesenheiten kur:', e.message); }

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
    // Rayone aus Dienstplan März 2026 (neu)
    [170,  'Rayon 0170', null, 'normal'],
    [9190, 'Rayon 9190', null, 'normal'],
    [6010, 'Rayon 6010', null, 'normal'],
    [6030, 'Rayon 6030', null, 'normal'],
    [6040, 'Rayon 6040', null, 'normal'],
    [6050, 'Rayon 6050', null, 'normal'],
    [6060, 'Rayon 6060', null, 'normal'],
    [6080, 'Rayon 6080', null, 'normal'],
    [6210, 'Rayon 6210', null, 'normal'],
    [6220, 'Rayon 6220', null, 'normal'],
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

  // Mitarbeiter aus Mitarbeiterliste
  const mitarbeiterData = [
    // Foto 1
    ['418649',   'Lesinger Patafta Biserka'],
    ['342962',   'Stark Claudia'],
    ['401363',   'Racz Vivien'],
    ['406328',   'Winkler Bettina'],
    ['401252',   'Szenyeri Janos'],
    ['86189',    'Sauerwein Dietmar'],
    ['339785',   'Dwomoh-Gyamfi Nana'],
    ['378701',   'Alsalamh Adel'],
    ['106981',   'Moosbrugger Georg'],
    ['425017',   'Al Melae Fayes'],
    ['417902',   'Matrai Klaudia'],
    ['418207',   'Ünver Kübra'],
    ['416590',   'Entner Dario'],
    ['377128',   'Bitschnau Martina'],
    ['423521',   'Spisiak Martin'],
    ['369399',   'Ülker Levent'],
    ['400569',   'Kantor Alex'],
    ['422591',   'Knobelspieß Kilian'],
    ['90023882', 'Matrai Kristof Erik'],
    ['90022756', 'Farha Ahmed'],
    ['333721',   'Kröpfl Marion'],
    ['90023826', 'Alkurdi Khaled'],
    ['338170',   'Hanning Jan'],
    ['230596',   'Frank-Rauter Isabella'],
    ['359852',   'Shabani Xhevat'],
    ['26402',    'Jochum Erwin'],
    ['141973',   'Rudigier Walter'],
    ['354319',   'Hansel Nataliya'],
    ['359778',   'Öztürk Sükran'],
    ['422015',   'Antonenko Zhanna'],
    ['422042',   'Omer Amer'],
    ['419119',   'Alhussain Alohamad Qutada'],
    ['413946',   'Fischer Maurice'],
    ['424211',   'Gaßner David'],
    ['355431',   'Federer Tanja'],
    ['19364',    'Bischof Reinhold'],
    ['345439',   'Bertsch Ruth'],
    ['334291',   'Zeller Fabienne'],
    ['415106',   'Antonenko Artem'],
    ['418217',   'Beiter Liam'],
    ['425480',   'Demir Büsra'],
    ['425885',   'Yaryna Lytvyn'],
    ['90033401', 'Marton Abraham'],
    ['90033227', 'Dominik Balazs'],
    ['90020590', 'Bucsa Andrei Paul'],
    ['90023831', 'Al Koosa Ziad'],
    // Foto 2
    ['381792',   'Voicianu Christian-Narcis'],
    ['417921',   'Yarar Kemal'],
    ['422486',   'Catal Mehmed'],
    ['422904',   'Illes Mihaly'],
    ['383270',   'Walter Wolfgang'],
    ['424151',   'Alsamara Ghassan'],
    ['424137',   'Liura Taras'],
    ['374765',   'Dreznjak Doris'],
    ['359973',   'Kampl Silke'],
    ['65071',    'Schäfer Renate'],
    ['350611',   'Zerlauth Margit'],
    ['407009',   'Kantor Laszlo'],
    ['421468',   'Taher Daher Asaad'],
  ];

  for (const [personalnummer, name] of mitarbeiterData) {
    try {
      db.prepare('INSERT OR IGNORE INTO mitarbeiter (personalnummer, name) VALUES (?, ?)').run(personalnummer, name);
    } catch(e) { console.error('Mitarbeiter seed Fehler:', personalnummer, e.message); }
  }

  // Monatszuteilungen März 2026 – aus Dienstplan abgelesen
  seedMonatszuteilungen2026_03();

  // Standard-Admin anlegen falls noch keiner existiert
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM benutzer').get();
  if (Number(adminCount.count) === 0) {
    const initialPasswort = process.env.ADMIN_PASSWORT || crypto.randomBytes(12).toString('base64url');
    const hash = bcrypt.hashSync(initialPasswort, 10);
    db.prepare('INSERT INTO benutzer (benutzername, passwort_hash, name) VALUES (?, ?, ?)').run('admin', hash, 'Administrator');
    console.log(`[Setup] Admin-Benutzer angelegt. Benutzername: admin`);
    if (!process.env.ADMIN_PASSWORT) {
      console.log(`[Setup] Initiales Passwort (einmalig): ${initialPasswort}`);
      console.log(`[Setup] Bitte sofort nach dem ersten Login ändern!`);
    }
  }
}

function seedMonatszuteilungen2026_03() {
  const monat = '2026-03';
  // Nur seeden wenn für diesen Monat noch gar keine Daten existieren (verhindert Reset bei Neustart)
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM monatszuteilungen WHERE monat = ?').get(monat);
  if (existing && existing.cnt > 0) return;

  // PNR → Rayon-Nummer (abgelesen aus Dienstplan-Foto März 2026, gerundet auf 10er)
  const zuteilungen = [
    ['418649', 9050],   // Lesinger Patafta Biserka
    ['342962', 10],     // Stark Claudia
    ['401363', 40],     // Racz Vivien
    ['86189',  130],    // Sauerwein Dietmar
    ['339785', 130],    // Dwomoh-Gyamfi Nana
    ['378701', 150],    // Alsalamh Adel
    ['106981', 150],    // Moosbrugger Georg
    ['425017', 90],     // Al Melae Fayes
    ['417902', 140],    // Matrai Klaudia
    ['418207', 160],    // Ünver Kübra
    ['416590', 9190],   // Entner Dario
    ['377128', 9150],   // Bitschnau Martina
    ['423521', 100],    // Spisiak Martin
    ['369399', 40],     // Ülker Levent
    ['400569', 160],    // Kantor Alex
    ['422591', 9020],   // Knobelspieß Kilian
    ['90023882', 9030], // Matrai Kristof Erik
    ['90022756', 9060], // Farha Ahmed
    ['333721', 9060],   // Kröpfl Marion
    ['338170', 9070],   // Hanning Jan
    ['230596', 9080],   // Frank-Rauter Isabella
    ['359852', 9100],   // Shabani Xhevat
    ['26402',  9110],   // Jochum Erwin
    ['354319', 9160],   // Hansel Nataliya
    ['422015', 9180],   // Antonenko Zhanna
    ['422042', 9180],   // Omer Amer
    ['419119', 9260],   // Alhussain Alohamad Qutada
    ['413946', 60],     // Fischer Maurice
    ['424211', 9200],   // Gaßner David
    ['355431', 9210],   // Federer Tanja
    ['19364',  9220],   // Bischof Reinhold
    ['345439', 9230],   // Bertsch Ruth
    ['334291', 9120],   // Zeller Fabienne
    ['415106', 9240],   // Antonenko Artem
    ['418217', 9140],   // Beiter Liam
    ['425480', 170],    // Demir Büsra
    ['425885', 20],     // Yaryna Lytvyn
    ['90033401', 9130], // Marton Abraham
    ['90020590', 6030], // Bucsa Andrei Paul
    // Seite 2 (Team 6700T02)
    ['381792', 6080],   // Voicianu Christian-Narcis
    ['417921', 6010],   // Yarar Kemal
    ['422486', 6060],   // Catal Mehmed
    ['422904', 6010],   // Illes Mihaly
    ['424137', 6050],   // Liura Taras
    ['359973', 6220],   // Kampf Silke
    ['407009', 6210],   // Kantor Laszlo
    ['421468', 6210],   // Taher Daher Asaad
  ];

  const insertZuteilung = db.prepare(`
    INSERT OR IGNORE INTO monatszuteilungen (monat, mitarbeiter_id, rayon_id, ist_teilzuteilung)
    SELECT ?, m.id, r.id, 0
    FROM mitarbeiter m, rayone r
    WHERE m.personalnummer = ? AND r.nummer = ? AND m.aktiv = 1 AND r.aktiv = 1
  `);

  for (const [pnr, rayonNummer] of zuteilungen) {
    try {
      insertZuteilung.run(monat, pnr, rayonNummer);
    } catch(e) { console.error('Monatszuteilung seed Fehler:', pnr, rayonNummer, e.message); }
  }
}

module.exports = { getDb };
