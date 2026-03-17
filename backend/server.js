const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./database');
const { berechneMitnahmeplan } = require('./mitnahmeplaner');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'rayon-app-geheimnis-2024';

app.use(cors());
app.use(express.json());

// ─── Middleware: JWT Auth ─────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ fehler: 'Nicht authentifiziert' });
  try {
    req.benutzer = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ fehler: 'Token ungültig' });
  }
}

// Hilfsfunktion: aktuellen Rayon eines Mitarbeiters für einen Monat ermitteln
// Gibt nur die Ganzmitnahme (ist_teilzuteilung=0) zurück, nicht Teilmitnahmen
function getAktuellerRayon(db, mitarbeiterId, monat) {
  const zuteilung = db.prepare(`
    SELECT mz.*, r.nummer, r.bezeichnung, r.gebiet
    FROM monatszuteilungen mz
    JOIN rayone r ON mz.rayon_id = r.id
    WHERE mz.mitarbeiter_id = ? AND mz.monat = ? AND mz.ist_teilzuteilung = 0
  `).get(mitarbeiterId, monat);
  if (zuteilung) return { rayon_id: zuteilung.rayon_id, rayon_nummer: zuteilung.nummer, rayon_bezeichnung: zuteilung.bezeichnung, ist_teilzuteilung: zuteilung.ist_teilzuteilung };

  // Fallback auf Stamm-Rayon
  const stamm = db.prepare(`
    SELECT r.id as rayon_id, r.nummer, r.bezeichnung
    FROM mitarbeiter m
    JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE m.id = ?
  `).get(mitarbeiterId);
  if (stamm) return { rayon_id: stamm.rayon_id, rayon_nummer: stamm.nummer, rayon_bezeichnung: stamm.bezeichnung, ist_teilzuteilung: 0 };
  return null;
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { benutzername, passwort } = req.body;
  const db = getDb();
  const benutzer = db.prepare('SELECT * FROM benutzer WHERE benutzername = ?').get(benutzername);

  if (!benutzer || !bcrypt.compareSync(passwort, benutzer.passwort_hash)) {
    return res.status(401).json({ fehler: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign(
    { id: benutzer.id, benutzername: benutzer.benutzername, name: benutzer.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, name: benutzer.name });
});

// ─── Rayone ───────────────────────────────────────────────────────────────────
app.get('/api/rayone', authMiddleware, (req, res) => {
  const db = getDb();
  const monat = req.query.monat || new Date().toISOString().substring(0, 7);
  const heute = new Date().toISOString().split('T')[0];

  const rayone = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(DISTINCT k.mitarbeiter_id)
       FROM kompetenzen k
       WHERE k.rayon_id = r.id AND k.level IN (1, 2)) as anzahl_mitarbeiter
    FROM rayone r
    WHERE r.aktiv = 1
    ORDER BY r.nummer
  `).all();

  // Aktuelle Besetzung aus Monatszuteilungen
  const zuteilungen = db.prepare(`
    SELECT mz.rayon_id, m.id as mitarbeiter_id, m.name as mitarbeiter_name, mz.ist_teilzuteilung
    FROM monatszuteilungen mz
    JOIN mitarbeiter m ON mz.mitarbeiter_id = m.id
    WHERE mz.monat = ? AND m.aktiv = 1
  `).all(monat);

  const zuteilungMap = {};
  for (const z of zuteilungen) {
    if (!zuteilungMap[z.rayon_id]) zuteilungMap[z.rayon_id] = [];
    zuteilungMap[z.rayon_id].push(z);
  }

  // Fallback: Stamm-Rayon wenn keine Monatszuteilung
  const stammbesetzung = db.prepare(`
    SELECT m.stamm_rayon_id as rayon_id, m.id as mitarbeiter_id, m.name as mitarbeiter_name
    FROM mitarbeiter m
    WHERE m.aktiv = 1 AND m.stamm_rayon_id IS NOT NULL
  `).all();

  // Heutiger Tagesplan (überschreibt Monatsplan für Anzeige)
  const tagesplanHeute = db.prepare(`
    SELECT t.rayon_id, t.mitarbeiter_id, m.name as mitarbeiter_name, t.ist_teilbesetzung
    FROM tagespläne t
    JOIN mitarbeiter m ON t.mitarbeiter_id = m.id
    WHERE t.datum = ? AND t.mitarbeiter_id IS NOT NULL
  `).all(heute);
  const tagesplanHeuteMap = {};
  for (const t of tagesplanHeute) {
    if (!tagesplanHeuteMap[t.rayon_id]) tagesplanHeuteMap[t.rayon_id] = [];
    tagesplanHeuteMap[t.rayon_id].push({ mitarbeiter_id: t.mitarbeiter_id, mitarbeiter_name: t.mitarbeiter_name, ist_teilzuteilung: t.ist_teilbesetzung });
  }

  // Teilmitnahmen von heute auch einbeziehen
  const teilmitnahmenHeute = db.prepare(`
    SELECT tt.rayon_id, tt.mitarbeiter_id, m.name as mitarbeiter_name
    FROM tagesplan_teilmitnahmen tt
    JOIN mitarbeiter m ON tt.mitarbeiter_id = m.id
    WHERE tt.datum = ?
  `).all(heute);
  for (const t of teilmitnahmenHeute) {
    if (!tagesplanHeuteMap[t.rayon_id]) tagesplanHeuteMap[t.rayon_id] = [];
    tagesplanHeuteMap[t.rayon_id].push({ mitarbeiter_id: t.mitarbeiter_id, mitarbeiter_name: t.mitarbeiter_name, ist_teilzuteilung: 1 });
  }

  const result = rayone.map(r => {
    // Tagesplan hat Vorrang vor Monatsplan für heutige Anzeige
    let besetzung;
    if (tagesplanHeuteMap[r.id]) {
      besetzung = tagesplanHeuteMap[r.id];
    } else {
      besetzung = zuteilungMap[r.id];
      if (!besetzung || besetzung.length === 0) {
        const stamm = stammbesetzung.filter(s => s.rayon_id === r.id);
        besetzung = stamm.map(s => ({ ...s, ist_teilzuteilung: 0 }));
      }
    }
    return {
      ...r,
      aktuelle_besetzung: besetzung,
      aktueller_mitarbeiter_name: besetzung.length > 0 ? besetzung.map(b => b.mitarbeiter_name).join(', ') : null,
      hat_tagesplan_heute: !!tagesplanHeuteMap[r.id],
    };
  });

  res.json(result);
});

app.get('/api/rayone/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const monat = req.query.monat || new Date().toISOString().substring(0, 7);
  const rayon = db.prepare('SELECT * FROM rayone WHERE id = ?').get(req.params.id);
  if (!rayon) return res.status(404).json({ fehler: 'Nicht gefunden' });

  const mitarbeiter = db.prepare(`
    SELECT m.*, k.level
    FROM kompetenzen k
    JOIN mitarbeiter m ON k.mitarbeiter_id = m.id
    WHERE k.rayon_id = ? AND m.aktiv = 1
    ORDER BY k.level, m.name
  `).all(req.params.id);

  // Aktuelle Besetzung
  const aktuelleZuteilung = db.prepare(`
    SELECT mz.*, m.id as mitarbeiter_id, m.name as mitarbeiter_name
    FROM monatszuteilungen mz
    JOIN mitarbeiter m ON mz.mitarbeiter_id = m.id
    WHERE mz.rayon_id = ? AND mz.monat = ? AND m.aktiv = 1
  `).all(req.params.id, monat);

  // Fallback Stamm
  const stammBesetzung = db.prepare(`
    SELECT m.id as mitarbeiter_id, m.name as mitarbeiter_name
    FROM mitarbeiter m
    WHERE m.stamm_rayon_id = ? AND m.aktiv = 1
  `).all(req.params.id);

  const aktuelle = aktuelleZuteilung.length > 0 ? aktuelleZuteilung : stammBesetzung.map(s => ({ ...s, ist_teilzuteilung: 0 }));

  res.json({ ...rayon, mitarbeiter, aktuelle_besetzung: aktuelle, stamm_besetzung: stammBesetzung });
});

app.put('/api/rayone/:id', authMiddleware, (req, res) => {
  const { bezeichnung, gebiet, priorität } = req.body;
  const db = getDb();
  db.prepare('UPDATE rayone SET bezeichnung = ?, gebiet = ?, priorität = ? WHERE id = ?')
    .run(bezeichnung, gebiet, priorität ?? 'normal', req.params.id);
  res.json({ erfolg: true });
});

app.post('/api/rayone', authMiddleware, (req, res) => {
  const { nummer, bezeichnung, gebiet, priorität } = req.body;
  const db = getDb();
  if (!nummer || !bezeichnung) return res.status(400).json({ fehler: 'Nummer und Bezeichnung erforderlich' });
  const exists = db.prepare('SELECT id FROM rayone WHERE nummer = ?').get(nummer);
  if (exists) return res.status(409).json({ fehler: `Rayon ${nummer} existiert bereits` });
  const result = db.prepare(
    'INSERT INTO rayone (nummer, bezeichnung, gebiet, priorität) VALUES (?, ?, ?, ?)'
  ).run(Number(nummer), bezeichnung, gebiet || null, priorität || 'normal');
  res.json({ id: Number(result.lastInsertRowid), erfolg: true });
});

app.delete('/api/rayone/:id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE rayone SET aktiv = 0 WHERE id = ?').run(req.params.id);
  res.json({ erfolg: true });
});

// ─── Mitarbeiter ──────────────────────────────────────────────────────────────
app.get('/api/mitarbeiter', authMiddleware, (req, res) => {
  const db = getDb();
  const monat = req.query.monat || new Date().toISOString().substring(0, 7);
  const heute = new Date().toISOString().split('T')[0];

  const mitarbeiter = db.prepare(`
    SELECT m.*, r.nummer as stamm_rayon_nummer, r.bezeichnung as stamm_rayon_bezeichnung,
      (SELECT f.kennzeichen FROM fahrzeuge f WHERE f.mitarbeiter_id = m.id AND f.aktiv = 1 LIMIT 1) as fahrzeug_kennzeichen,
      (SELECT f.id FROM fahrzeuge f WHERE f.mitarbeiter_id = m.id AND f.aktiv = 1 LIMIT 1) as fahrzeug_id
    FROM mitarbeiter m
    LEFT JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE m.aktiv = 1
    ORDER BY m.name
  `).all();

  // Monatszuteilungen laden
  const zuteilungen = db.prepare(`
    SELECT mz.mitarbeiter_id, r.id as rayon_id, r.nummer as rayon_nummer, r.bezeichnung as rayon_bezeichnung, mz.ist_teilzuteilung
    FROM monatszuteilungen mz
    JOIN rayone r ON mz.rayon_id = r.id
    WHERE mz.monat = ?
  `).all(monat);

  const zuteilungMap = {};
  for (const z of zuteilungen) {
    if (!zuteilungMap[z.mitarbeiter_id]) zuteilungMap[z.mitarbeiter_id] = { ganzmitnahme: null, teilmitnahmen: [] };
    if (z.ist_teilzuteilung === 0) {
      zuteilungMap[z.mitarbeiter_id].ganzmitnahme = z;
    } else {
      zuteilungMap[z.mitarbeiter_id].teilmitnahmen.push(z);
    }
  }

  // Heutiger Tagesplan pro Mitarbeiter (welchen Rayon besetzen sie heute?)
  const tagesplanHeute = db.prepare(`
    SELECT t.mitarbeiter_id, t.rayon_id, r.nummer as rayon_nummer, r.bezeichnung as rayon_bezeichnung
    FROM tagespläne t
    JOIN rayone r ON t.rayon_id = r.id
    WHERE t.datum = ? AND t.mitarbeiter_id IS NOT NULL
  `).all(heute);
  const tagesplanHeuteMap = {};
  for (const t of tagesplanHeute) tagesplanHeuteMap[t.mitarbeiter_id] = t;

  const result = mitarbeiter.map(m => {
    const z = zuteilungMap[m.id];
    const ganz = z?.ganzmitnahme;
    const heute_eintrag = tagesplanHeuteMap[m.id];
    return {
      ...m,
      aktueller_rayon_id: ganz?.rayon_id || m.stamm_rayon_id,
      aktueller_rayon_nummer: ganz?.rayon_nummer || m.stamm_rayon_nummer,
      aktueller_rayon_bezeichnung: ganz?.rayon_bezeichnung || m.stamm_rayon_bezeichnung,
      hat_monatszuteilung: !!z,
      teilmitnahmen: z?.teilmitnahmen || [],
      heute_rayon_id: heute_eintrag?.rayon_id || null,
      heute_rayon_nummer: heute_eintrag?.rayon_nummer || null,
      heute_rayon_bezeichnung: heute_eintrag?.rayon_bezeichnung || null,
    };
  });

  res.json(result);
});

app.get('/api/mitarbeiter/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const monat = new Date().toISOString().substring(0, 7);
  const heute = new Date().toISOString().split('T')[0];

  const mitarbeiter = db.prepare(`
    SELECT m.*, r.nummer as stamm_rayon_nummer, r.bezeichnung as stamm_rayon_bezeichnung
    FROM mitarbeiter m
    LEFT JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!mitarbeiter) return res.status(404).json({ fehler: 'Nicht gefunden' });

  const kompetenzen = db.prepare(`
    SELECT k.*, r.nummer, r.bezeichnung
    FROM kompetenzen k
    JOIN rayone r ON k.rayon_id = r.id
    WHERE k.mitarbeiter_id = ?
    ORDER BY k.level, r.nummer
  `).all(req.params.id);

  // Aktuelle Monatszuteilungen (alle: Ganzmitnahme + Teilmitnahmen)
  const alleZuteilungen = db.prepare(`
    SELECT mz.*, r.nummer as rayon_nummer, r.bezeichnung as rayon_bezeichnung
    FROM monatszuteilungen mz
    JOIN rayone r ON mz.rayon_id = r.id
    WHERE mz.mitarbeiter_id = ? AND mz.monat = ?
    ORDER BY mz.ist_teilzuteilung, r.nummer
  `).all(req.params.id, monat);
  const ganzmitnahme = alleZuteilungen.find(z => z.ist_teilzuteilung === 0) || null;
  const teilmitnahmen = alleZuteilungen.filter(z => z.ist_teilzuteilung === 1);

  // Heutiger Tagesplan-Rayon
  const tagesplanHeute = db.prepare(`
    SELECT t.rayon_id, r.nummer as rayon_nummer, r.bezeichnung as rayon_bezeichnung
    FROM tagespläne t
    JOIN rayone r ON t.rayon_id = r.id
    WHERE t.mitarbeiter_id = ? AND t.datum = ?
    LIMIT 1
  `).get(req.params.id, heute);

  // Fairness-Statistik
  const statistik = db.prepare(`
    SELECT
      SUM(CASE WHEN datum LIKE ? THEN 1 ELSE 0 END) as monat,
      SUM(CASE WHEN datum LIKE ? THEN 1 ELSE 0 END) as jahr
    FROM vertretungseinsätze
    WHERE mitarbeiter_id = ?
  `).get(
    `${monat}%`,
    `${new Date().getFullYear()}%`,
    req.params.id
  );

  res.json({
    ...mitarbeiter,
    kompetenzen,
    statistik,
    aktuelle_zuteilung: ganzmitnahme,
    ganzmitnahme,
    teilmitnahmen,
    heute_rayon_id: tagesplanHeute?.rayon_id || null,
    heute_rayon_nummer: tagesplanHeute?.rayon_nummer || null,
    heute_rayon_bezeichnung: tagesplanHeute?.rayon_bezeichnung || null,
  });
});

