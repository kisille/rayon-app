/**
 * Vertretungsplaner - Kern-Algorithmus für die optimale Vertretungsberechnung
 *
 * Prioritäten:
 * 1. Mitarbeiter mit Kompetenz-Level 2 (sehr gut) für den Rayon
 * 2. Mitarbeiter mit Kompetenz-Level 3 (geht so) für den Rayon
 * 3. Kettenvertretung: Person A übernimmt fremden Rayon, Person B übernimmt Rayon von A
 *
 * Fairness: Bei Gleichstand gewinnt der Mitarbeiter mit wenigsten Vertretungseinsätzen
 */

function berechneVertretungsplan(ausfälle, datum, db) {
  // Alle Mitarbeiter und ihre Daten laden
  const alleMitarbeiter = db.prepare(`
    SELECT m.*, r.id as stamm_rayon_id, r.nummer as stamm_rayon_nummer
    FROM mitarbeiter m
    LEFT JOIN rayone r ON m.stamm_rayon_id = r.id
    WHERE m.aktiv = 1
  `).all();

  // Verfügbare Mitarbeiter für den Tag ermitteln
  const abwesenheitenHeute = db.prepare(`
    SELECT mitarbeiter_id, status FROM abwesenheiten WHERE datum = ?
  `).all(datum);

  const abwesenheitsMap = {};
  for (const a of abwesenheitenHeute) {
    abwesenheitsMap[a.mitarbeiter_id] = a.status;
  }

  const ausfallIds = new Set(ausfälle.map(a => a.mitarbeiter_id));

  // Mitarbeiter die als ausgefallen markiert sind oder Abwesenheit haben
  const verfügbareMitarbeiter = alleMitarbeiter.filter(m => {
    if (ausfallIds.has(m.id)) return false;
    const status = abwesenheitsMap[m.id];
    if (status && status !== 'anwesend') return false;
    return true;
  });

  // Kompetenzen laden
  const kompetenzen = db.prepare(`
    SELECT k.*, r.nummer as rayon_nummer
    FROM kompetenzen k
    JOIN rayone r ON k.rayon_id = r.id
  `).all();

  const kompetenzMap = {}; // mitarbeiter_id -> { rayon_id -> level }
  for (const k of kompetenzen) {
    if (!kompetenzMap[k.mitarbeiter_id]) kompetenzMap[k.mitarbeiter_id] = {};
    kompetenzMap[k.mitarbeiter_id][k.rayon_id] = k.level;
  }

  // Vertretungseinsätze im aktuellen Monat und Jahr laden für Fairness
  const monat = datum.substring(0, 7); // YYYY-MM
  const jahr = datum.substring(0, 4);

  const einsätzeMonat = db.prepare(`
    SELECT mitarbeiter_id, COUNT(*) as anzahl
    FROM vertretungseinsätze
    WHERE datum LIKE ?
    GROUP BY mitarbeiter_id
  `).all(`${monat}%`);

  const einsätzeJahr = db.prepare(`
    SELECT mitarbeiter_id, COUNT(*) as anzahl
    FROM vertretungseinsätze
    WHERE datum LIKE ?
    GROUP BY mitarbeiter_id
  `).all(`${jahr}%`);

  const einsatzMapMonat = {};
  const einsatzMapJahr = {};
  for (const e of einsätzeMonat) einsatzMapMonat[e.mitarbeiter_id] = e.anzahl;
  for (const e of einsätzeJahr) einsatzMapJahr[e.mitarbeiter_id] = e.anzahl;

  // Verfügbare Mitarbeiter mit Fairness-Score anreichern
  const kandidatenPool = verfügbareMitarbeiter.map(m => ({
    ...m,
    einsätzeMonat: einsatzMapMonat[m.id] || 0,
    einsätzeJahr: einsatzMapJahr[m.id] || 0,
    kompetenzen: kompetenzMap[m.id] || {},
    zugeteilt: false,
    zugeteilterRayon: null,
  }));

  const ergebnis = [];
  const zugeteiltePersonen = new Set(); // bereits verplante Mitarbeiter

  // Für jeden Ausfall eine Vertretung suchen
  for (const ausfall of ausfälle) {
    const betroffenerRayon = ausfall.rayon_id;
    const ausgefallenerMitarbeiter = ausfall;

    let besterKandidat = null;
    let besterLevel = 99;
    let kettenVertretung = null;

    // Schritt 1 & 2: Direkten Kandidaten suchen (Level 2 oder 3)
    for (const kandidat of kandidatenPool) {
      if (zugeteiltePersonen.has(kandidat.id)) continue;

      const level = kandidat.kompetenzen[betroffenerRayon];
      if (!level || level === 1) continue; // Level 1 = Stamm (kein Fremder bekommt das)

      if (level < besterLevel ||
        (level === besterLevel && kandidat.einsätzeMonat < (besterKandidat?.einsätzeMonat || 999))) {
        besterLevel = level;
        besterKandidat = kandidat;
      }
    }

    // Schritt 3: Kettenvertretung prüfen wenn kein direkter Kandidat
    if (!besterKandidat || besterLevel === 3) {
      // Suche: Gibt es jemanden dessen Stamm-Rayon von jemandem übernommen werden kann?
      for (const kandidatA of kandidatenPool) {
        if (zugeteiltePersonen.has(kandidatA.id)) continue;
        if (kandidatA.stamm_rayon_id === betroffenerRayon) continue;

        const levelA = kandidatA.kompetenzen[betroffenerRayon];
        if (!levelA || levelA === 1) continue;

        // Wer kann den Stamm-Rayon von kandidatA übernehmen?
        for (const kandidatB of kandidatenPool) {
          if (kandidatB.id === kandidatA.id) continue;
          if (zugeteiltePersonen.has(kandidatB.id)) continue;

          const levelB = kandidatB.kompetenzen[kandidatA.stamm_rayon_id];
          if (!levelB || levelB === 1) continue;

          // Kettenvertretung ist besser wenn B den Stamm-Rayon von A gut kennt (Level 2)
          const ketteBesser = !besterKandidat ||
            (levelA <= besterLevel && levelB <= 2);

          if (ketteBesser) {
            besterLevel = levelA;
            besterKandidat = kandidatA;
            kettenVertretung = { kandidatA, kandidatB, rayonVonA: kandidatA.stamm_rayon_id };
          }
          break; // Ersten guten Kandidaten B nehmen
        }
      }
    }

    if (besterKandidat) {
      zugeteiltePersonen.add(besterKandidat.id);

      const eintrag = {
        rayon_id: betroffenerRayon,
        ausgefallener_mitarbeiter_id: ausgefallenerMitarbeiter.mitarbeiter_id,
        vertreter_id: besterKandidat.id,
        vertreter_name: besterKandidat.name,
        kompetenz_level: besterLevel,
        ist_kettenvertretung: false,
      };

      if (kettenVertretung) {
        eintrag.ist_kettenvertretung = true;
        eintrag.kette = {
          kandidatB_id: kettenVertretung.kandidatB.id,
          kandidatB_name: kettenVertretung.kandidatB.name,
          rayon_von_a: kettenVertretung.rayonVonA,
        };
        zugeteiltePersonen.add(kettenVertretung.kandidatB.id);
      }

      ergebnis.push(eintrag);
    } else {
      // Kein Kandidat gefunden
      ergebnis.push({
        rayon_id: betroffenerRayon,
        ausgefallener_mitarbeiter_id: ausgefallenerMitarbeiter.mitarbeiter_id,
        vertreter_id: null,
        vertreter_name: null,
        kompetenz_level: null,
        fehler: 'Kein geeigneter Vertreter gefunden',
      });
    }
  }

  return ergebnis;
}

module.exports = { berechneVertretungsplan };
