import React, { useState, useEffect } from 'react';
import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  CheckIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { heuteDatum, formatDatumLang } from '../utils/helpers.js';

const MITNAHME_ART_LABEL = {
  vollmitnahme: 'Vollmitnahme',
  teilmitnahme: 'Teilmitnahme',
};

export default function Mitnahmeplanung() {
  const [datum, setDatum] = useState(heuteDatum());
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [rayone, setRayone] = useState([]);
  const [ausgewählteAusfälle, setAusgewählteAusfälle] = useState([]);
  const [mitnahmeplan, setMitnahmeplan] = useState(null);
  const [berechnet, setBerechnet] = useState(false);
  const [berechnung, setBerechnung] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [manuelleModus, setManuelleModus] = useState(false);
  const [mitarbeiterSuche, setMitarbeiterSuche] = useState('');

  const monat = datum.substring(0, 7);

  useEffect(() => {
    api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data));
    api.get('/rayone').then(({ data }) => setRayone(data));
  }, []);

  useEffect(() => {
    setBerechnet(false);
    setMitnahmeplan(null);
    setGespeichert(false);
    api.get('/abwesenheiten', { params: { datum } }).then(({ data }) => {
      const ausfälle = data.filter(a => a.status !== 'anwesend');
      setAbwesenheiten(ausfälle);
      setAusgewählteAusfälle(ausfälle.map(a => a.mitarbeiter_id));
    });
  }, [datum]);

  const toggleAusfall = (mitarbeiterId) => {
    setAusgewählteAusfälle(prev =>
      prev.includes(mitarbeiterId)
        ? prev.filter(id => id !== mitarbeiterId)
        : [...prev, mitarbeiterId]
    );
    setBerechnet(false);
    setMitnahmeplan(null);
  };

  // Aktuellen Rayon eines Mitarbeiters ermitteln (aus Monatszuteilung oder Stamm)
  const getMitarbeiterRayon = (m) => {
    const nummer = m.aktueller_rayon_nummer || m.stamm_rayon_nummer;
    if (!nummer) return null;
    const nrStr = String(nummer).padStart(4, '0');
    const gebiet = m.aktueller_rayon_gebiet || m.stamm_rayon_gebiet;
    const bezeichnung = m.aktueller_rayon_bezeichnung || m.stamm_rayon_bezeichnung;
    // Gebiet bevorzugen, sonst Bezeichnung (wenn sie nicht nur "Rayon XXXX" ist)
    const ort = gebiet || (bezeichnung && bezeichnung !== `Rayon ${nrStr}` && bezeichnung !== `Rayon ${nummer}` ? bezeichnung : null);
    return `Rayon ${nrStr}${ort ? ' – ' + ort : ''}`;
  };

  const handleBerechnen = async () => {
    if (ausgewählteAusfälle.length === 0) return;
    setBerechnung(true);
    try {
      const { data } = await api.post('/mitnahme/berechnen', {
        datum,
        ausfälle: ausgewählteAusfälle.map(id => ({ mitarbeiter_id: id })),
      });
      setMitnahmeplan(data.plan.map(p => ({ ...p, _art: p.art })));
      setBerechnet(true);
    } finally {
      setBerechnung(false);
    }
  };

  const handlePlanEintragAnpassen = (index, feld, wert) => {
    setMitnahmeplan(prev => {
      const neu = [...prev];
      neu[index] = { ...neu[index], [feld]: wert };
      // Art aktualisiert → ist_teilbesetzung synchronisieren
      if (feld === '_art') {
        neu[index].ist_teilbesetzung = wert === 'teilmitnahme' ? 1 : 0;
      }
      return neu;
    });
  };

  const handleSpeichern = async () => {
    if (!mitnahmeplan) return;

    const eintraege = mitnahmeplan
      .filter(p => p.vertreter_id)
      .map(p => ({
        rayon_id: p.rayon_id,
        mitarbeiter_id: p.vertreter_id,
        ist_vertretung: true,
        ist_teilbesetzung: p._art === 'teilmitnahme',
        vertritt_mitarbeiter_id: p.ausgefallener_mitarbeiter_id || null,
      }));

    try {
      await api.post(`/tagesplan/${datum}/speichern`, { eintraege });
      setGespeichert(true);
    } catch (err) {
      alert('Fehler beim Speichern: ' + (err?.response?.data?.fehler || err.message));
    }
  };

  const mitarbeiterMitStatus = mitarbeiter.map(m => {
    const abwesenheit = abwesenheiten.find(a => a.mitarbeiter_id === m.id);
    return { ...m, abwesenheit, istAusgefallen: ausgewählteAusfälle.includes(m.id) };
  });

  // Mitarbeiter die keine Mitnahme haben
  const keineMitnahme = mitarbeiter.filter(m => m.mitnahme_modus === 'keine');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mitnahmeplanung</h1>
          <p className="text-gray-500 mt-1">Optimale Mitnahmen automatisch berechnen oder manuell zuteilen</p>
        </div>
        <input
          type="date"
          className="input w-auto"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Seite: Ausfälle auswählen */}
        <div>
          <div className="card mb-4">
            <h2 className="font-semibold text-gray-900 mb-1">
              Schritt 1: Abwesende markieren
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Welche Mitarbeiter fehlen am {formatDatumLang(datum)}?
              Bereits eingetragene Abwesenheiten sind vorausgewählt.
            </p>

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {mitarbeiterMitStatus.map((m) => {
                const rayonAnzeige = getMitarbeiterRayon(m);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleAusfall(m.id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      m.istAusgefallen
                        ? 'bg-red-50 border-2 border-red-300'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        m.istAusgefallen ? 'bg-red-500 border-red-500' : 'border-gray-300'
                      }`}>
                        {m.istAusgefallen && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{m.name}</div>
                        {rayonAnzeige && (
                          <div className="text-xs text-gray-500">{rayonAnzeige}</div>
                        )}
                        {m.mitnahme_modus === 'keine' && (
                          <div className="text-xs text-orange-500">Keine Mitnahme</div>
                        )}
                        {m.mitnahme_modus === 'teilweise' && (
                          <div className="text-xs text-blue-500">Nur Teilmitnahme</div>
                        )}
                      </div>
                    </div>
                    {m.abwesenheit && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.abwesenheit.status === 'krank' ? 'bg-red-100 text-red-700' :
                        m.abwesenheit.status === 'urlaub' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {m.abwesenheit.status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {ausgewählteAusfälle.length} Ausfall{ausgewählteAusfälle.length !== 1 ? 'fälle' : ''} ausgewählt
            </span>
            <button
              onClick={handleBerechnen}
              disabled={ausgewählteAusfälle.length === 0 || berechnung}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SparklesIcon className="w-4 h-4" />
              {berechnung ? 'Berechne...' : 'Mitnahmen berechnen'}
            </button>
          </div>
        </div>

        {/* Rechte Seite: Ergebnis */}
        <div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Schritt 2: Mitnahmeplan
              </h2>
              {berechnet && (
                <button
                  onClick={() => { setManuelleModus(!manuelleModus); setMitarbeiterSuche(''); }}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                    manuelleModus ? 'bg-yellow-100 text-yellow-800' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" />
                  {manuelleModus ? 'Manuell aktiv' : 'Manuell bearbeiten'}
                </button>
              )}
            </div>

            {/* Suchfeld im manuellen Modus */}
            {berechnet && manuelleModus && (
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9 text-sm"
                  placeholder="Mitarbeiter nach Name oder Nr. suchen..."
                  value={mitarbeiterSuche}
                  onChange={(e) => setMitarbeiterSuche(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            {!berechnet && (
              <div className="text-center py-12 text-gray-400">
                <ArrowsRightLeftIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">
                  Markieren Sie Ausfälle und klicken Sie auf "Mitnahmen berechnen"
                </p>
              </div>
            )}

            {berechnet && mitnahmeplan && (
              <div className="space-y-3">
                {mitnahmeplan.map((p, i) => {
                  const gefilterteMitarbeiter = mitarbeiterSuche
                    ? mitarbeiter.filter(m => {
                        const q = mitarbeiterSuche.toLowerCase();
                        return m.name.toLowerCase().includes(q) || m.personalnummer.includes(mitarbeiterSuche);
                      })
                    : mitarbeiter;
                  return (
                  <MitnahmeEintrag
                    key={i}
                    eintrag={p}
                    index={i}
                    manuelleModus={manuelleModus}
                    mitarbeiter={gefilterteMitarbeiter}
                    rayone={rayone}
                    onAnpassen={handlePlanEintragAnpassen}
                  />
                  );
                })}

                <div className="mt-6 pt-4 border-t border-gray-100">
                  {gespeichert ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircleIcon className="w-5 h-5" />
                      Tagesplan wurde gespeichert!
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">Plan überprüfen und bestätigen:</p>
                      <button onClick={handleSpeichern} className="btn-primary">
                        Plan bestätigen & speichern
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Kompetenz-Hinweis */}
          {berechnet && (
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-green-100 text-green-800 rounded text-center font-bold leading-4">2</span>
                kennt Rayon gut
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-orange-100 text-orange-800 rounded text-center font-bold leading-4">3</span>
                kennt Rayon mäßig
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MitnahmeEintrag({ eintrag, index, manuelleModus, mitarbeiter, rayone, onAnpassen }) {
  const hatVertreter = !!eintrag.vertreter_id;
  const art = eintrag._art || eintrag.art || 'vollmitnahme';
  const istTeilmitnahme = art === 'teilmitnahme';

  return (
    <div className={`rounded-lg border-2 p-3 ${
      !hatVertreter ? 'border-red-200 bg-red-50' :
      istTeilmitnahme ? 'border-yellow-200 bg-yellow-50' :
      eintrag.kompetenz_level === 2 ? 'border-green-200 bg-green-50' :
      'border-orange-200 bg-orange-50'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-sm text-gray-900">
            {eintrag.rayon_nummer} – {eintrag.rayon_bezeichnung}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Abwesend: <span className="font-medium text-red-600">{eintrag.ausgefallener_name}</span>
          </div>
        </div>
        {eintrag.kompetenz_level && (
          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
            eintrag.kompetenz_level === 2 ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'
          }`}>
            L{eintrag.kompetenz_level}
          </span>
        )}
      </div>

      {manuelleModus ? (
        /* Manuelle Bearbeitung */
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-xs text-gray-500">Mitarbeiter:</label>
            <select
              className="input text-sm mt-0.5"
              value={eintrag.vertreter_id || ''}
              onChange={e => onAnpassen(index, 'vertreter_id', e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">– Kein Mitarbeiter –</option>
              {mitarbeiter.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Art der Mitnahme:</label>
            <select
              className="input text-sm mt-0.5"
              value={art}
              onChange={e => onAnpassen(index, '_art', e.target.value)}
            >
              <option value="vollmitnahme">Vollmitnahme (eigener Rayon unbesetzt)</option>
              <option value="teilmitnahme">Teilmitnahme (eigener Rayon bleibt besetzt)</option>
            </select>
          </div>
        </div>
      ) : (
        /* Anzeige-Modus */
        hatVertreter ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="font-semibold text-sm text-gray-900">{eintrag.vertreter_name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                istTeilmitnahme ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {istTeilmitnahme ? 'Teilmitnahme' : 'Vollmitnahme'}
              </span>
            </div>
            {!istTeilmitnahme && eintrag.eigener_rayon_unbesetzt && (
              <div className="mt-1 ml-5 text-xs text-orange-700 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3.5 h-3.5" />
                <span>Eigener Rayon wird unbesetzt</span>
              </div>
            )}
            {istTeilmitnahme && (
              <div className="mt-1 ml-5 text-xs text-blue-700">
                Eigener Rayon bleibt besetzt
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-red-600">
            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">
              {eintrag.fehler || 'Kein geeigneter Mitarbeiter verfügbar!'}
            </span>
          </div>
        )
      )}
    </div>
  );
}