app.post('/api/mitarbeiter', authMiddleware, (req, res) => {
  const { name, personalnummer, telefon, email, stamm_rayon_id, mitnahme_modus } = req.body;
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO mitarbeiter (name, personalnummer, telefon, email, stamm_rayon_id, mitnahme_modus)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, personalnummer, telefon || null, email || null, stamm_rayon_id || null, mitnahme_modus || 'normal');

  const newId = Number(result.lastInsertRowid);

  if (stamm_rayon_id) {
    db.prepare(`
      INSERT OR REPLACE INTO kompetenzen (mitarbeiter_id, rayon_id, level)
      VALUES (?, ?, 1)
    `).run(newId, stamm_rayon_id);
  }

  res.json({ id: newId, erfolg: true });
});

app.put('/api/mitarbeiter/:id', authMiddleware, (req, res) => {
  const { name, personalnummer, telefon, email, stamm_rayon_id, mitnahme_modus } = req.body;
  const db = getDb();

  const alter = db.prepare('SELECT stamm_rayon_id FROM mitarbeiter WHERE id = ?').get(req.params.id);

  db.prepare(`
    UPDATE mitarbeiter SET name = ?, personalnummer = ?, telefon = ?, email = ?, stamm_rayon_id = ?, mitnahme_modus = ?
    WHERE id = ?
  `).run(name, personalnummer, telefon || null, email || null, stamm_rayon_id || null, mitnahme_modus || 'normal', req.params.id);

  const alteRayonId = alter ? alter.stamm_rayon_id : null;
  const neueRayonId = stamm_rayon_id ? parseInt(stamm_rayon_id) : null;

  if (alteRayonId !== neueRayonId) {
    // Kompetenz Level 1 aktualisieren
    if (alteRayonId) {
      db.prepare('DELETE FROM kompetenzen WHERE mitarbeiter_id = ? AND rayon_id = ? AND level = 1')
        .run(req.params.id, alteRayonId);
    }
    // Monatszuteilung für aktuellen Monat aktualisieren
    const currentMonat = new Date().toISOString().substring(0, 7);
    db.prepare('DELETE FROM monatszuteilungen WHERE mitarbeiter_id = ? AND monat = ?')
      .run(req.params.id, currentMonat);
    if (neueRayonId) {
      db.prepare('INSERT OR REPLACE INTO monatszuteilungen (monat, mitarbeiter_id, rayon_id, ist_teilzuteilung) VALUES (?, ?, ?, 0)')
        .run(currentMonat, req.params.id, neueRayonId);
    }
  }

  if (neueRayonId) {
    db.prepare(`
      INSERT OR REPLACE INTO kompetenzen (mitarbeiter_id, rayon_id, level)
      VALUES (?, ?, 1)
    `).run(req.params.id, neueRayonId);
  }

  res.json({ erfolg: true });
});

