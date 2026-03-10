/**
 * Mitnahmeplaner - Algorithmus für die optimale Mitnahme-/Teilmitnahmeberechnung
 *
 * Konzepte:
 * - Mitnahme (Vollbesetzung): Mitarbeiter übernimmt kompletten fremden Rayon → eigener Rayon unbesetzt
 * - Teilmitnahme: Mitarbeiter nimmt kleinen Teil zusätzlich zu eigenem Rayon → eigener Rayon bleibt besetzt
 *
 * Mitnahmemodus pro Mitarbeiter:
 * - 'normal': kann Vollmitnahme und Teilmitnahme
 * - 'teilweise': nur Teilmitnahme möglich
 * - 'keine': keine Mitnahme möglich
 *
 * Rayon-Priorität: Rayone mit höherer Priorität (1=hoch, 10=niedrig) werden bevorzugt besetzt.
 */

function berechneMitnahmeplan(ausfälle, datum, monat, db) {
  // Alle Mitarbeiter laden
  const alleMitarbeiter = db.prepare(`
    SELECT m.*, r.id as stamm_rayon_id, r.nummer as stamm_rayon_nummer
    FROM mitarbeiter m
    LEFT JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE m.aktiv = 1
  `).all();

  // Abwesenheiten für den Tag
  const abwesenheitenHeute = db.prepare(`
    SELECT mitarbeiter_id, status FROM abwesenheiten WHERE datum = ?
  `).all(datum);
  const abwesenheitsMap = {};
  for (const a of abwesenheitenHeute) abwesenheitsMap[a.mitarbeiter_id] = a.status;

  // Monatszuteilungen laden
  const monatszuteilungen = db.prepare(`
    SELECT mz.mitarbeiter_id, mz.rayon_id, r.nummer as rayon_nummer
    FROM monatszuteilungen mz
    JOIN rayone r ON mz.rayon_id = r.id
    WHERE mz.monat = ?
  `).all(monat);
  const monatszuteilungMap = {};
  for (const z of monatszuteilungen) monatszuteilungMap[z.mitarbeiter_id] = z;

  const ausfallIds = new Set(ausfälle.map(a => a.mitarbeiter_id));

  // Verfügbare Mitarbeiter (nicht abwesend, nicht ausgefallen)
  const verfügbareMitarbeiter = alleMitarbeiter.filter(m => {
    if (ausfallIds.has(m.id)) return false;
    const status = abwesenheitsMap[m.id];
    if (status && status !== 'anwesend') return false;
    return true;
  });

  // Kompetenzen laden
  const kompetenzen = db.prepare('SELECT k.*, r.nummer as rayon_nummer FROM kompetenzen k JOIN rayone r ON k.rayon_id = r.id').all();
  const kompetenzMap = {};
  for (const k of kompetenzen) {
    if (!kompetenzMap[k.mitarbeiter_id]) kompetenzMap[k.mitarbeiter_id] = {};
    kompetenzMap[k.mitarbeiter_id][k.rayon_id] = k.level;
  }

  // Rayon-Prioritäten laden
  const rayonPrio = db.prepare('SELECT id, priorität FROM rayone WHERE aktiv = 1').all();
  const rayonPrioMap = {};
  for (const r of rayonPrio) rayonPrioMap[r.id] = r.priorität || 5;

  // Fairness-Daten
  const einsätzeMonat = db.prepare(`
    SELECT mitarbeiter_id, COUNT(*) as anzahl FROM vertretungseinsätze WHERE datum LIKE ? GROUP BY mitarbeiter_id
  `).all(`${monat}%`);
  const einsatzMap = {};
  for (const e of einsätzeMonat) einsatzMap[e.mitarbeiter_id] = e.anzahl;

  // Kandidatenpool aufbauen
  const kandidatenPool = verfügbareMitarbeiter.map(m => {
    // Aktuellen Rayon ermitteln (Monatszuteilung oder Stamm)
    const mzRayon = monatszuteilungMap[m.id];
    const aktuellerRayonId = mzRayon?.rayon_id || m.stamm_rayon_id;
    return {
      ...m,
      aktuellerRayon: aktuellerRayonId,
      einsätzeMonat: einsatzMap[m.id] || 0,
      kompetenzen: kompetenzMap[m.id] || {},
      mitnahme_modus: m.mitnahme_modus || 'normal',
    };
  }).filter(m => m.mitnahme_modus !== 'keine'); // Mitarbeiter ohne Mitnahme ausschließen

  const ergebnis = [];
  const vollzugeteilt = new Set(); // für Vollmitnahme verplante Mitarbeiter

  // Ausfälle nach Rayon-Priorität sortieren (höhere Priorität = kleinere Zahl = zuerst bearbeiten)
  const sortierteAusfälle = [...ausfälle].sort((a, b) => {
    const prioA = rayonPrioMap[a.rayon_id] || 5;
    const prioB = rayonPrioMap[b.rayon_id] || 5;
    return prioA - prioB;
  });

  for (const ausfall of sortierteAusfälle) {
    const betroffenerRayon = ausfall.rayon_id;
    const kandidatenFürRayon = [];

    for (const kandidat of kandidatenPool) {
      if (vollzugeteilt.has(kandidat.id)) continue;
      if (kandidat.aktuellerRayon === betroffenerRayon) continue; // eigener Rayon

      const level = kandidat.kompetenzen[betroffenerRayon];
      if (!level || level === 1) continue; // Level 1 = Stamm, kein Fremder

      kandidatenFürRayon.push({ kandidat, level });
    }

    // Sortieren: Level 2 vor 3, dann nach Fairness
    kandidatenFürRayon.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.kandidat.einsätzeMonat - b.kandidat.einsätzeMonat;
    });

    if (kandidatenFürRayon.length === 0) {
      // Kein Kandidat verfügbar
      ergebnis.push({
        rayon_id: betroffenerRayon,
        ausgefallener_mitarbeiter_id: ausfall.mitarbeiter_id,
        vertreter_id: null,
        vertreter_name: null,
        kompetenz_level: null,
        art: null,
        fehler: 'Kein geeigneter Mitarbeiter verfügbar',
      });
      continue;
    }

    // Besten Kandidaten wählen
    const { kandidat, level } = kandidatenFürRayon[0];

    // Art der Mitnahme bestimmen
    let art = 'vollmitnahme'; // Standard: Vollmitnahme
    if (kandidat.mitnahme_modus === 'teilweise') {
      art = 'teilmitnahme';
    }

    const eintrag = {
      rayon_id: betroffenerRayon,
      ausgefallener_mitarbeiter_id: ausfall.mitarbeiter_id,
      vertreter_id: kandidat.id,
      vertreter_name: kandidat.name,
      vertreter_eigener_rayon_id: kandidat.aktuellerRayon,
      kompetenz_level: level,
      art, // 'vollmitnahme' oder 'teilmitnahme'
      ist_teilbesetzung: art === 'teilmitnahme' ? 1 : 0,
    };

    if (art === 'vollmitnahme') {
      // Bei Vollmitnahme: eigener Rayon des Kandidaten wird unbesetzt
      vollzugeteilt.add(kandidat.id);
      eintrag.eigener_rayon_unbesetzt = true;
    }

    ergebnis.push(eintrag);
  }

  return ergebnis;
}

module.exports = { berechneMitnahmeplan };