app.delete('/api/mitarbeiter/:id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE mitarbeiter SET aktiv = 0 WHERE id = ?').run(req.params.id);
  res.json({ erfolg: true });
});

// ─── Kompetenzen ──────────────────────────────────────────────────────────────
app.post('/api/kompetenzen', authMiddleware, (req, res) => {
  const { mitarbeiter_id, rayon_id, level } = req.body;
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO kompetenzen (mitarbeiter_id, rayon_id, level)
    VALUES (?, ?, ?)
  `).run(mitarbeiter_id, rayon_id, level);
  res.json({ erfolg: true });
});

app.delete('/api/kompetenzen/:mitarbeiter_id/:rayon_id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM kompetenzen WHERE mitarbeiter_id = ? AND rayon_id = ? AND level != 1')
    .run(req.params.mitarbeiter_id, req.params.rayon_id);
  res.json({ erfolg: true });
});

// ─── Monatszuteilungen ────────────────────────────────────────────────────────
app.get('/api/monatszuteilungen', authMiddleware, (req, res) => {
  const db = getDb();
  const monat = req.query.monat || new Date().toISOString().substring(0, 7);

  const zuteilungen = db.prepare(`
    SELECT mz.*, m.name as mitarbeiter_name, r.nummer as rayon_nummer, r.bezeichnung as rayon_bezeichnung
    FROM monatszuteilungen mz
    JOIN mitarbeiter m ON mz.mitarbeiter_id = m.id
    JOIN rayone r ON mz.rayon_id = r.id
    WHERE mz.monat = ? AND m.aktiv = 1
    ORDER BY r.nummer
  `).all(monat);

  res.json(zuteilungen);
});

app.post('/api/monatszuteilungen', authMiddleware, (req, res) => {
  const { monat, eintraege } = req.body; // eintraege: [{mitarbeiter_id, rayon_id, ist_teilzuteilung}]
  const db = getDb();

  // R2/R3: Validierung – max. 1 Ganzmitnahme, max. 2 Teilmitnahmen pro Mitarbeiter
  const perMitarbeiter = {};
  for (const e of eintraege) {
    if (!e.mitarbeiter_id) continue;
    const id = e.mitarbeiter_id;
    if (!perMitarbeiter[id]) perMitarbeiter[id] = { ganz: 0, teil: 0 };
    if (e.ist_teilzuteilung) perMitarbeiter[id].teil++;
    else perMitarbeiter[id].ganz++;
  }
  for (const [id, counts] of Object.entries(perMitarbeiter)) {
    if (counts.ganz > 1) {
      const ma = db.prepare('SELECT name FROM mitarbeiter WHERE id = ?').get(parseInt(id));
      return res.status(400).json({ fehler: `${ma?.name || 'Mitarbeiter ' + id}: Maximal 1 Ganzmitnahme erlaubt (${counts.ganz} versucht)` });
    }
    if (counts.teil > 2) {
      const ma = db.prepare('SELECT name FROM mitarbeiter WHERE id = ?').get(parseInt(id));
      return res.status(400).json({ fehler: `${ma?.name || 'Mitarbeiter ' + id}: Maximal 2 Teilmitnahmen erlaubt (${counts.teil} versucht)` });
    }
  }

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO monatszuteilungen (monat, mitarbeiter_id, rayon_id, ist_teilzuteilung)
    VALUES (?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    // Alle bestehenden Zuteilungen für diesen Monat ersetzen (vollständige Neuzuteilung)
    db.prepare('DELETE FROM monatszuteilungen WHERE monat = ?').run(monat);
    for (const e of eintraege) {
      if (!e.mitarbeiter_id) continue;
      upsert.run(monat, e.mitarbeiter_id, e.rayon_id, e.ist_teilzuteilung ? 1 : 0);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ fehler: err.message });
  }
  res.json({ erfolg: true });
});

app.delete('/api/monatszuteilungen/:monat/:mitarbeiterId', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM monatszuteilungen WHERE monat = ? AND mitarbeiter_id = ?')
    .run(req.params.monat, req.params.mitarbeiterId);
  res.json({ erfolg: true });
});

// Einzelne Zuteilung (spezifischer Rayon) entfernen
app.delete('/api/monatszuteilungen/:monat/:mitarbeiterId/:rayonId', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM monatszuteilungen WHERE monat = ? AND mitarbeiter_id = ? AND rayon_id = ?')
    .run(req.params.monat, req.params.mitarbeiterId, req.params.rayonId);
  res.json({ erfolg: true });
});

// Einzelrayon-Zuteilung setzen (ohne andere Rayone zu löschen – Fix für Synchronisation)
app.put('/api/monatszuteilungen/:monat/rayon/:rayonId', authMiddleware, (req, res) => {
  const { mitarbeiter_id, ist_teilzuteilung, force } = req.body;
  const { monat, rayonId } = req.params;
  const db = getDb();

  if (!mitarbeiter_id) return res.status(400).json({ fehler: 'mitarbeiter_id erforderlich' });

  const teilzuteilung = ist_teilzuteilung ? 1 : 0;

  // R2/R3 Validierung (überspringen bei force=true für Ganzmitnahme)
  const bestehend = db.prepare(`
    SELECT ist_teilzuteilung, rayon_id FROM monatszuteilungen
    WHERE monat = ? AND mitarbeiter_id = ? AND rayon_id != ?
  `).all(monat, mitarbeiter_id, rayonId);

  const ganzCount = bestehend.filter(z => z.ist_teilzuteilung === 0).length;
  const teilCount = bestehend.filter(z => z.ist_teilzuteilung === 1).length;

  if (teilzuteilung === 0 && ganzCount >= 1 && !force) {
    const ma = db.prepare('SELECT name FROM mitarbeiter WHERE id = ?').get(mitarbeiter_id);
    return res.status(400).json({ fehler: `${ma?.name}: Bereits eine Ganzmitnahme vorhanden`, kannErzwingen: true });
  }
  if (teilzuteilung === 1 && teilCount >= 2) {
    const ma = db.prepare('SELECT name FROM mitarbeiter WHERE id = ?').get(mitarbeiter_id);
    return res.status(400).json({ fehler: `${ma?.name}: Maximal 2 Teilmitnahmen erlaubt` });
  }

  db.exec('BEGIN');
  try {
    if (teilzuteilung === 0) {
      // Bestehende Ganzmitnahme dieses MA (alle Rayone) entfernen wenn force
      if (force) {
        db.prepare('DELETE FROM monatszuteilungen WHERE monat = ? AND mitarbeiter_id = ? AND ist_teilzuteilung = 0')
          .run(monat, mitarbeiter_id);
      }
      // Bestehende Ganzmitnahme für diesen Rayon von anderem MA entfernen
      db.prepare('DELETE FROM monatszuteilungen WHERE monat = ? AND rayon_id = ? AND ist_teilzuteilung = 0')
        .run(monat, rayonId);
    } else {
      db.prepare('DELETE FROM monatszuteilungen WHERE monat = ? AND mitarbeiter_id = ? AND rayon_id = ? AND ist_teilzuteilung = 1')
        .run(monat, mitarbeiter_id, rayonId);
    }
    db.prepare('INSERT INTO monatszuteilungen (monat, mitarbeiter_id, rayon_id, ist_teilzuteilung) VALUES (?, ?, ?, ?)')
      .run(monat, mitarbeiter_id, rayonId, teilzuteilung);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ fehler: err.message });
  }
  res.json({ erfolg: true });
});

// ─── Abwesenheiten ────────────────────────────────────────────────────────────
app.get('/api/abwesenheiten', authMiddleware, (req, res) => {
  const { datum, von, bis } = req.query;
  const db = getDb();

  let query = `
    SELECT a.*, m.name as mitarbeiter_name
    FROM abwesenheiten a
    JOIN mitarbeiter m ON a.mitarbeiter_id = m.id
    WHERE m.aktiv = 1
  `;
  const params = [];

  if (datum) {
    query += ' AND a.datum = ?';
    params.push(datum);
  } else if (von && bis) {
    query += ' AND a.datum BETWEEN ? AND ?';
    params.push(von, bis);
  }

  query += ' ORDER BY a.datum, m.name';
  const abwesenheiten = db.prepare(query).all(...params);
  res.json(abwesenheiten);
});

app.post('/api/abwesenheiten', authMiddleware, (req, res) => {
  const { mitarbeiter_id, datum, status, bemerkung } = req.body;
  const db = getDb();

  if (Array.isArray(datum)) {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO abwesenheiten (mitarbeiter_id, datum, status, bemerkung)
      VALUES (?, ?, ?, ?)
    `);
    db.exec('BEGIN');
    try {
      for (const d of datum) {
        insert.run(mitarbeiter_id, d, status, bemerkung || null);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(500).json({ fehler: err.message });
    }
  } else {
    db.prepare(`
      INSERT OR REPLACE INTO abwesenheiten (mitarbeiter_id, datum, status, bemerkung)
      VALUES (?, ?, ?, ?)
    `).run(mitarbeiter_id, datum, status, bemerkung || null);
  }

  res.json({ erfolg: true });
});

app.delete('/api/abwesenheiten/:mitarbeiter_id/:datum', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM abwesenheiten WHERE mitarbeiter_id = ? AND datum = ?')
    .run(req.params.mitarbeiter_id, req.params.datum);
  res.json({ erfolg: true });
});

// ─── Fahrzeuge ────────────────────────────────────────────────────────────────
app.get('/api/fahrzeuge', authMiddleware, (req, res) => {
  const db = getDb();
  const { status, marke } = req.query;

  let query = `
    SELECT f.*, m.name as mitarbeiter_name
    FROM fahrzeuge f
    LEFT JOIN mitarbeiter m ON f.mitarbeiter_id = m.id
    WHERE f.aktiv = 1
  `;
  const params = [];

  if (status) { query += ' AND f.status = ?'; params.push(status); }
  if (marke) { query += ' AND f.marke = ?'; params.push(marke); }

  query += ' ORDER BY f.marke, f.kennzeichen';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/fahrzeuge/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const fahrzeug = db.prepare(`
    SELECT f.*, m.name as mitarbeiter_name
    FROM fahrzeuge f
    LEFT JOIN mitarbeiter m ON f.mitarbeiter_id = m.id
    WHERE f.id = ? AND f.aktiv = 1
  `).get(req.params.id);
  if (!fahrzeug) return res.status(404).json({ fehler: 'Fahrzeug nicht gefunden' });
  res.json(fahrzeug);
});

app.post('/api/fahrzeuge', authMiddleware, (req, res) => {
  const { kennzeichen, marke, modell, antrieb, typ, status, mitarbeiter_id, bemerkung, erstzulassung, letzte_vorführung } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO fahrzeuge (kennzeichen, marke, modell, antrieb, typ, status, mitarbeiter_id, bemerkung, erstzulassung, letzte_vorführung)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(kennzeichen, marke, modell || null, antrieb, typ || 'Zustellfahrzeug', status || 'verfügbar', mitarbeiter_id || null, bemerkung || null, erstzulassung || null, letzte_vorführung || null);
  res.json({ id: Number(result.lastInsertRowid), erfolg: true });
});

app.put('/api/fahrzeuge/:id', authMiddleware, (req, res) => {
  const { kennzeichen, marke, modell, antrieb, typ, status, mitarbeiter_id, bemerkung, erstzulassung, letzte_vorführung } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE fahrzeuge SET kennzeichen = ?, marke = ?, modell = ?, antrieb = ?, typ = ?, status = ?, mitarbeiter_id = ?, bemerkung = ?, erstzulassung = ?, letzte_vorführung = ?
    WHERE id = ?
  `).run(kennzeichen, marke, modell || null, antrieb, typ || 'Zustellfahrzeug', status, mitarbeiter_id || null, bemerkung || null, erstzulassung || null, letzte_vorführung || null, req.params.id);
  res.json({ erfolg: true });
});

app.delete('/api/fahrzeuge/:id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE fahrzeuge SET aktiv = 0 WHERE id = ?').run(req.params.id);
  res.json({ erfolg: true });
});

// ─── Tagesplan ────────────────────────────────────────────────────────────────
app.get('/api/tagesplan/:datum', authMiddleware, (req, res) => {
  const db = getDb();
  const { datum } = req.params;
  const monat = datum.substring(0, 7);

  const rayone = db.prepare('SELECT * FROM rayone WHERE aktiv = 1 ORDER BY nummer').all();

  // Abwesenheiten für den Tag
  const abwesenheiten = db.prepare(`
    SELECT a.*, m.name as mitarbeiter_name
    FROM abwesenheiten a
    JOIN mitarbeiter m ON a.mitarbeiter_id = m.id
    WHERE a.datum = ? AND m.aktiv = 1
  `).all(datum);
  const abwesenheitsMap = {};
  for (const a of abwesenheiten) abwesenheitsMap[a.mitarbeiter_id] = a;

  // Bestehende Tagespläne
  const tagespläne = db.prepare(`
    SELECT t.*, m.name as mitarbeiter_name, m2.name as vertritt_name, r.nummer as rayon_nummer
    FROM tagespläne t
    LEFT JOIN mitarbeiter m ON t.mitarbeiter_id = m.id
    LEFT JOIN mitarbeiter m2 ON t.vertritt_mitarbeiter_id = m2.id
    JOIN rayone r ON t.rayon_id = r.id
    WHERE t.datum = ?
  `).all(datum);
  const tagesplanMap = {};
  for (const t of tagespläne) tagesplanMap[t.rayon_id] = t;

  // Teilmitnahmen (mehrere pro Rayon)
  const teilmitnahmenRows = db.prepare(`
    SELECT tt.rayon_id, tt.mitarbeiter_id, m.name as mitarbeiter_name
    FROM tagesplan_teilmitnahmen tt
    JOIN mitarbeiter m ON tt.mitarbeiter_id = m.id
    WHERE tt.datum = ?
  `).all(datum);
  const teilmitnahmenMap = {};
  for (const row of teilmitnahmenRows) {
    if (!teilmitnahmenMap[row.rayon_id]) teilmitnahmenMap[row.rayon_id] = [];
    teilmitnahmenMap[row.rayon_id].push({ id: row.mitarbeiter_id, name: row.mitarbeiter_name });
  }

  // Monatszuteilungen für diesen Monat
  const zuteilungen = db.prepare(`
    SELECT mz.rayon_id, mz.mitarbeiter_id, m.name as mitarbeiter_name, mz.ist_teilzuteilung
    FROM monatszuteilungen mz
    JOIN mitarbeiter m ON mz.mitarbeiter_id = m.id
    WHERE mz.monat = ? AND m.aktiv = 1
  `).all(monat);
  const zuteilungMap = {};
  for (const z of zuteilungen) zuteilungMap[z.rayon_id] = z;

  // Stamm-Fallback
  const stammbesetzung = db.prepare(`
    SELECT m.*, r.id as rayon_id
    FROM mitarbeiter m
    JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE m.aktiv = 1
  `).all();
  const stammMap = {};
  for (const s of stammbesetzung) stammMap[s.rayon_id] = s;

  const plan = rayone.map(rayon => {
    // Primären Mitarbeiter ermitteln (Monatszuteilung oder Stamm)
    const zuteilung = zuteilungMap[rayon.id];
    let stammMitarbeiterId = zuteilung?.mitarbeiter_id || stammMap[rayon.id]?.id;
    let stammMitarbeiter = zuteilung
      ? db.prepare('SELECT * FROM mitarbeiter WHERE id = ?').get(stammMitarbeiterId)
      : stammMap[rayon.id];

    const tagesplanEintrag = tagesplanMap[rayon.id];

    let mitarbeiter = stammMitarbeiter;
    let ist_mitnahme = false;
    let ist_teilbesetzung = false;
    let vertritt_name = null;
    let stamm_status = 'stamm';

    if (stammMitarbeiter && abwesenheitsMap[stammMitarbeiter.id]) {
      stamm_status = abwesenheitsMap[stammMitarbeiter.id].status;
    }

    if (tagesplanEintrag) {
      ist_mitnahme = tagesplanEintrag.ist_vertretung === 1;
      ist_teilbesetzung = tagesplanEintrag.ist_teilbesetzung === 1;
      if (tagesplanEintrag.mitarbeiter_id) {
        mitarbeiter = db.prepare('SELECT * FROM mitarbeiter WHERE id = ?').get(tagesplanEintrag.mitarbeiter_id);
      } else {
        mitarbeiter = null;
      }
      vertritt_name = tagesplanEintrag.vertritt_name;
    } else if (stammMitarbeiter && abwesenheitsMap[stammMitarbeiter.id]) {
      // Stamm ist abwesend, kein Tagesplan → unbesetzt
      mitarbeiter = null;
    }

    return {
      rayon,
      stamm_mitarbeiter: stammMitarbeiter,
      aktueller_mitarbeiter: mitarbeiter,
      ist_mitnahme,
      ist_teilbesetzung,
      vertritt_name,
      stamm_status,
      bestätigt: tagesplanEintrag?.bestätigt === 1,
      hat_tagesplan_eintrag: !!tagesplanEintrag,
      tagesplan_mitarbeiter_id: tagesplanEintrag?.mitarbeiter_id || null,
      teilmitnahmen: teilmitnahmenMap[rayon.id] || [],
    };
  });

  res.json({ datum, plan, abwesenheiten });
});

app.post('/api/tagesplan/:datum/speichern', authMiddleware, (req, res) => {
  const db = getDb();
  const { datum } = req.params;
  const eintraege = req.body.eintraege || req.body.einträge || [];

  if (!Array.isArray(eintraege)) return res.status(400).json({ fehler: 'eintraege muss ein Array sein' });

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO tagespläne
    (datum, rayon_id, mitarbeiter_id, ist_vertretung, ist_teilbesetzung, vertritt_mitarbeiter_id, bestätigt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteEinsatz = db.prepare('DELETE FROM vertretungseinsätze WHERE datum = ? AND rayon_id = ?');
  const insertEinsatz = db.prepare('INSERT INTO vertretungseinsätze (mitarbeiter_id, datum, rayon_id) VALUES (?, ?, ?)');
  const deleteTeilmitnahmen = db.prepare('DELETE FROM tagesplan_teilmitnahmen WHERE datum = ? AND rayon_id = ?');
  const insertTeilmitnahme = db.prepare('INSERT OR IGNORE INTO tagesplan_teilmitnahmen (datum, rayon_id, mitarbeiter_id) VALUES (?, ?, ?)');

  db.exec('BEGIN');
  try {
    for (const eintrag of eintraege) {
      upsert.run(
        datum,
        eintrag.rayon_id,
        eintrag.mitarbeiter_id || null,
        eintrag.ist_vertretung ? 1 : 0,
        eintrag.ist_teilbesetzung ? 1 : 0,
        eintrag.vertritt_mitarbeiter_id || null,
        1
      );

      if (eintrag.ist_vertretung && eintrag.mitarbeiter_id) {
        deleteEinsatz.run(datum, eintrag.rayon_id);
        insertEinsatz.run(eintrag.mitarbeiter_id, datum, eintrag.rayon_id);
      }

      // Teilmitnahmen (mehrere pro Rayon) verarbeiten
      if (Array.isArray(eintrag.teilmitnahmen)) {
        deleteTeilmitnahmen.run(datum, eintrag.rayon_id);
        for (const mid of eintrag.teilmitnahmen) {
          if (mid) insertTeilmitnahme.run(datum, eintrag.rayon_id, mid);
        }
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ fehler: err.message });
  }
  res.json({ erfolg: true });
});

// ─── Wochenbesetzung (tageweise Überschreibungen) ─────────────────────────────
app.get('/api/tagesplan/wochenbesetzung', authMiddleware, (req, res) => {
  const { rayon_id, monat } = req.query;
  const db = getDb();
  if (!rayon_id || !monat) return res.status(400).json({ fehler: 'rayon_id und monat erforderlich' });

  const eintraege = db.prepare(`
    SELECT t.datum, t.mitarbeiter_id, m.name as mitarbeiter_name, t.ist_teilbesetzung
    FROM tagespläne t
    LEFT JOIN mitarbeiter m ON t.mitarbeiter_id = m.id
    WHERE t.rayon_id = ? AND t.datum LIKE ?
    ORDER BY t.datum
  `).all(parseInt(rayon_id), `${monat}%`);

  res.json(eintraege);
});

app.post('/api/tagesplan/wochenbesetzung', authMiddleware, (req, res) => {
  const { rayon_id, wocheneintraege } = req.body;
  const db = getDb();
  if (!rayon_id || !Array.isArray(wocheneintraege)) return res.status(400).json({ fehler: 'Ungültige Daten' });

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO tagespläne (datum, rayon_id, mitarbeiter_id, ist_vertretung, ist_teilbesetzung, bestätigt)
    VALUES (?, ?, ?, 0, 0, 1)
  `);
  const del = db.prepare('DELETE FROM tagespläne WHERE datum = ? AND rayon_id = ?');

  db.exec('BEGIN');
  try {
    for (const woche of wocheneintraege) {
      const von = new Date(woche.von + 'T00:00:00');
      const bis = new Date(woche.bis + 'T00:00:00');
      for (let d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
        const datum = d.toISOString().split('T')[0];
        if (woche.mitarbeiter_id) {
          upsert.run(datum, rayon_id, woche.mitarbeiter_id);
        } else {
          del.run(datum, rayon_id);
        }
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ fehler: err.message });
  }
  res.json({ erfolg: true });
});

// ─── Mitnahmeplanung ──────────────────────────────────────────────────────────
app.post('/api/mitnahme/berechnen', authMiddleware, (req, res) => {
  const { datum, ausfälle } = req.body;
  const db = getDb();
  const monat = datum.substring(0, 7);

  // Aktuellen Rayon für jeden Ausfall ermitteln
  const angereichertAusfälle = ausfälle.map(a => {
    const rayon = getAktuellerRayon(db, a.mitarbeiter_id, monat);
    const ma = db.prepare('SELECT * FROM mitarbeiter WHERE id = ?').get(a.mitarbeiter_id);
    return {
      mitarbeiter_id: a.mitarbeiter_id,
      mitarbeiter_name: ma?.name,
      rayon_id: rayon?.rayon_id,
      rayon_nummer: rayon?.rayon_nummer,
      mitnahme_modus: ma?.mitnahme_modus || 'normal',
    };
  }).filter(a => a.rayon_id);

  const plan = berechneMitnahmeplan(angereichertAusfälle, datum, monat, db);

  const angereichertPlan = plan.map(p => {
    const rayon = db.prepare('SELECT * FROM rayone WHERE id = ?').get(p.rayon_id);
    const ausgefallener = p.ausgefallener_mitarbeiter_id
      ? db.prepare('SELECT name FROM mitarbeiter WHERE id = ?').get(p.ausgefallener_mitarbeiter_id)
      : null;
    return {
      ...p,
      rayon_nummer: rayon?.nummer,
      rayon_bezeichnung: rayon?.bezeichnung,
      ausgefallener_name: ausgefallener?.name,
    };
  });

  res.json({ datum, plan: angereichertPlan });
});

// Legacy-Endpunkt (Rückwärtskompatibilität)
app.post('/api/vertretung/berechnen', authMiddleware, (req, res) => {
  req.url = '/api/mitnahme/berechnen';
  res.redirect(307, '/api/mitnahme/berechnen');
});

// ─── Dienstplan-Import ────────────────────────────────────────────────────────
app.post('/api/dienstplan/import', authMiddleware, (req, res) => {
  const { monat, eintraege, ersetzen } = req.body;
  const db = getDb();

  if (!monat || !Array.isArray(eintraege)) {
    return res.status(400).json({ fehler: 'monat und eintraege erforderlich' });
  }

  const errors = [];
  let importiert = 0;

  db.exec('BEGIN');
  try {
    if (ersetzen) {
      db.prepare('DELETE FROM monatszuteilungen WHERE monat = ?').run(monat);
    }
    for (const e of eintraege) {
      const ma = db.prepare('SELECT id, name FROM mitarbeiter WHERE personalnummer = ? AND aktiv = 1').get(String(e.pnr));
      const rayon = db.prepare('SELECT id FROM rayone WHERE nummer = ? AND aktiv = 1').get(Number(e.rayon_nummer));
      if (!ma) { errors.push(`PNR ${e.pnr} nicht gefunden`); continue; }
      if (!rayon) { errors.push(`Rayon ${e.rayon_nummer} nicht gefunden`); continue; }
      db.prepare('INSERT OR REPLACE INTO monatszuteilungen (monat, mitarbeiter_id, rayon_id, ist_teilzuteilung) VALUES (?, ?, ?, 0)')
        .run(monat, ma.id, rayon.id);
      importiert++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ fehler: err.message });
  }

  res.json({ erfolg: true, importiert, fehler: errors });
});

// ─── Fairness-Statistik ───────────────────────────────────────────────────────
app.get('/api/statistik', authMiddleware, (req, res) => {
  const db = getDb();
  const { monat, jahr } = req.query;

  const aktuellesJahr = jahr || new Date().getFullYear().toString();
  const aktuellerMonat = monat || new Date().toISOString().substring(0, 7);

  const statistik = db.prepare(`
    SELECT
      m.id,
      m.name,
      m.personalnummer,
      SUM(CASE WHEN v.datum LIKE ? THEN 1 ELSE 0 END) as einsätze_monat,
      SUM(CASE WHEN v.datum LIKE ? THEN 1 ELSE 0 END) as einsätze_jahr
    FROM mitarbeiter m
    LEFT JOIN vertretungseinsätze v ON m.id = v.mitarbeiter_id
    WHERE m.aktiv = 1
    GROUP BY m.id
    ORDER BY einsätze_monat DESC, einsätze_jahr DESC, m.name
  `).all(`${aktuellerMonat}%`, `${aktuellesJahr}%`);

  res.json(statistik);
});

// ─── Dashboard-Daten ──────────────────────────────────────────────────────────
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const db = getDb();
  const heute = new Date().toISOString().split('T')[0];

  const anzahlMitarbeiter = db.prepare('SELECT COUNT(*) as count FROM mitarbeiter WHERE aktiv = 1').get();
  const anzahlRayone = db.prepare('SELECT COUNT(*) as count FROM rayone WHERE aktiv = 1').get();

  const abwesenheitenHeute = db.prepare(`
    SELECT a.status, COUNT(*) as count
    FROM abwesenheiten a
    JOIN mitarbeiter m ON a.mitarbeiter_id = m.id
    WHERE a.datum = ? AND m.aktiv = 1
    GROUP BY a.status
  `).all(heute);

  const abwesenheitenDetails = db.prepare(`
    SELECT a.*, m.name as mitarbeiter_name, r.nummer as rayon_nummer
    FROM abwesenheiten a
    JOIN mitarbeiter m ON a.mitarbeiter_id = m.id
    LEFT JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE a.datum = ? AND a.status != 'anwesend' AND m.aktiv = 1
    ORDER BY a.status, m.name
  `).all(heute);

  const fahrzeugStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM fahrzeuge WHERE aktiv = 1 GROUP BY status
  `).all();

  const anzahlFahrzeuge = db.prepare('SELECT COUNT(*) as count FROM fahrzeuge WHERE aktiv = 1').get();

  res.json({
    heute,
    anzahl_mitarbeiter: anzahlMitarbeiter.count,
    anzahl_rayone: anzahlRayone.count,
    abwesenheiten_heute: abwesenheitenHeute,
    abwesenheiten_details: abwesenheitenDetails,
    anzahl_fahrzeuge: anzahlFahrzeuge.count,
    fahrzeug_status: fahrzeugStatus,
  });
});

// ─── Frontend-Serving (für Electron / Standalone) ────────────────────────────
const frontendDist = process.env.FRONTEND_DIST;
if (frontendDist && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Server starten ───────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Rayon-App Backend läuft auf Port ${PORT}`);
  console.log(`Login: admin / admin123`);
  getDb();
});

module.exports = { server };
