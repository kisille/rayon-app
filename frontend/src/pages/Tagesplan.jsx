import React, { useState, useEffect } from 'react';
import {
  PrinterIcon, Cog6ToothIcon, CheckIcon, XMarkIcon,
  MagnifyingGlassIcon, PencilSquareIcon, UserIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { formatDatumLang, heuteDatum, statusLabel } from '../utils/helpers.js';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

// ─── Hilfsfunktion: Wochen eines Monats berechnen ─────────────────────────────
function getWeeksOfMonth(monat) {
  const [year, month] = monat.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  let cur = new Date(firstDay);
  while (cur <= lastDay) {
    const start = new Date(cur);
    const end = new Date(cur);
    end.setDate(end.getDate() + 6);
    if (end > lastDay) end.setTime(lastDay.getTime());
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(month).padStart(2, '0')}.`;
    weeks.push({
      von: start.toISOString().split('T')[0],
      bis: end.toISOString().split('T')[0],
      label: `${fmt(start)} – ${fmt(end)}${year}`,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Tagesplan() {
  const [datum, setDatum] = useState(heuteDatum());
  const [plan, setPlan] = useState(null);
  const [laden, setLaden] = useState(true);
  const [monatModalOffen, setMonatModalOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const [auswahlRayon, setAuswahlRayon] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);

  const monat = datum.substring(0, 7);

  const laden_ = async () => {
    setLaden(true);
    const { data } = await api.get(`/tagesplan/${datum}`);
    setPlan(data);
    setLaden(false);
  };

  useEffect(() => {
    laden_();
    const onVisible = () => { if (document.visibilityState === 'visible') laden_(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', laden_);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', laden_);
    };
  }, [datum]);
  useEffect(() => { api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data)); }, []);

  const gefiltertePlan = plan?.plan?.filter(eintrag => {
    if (!suche) return true;
    const q = suche.toLowerCase();
    return (
      eintrag.aktueller_mitarbeiter?.name?.toLowerCase().includes(q) ||
      eintrag.stamm_mitarbeiter?.name?.toLowerCase().includes(q) ||
      eintrag.rayon?.bezeichnung?.toLowerCase().includes(q) ||
      String(eintrag.rayon?.nummer).includes(q)
    );
  });

  const besetzt = plan?.plan?.filter(p => p.aktueller_mitarbeiter && !p.ist_teilbesetzung).length || 0;
  const teilbesetzt = plan?.plan?.filter(p => p.ist_teilbesetzung || (!p.aktueller_mitarbeiter && p.teilmitnahmen?.length > 0)).length || 0;
  const unbesetzt = plan?.plan?.filter(p => !p.aktueller_mitarbeiter && !(p.teilmitnahmen?.length > 0)).length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tagesplan</h1>
          <p className="text-gray-500 mt-1">Übersicht aller Rayone</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="input w-auto"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
          <button
            onClick={() => setMonatModalOffen(true)}
            className="btn-secondary flex items-center gap-2"
            title="Monatliche Rayon-Zuteilungen konfigurieren"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            Monat einrichten
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-2"
          >
            <PrinterIcon className="w-4 h-4" />
            Drucken
          </button>
        </div>
      </div>

      {/* Druckheader */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
        <h1 className="text-2xl font-bold">Post – Tagesplan</h1>
        <p className="text-lg">{formatDatumLang(datum)}</p>
      </div>

      {/* Statistik-Zeile */}
      {!laden && (
        <div className="grid grid-cols-3 gap-4 mb-4 no-print">
          <div className="card text-center p-4">
            <div className="text-2xl font-bold text-green-600">{besetzt}</div>
            <div className="text-sm text-gray-500">Besetzt</div>
          </div>
          <div className="card text-center p-4">
            <div className="text-2xl font-bold text-yellow-600">{teilbesetzt}</div>
            <div className="text-sm text-gray-500">Teilbesetzt</div>
          </div>
          <div className="card text-center p-4">
            <div className={`text-2xl font-bold ${unbesetzt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {unbesetzt}
            </div>
            <div className="text-sm text-gray-500">Unbesetzt</div>
          </div>
        </div>
      )}

      {/* Suchfeld */}
      {!laden && (
        <div className="relative mb-4 no-print">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Nach Mitarbeiter oder Rayon suchen..."
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}

      {laden ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 print:grid-cols-3">
            {gefiltertePlan?.map((eintrag) => (
              <RayonKarte
                key={eintrag.rayon.id}
                eintrag={eintrag}
                onClick={() => setAuswahlRayon(eintrag)}
              />
            ))}
            {gefiltertePlan?.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-400">
                Keine Rayone gefunden
              </div>
            )}
          </div>
        </>
      )}

      {/* Legende */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-100 text-sm text-gray-600 no-print">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          Besetzt
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          Teilbesetzt
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-300"></div>
          Unbesetzt
        </div>
        {!laden && (
          <span className="ml-auto text-xs text-gray-400 italic">
            Rayon anklicken, um direkt zuzuweisen
          </span>
        )}
      </div>

      {/* Monatszuteilung Modal */}
      {monatModalOffen && (
        <MonatsZuteilungModal
          monat={monat}
          onClose={() => { setMonatModalOffen(false); laden_(); }}
        />
      )}

      {/* Rayon-Zuweisung Modal (Klick auf Karte) */}
      {auswahlRayon && (
        <RayonZuweisungModal
          eintrag={auswahlRayon}
          datum={datum}
          mitarbeiter={mitarbeiter}
          plan={plan}
          onClose={() => setAuswahlRayon(null)}
          onSaved={() => { setAuswahlRayon(null); laden_(); }}
        />
      )}
    </div>
  );
}

// ─── RayonKarte ───────────────────────────────────────────────────────────────
function RayonKarte({ eintrag, onClick }) {
  const { rayon, aktueller_mitarbeiter, ist_mitnahme, ist_teilbesetzung, stamm_mitarbeiter, stamm_status, vertritt_name, teilmitnahmen = [] } = eintrag;

  const hatTeilmitnahmen = teilmitnahmen.length > 0;

  let hintergrund = 'bg-green-50 border-green-200';
  let statusPunkt = 'bg-green-400';
  let badge = null;

  if (!aktueller_mitarbeiter && !hatTeilmitnahmen) {
    hintergrund = 'bg-red-50 border-red-200';
    statusPunkt = 'bg-red-400';
  } else if (!aktueller_mitarbeiter && hatTeilmitnahmen) {
    hintergrund = 'bg-yellow-50 border-yellow-200';
    statusPunkt = 'bg-yellow-400';
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">Teilbesetzt</span>;
  } else if (ist_teilbesetzung) {
    hintergrund = 'bg-yellow-50 border-yellow-200';
    statusPunkt = 'bg-yellow-400';
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">Teilbesetzt</span>;
  } else if (ist_mitnahme) {
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">Mitnahme</span>;
  }

  return (
    <div
      className={`rounded-lg border-2 ${hintergrund} p-3 cursor-pointer hover:shadow-md transition-shadow group`}
      onClick={onClick}
      title="Klicken zum Bearbeiten"
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusPunkt} flex-shrink-0 mt-0.5`}></div>
          <span className="font-bold text-gray-800 text-sm">
            {rayon.bezeichnung}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {badge}
          <PencilSquareIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 no-print" />
        </div>
      </div>

      {aktueller_mitarbeiter ? (
        <div className="pl-4">
          <div className="font-semibold text-sm text-gray-900">{aktueller_mitarbeiter.name}</div>
          {ist_mitnahme && vertritt_name && (
            <div className="text-xs text-gray-500 mt-0.5">Mitnahme von: {vertritt_name}</div>
          )}
          {ist_teilbesetzung && vertritt_name && (
            <div className="text-xs text-gray-500 mt-0.5">Teilmitnahme von: {vertritt_name}</div>
          )}
          {stamm_status && stamm_status !== 'anwesend' && stamm_status !== 'stamm' && stamm_mitarbeiter && (
            <div className="text-xs text-red-500 mt-0.5">
              {stamm_mitarbeiter.name}: {statusLabel(stamm_status)}
            </div>
          )}
        </div>
      ) : (
        <div className="pl-4 text-red-500 text-sm font-medium italic">Nicht besetzt!</div>
      )}

      {/* Mehrere Teilmitnahmen anzeigen */}
      {hatTeilmitnahmen && (
        <div className="pl-4 mt-1 space-y-0.5">
          {teilmitnahmen.map(t => (
            <div key={t.id} className="text-xs text-yellow-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 inline-block"></span>
              {t.name} <span className="text-yellow-500">(Teilmitnahme)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RayonZuweisungModal (Direkte Zuweisung per Klick) ───────────────────────
function RayonZuweisungModal({ eintrag, datum, mitarbeiter, plan, onClose, onSaved }) {
  const { rayon, aktueller_mitarbeiter, ist_teilbesetzung, teilmitnahmen: vorhandeneTeilmitnahmen = [] } = eintrag;

  // Vollzustellung: aktueller MA, aber nur wenn er NICHT als alter Teilmitnahme-Stil markiert ist
  const initialVoll = (!ist_teilbesetzung && aktueller_mitarbeiter) ? aktueller_mitarbeiter.id : '';
  const [vollId, setVollId] = useState(initialVoll);
  const [vollSuche, setVollSuche] = useState('');

  // Teilmitnahmen: neue Tabelle
  const [teilIds, setTeilIds] = useState(vorhandeneTeilmitnahmen.map(t => t.id));
  const [teilSuche, setTeilSuche] = useState('');
  const [teilAuswahl, setTeilAuswahl] = useState('');

  // Konflikt-Hinweis: dieser MA war zuvor auf einem anderen Rayon als Vollzustellung
  const [konfliktInfo, setKonfliktInfo] = useState(null);
  const [konfliktRayonId, setKonfliktRayonId] = useState(null);

  const [speichernLaeuft, setSpeichernLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');

  // Vollzustellung-Konflikt prüfen wenn sich vollId ändert
  useEffect(() => {
    if (!vollId || !plan?.plan) {
      setKonfliktInfo(null);
      setKonfliktRayonId(null);
      return;
    }
    const konflikt = plan.plan.find(p =>
      p.rayon.id !== rayon.id &&
      p.aktueller_mitarbeiter?.id === parseInt(vollId) &&
      !p.ist_teilbesetzung
    );
    if (konflikt) {
      const ma = mitarbeiter.find(m => m.id === parseInt(vollId));
      setKonfliktInfo(`${ma?.name || 'Dieser Mitarbeiter'} war zuvor auf Rayon ${konflikt.rayon.nummer} (${konflikt.rayon.bezeichnung}) als Vollzustellung – dieser Rayon wird nun leer gesetzt.`);
      setKonfliktRayonId(konflikt.rayon.id);
    } else {
      setKonfliktInfo(null);
      setKonfliktRayonId(null);
    }
  }, [vollId]);

  const gefilterteVoll = mitarbeiter.filter(m => {
    if (!vollSuche) return true;
    const q = vollSuche.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.personalnummer.includes(q);
  });

  const gefilterteTeil = mitarbeiter.filter(m => {
    if (m.id === parseInt(vollId)) return false; // Vollzustellung nicht auch als Teilmitnahme
    if (teilIds.includes(m.id)) return false;    // bereits hinzugefügt
    if (!teilSuche) return true;
    const q = teilSuche.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.personalnummer.includes(q);
  });

  const teilmitnahmeHinzufuegen = (id) => {
    if (id && !teilIds.includes(parseInt(id))) {
      setTeilIds(prev => [...prev, parseInt(id)]);
    }
    setTeilAuswahl('');
    setTeilSuche('');
  };

  const teilmitnahmeEntfernen = (id) => {
    setTeilIds(prev => prev.filter(t => t !== id));
  };

  const handleSpeichern = async () => {
    setSpeichernLaeuft(true);
    setFehler('');
    try {
      const eintraege = [{
        rayon_id: rayon.id,
        mitarbeiter_id: vollId || null,
        ist_vertretung: false,
        ist_teilbesetzung: false,
        vertritt_mitarbeiter_id: null,
        teilmitnahmen: teilIds,
      }];

      // Konflikt-Rayon leeren
      if (konfliktRayonId) {
        eintraege.push({
          rayon_id: konfliktRayonId,
          mitarbeiter_id: null,
          ist_vertretung: false,
          ist_teilbesetzung: false,
          vertritt_mitarbeiter_id: null,
          teilmitnahmen: [],
        });
      }

      await api.post(`/tagesplan/${datum}/speichern`, { eintraege });
      onSaved();
    } catch {
      setFehler('Speichern fehlgeschlagen.');
      setSpeichernLaeuft(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{rayon.bezeichnung}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{datum} – Mitarbeiter zuweisen</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── Sektion 1: Vollzustellung ── */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Vollzustellung <span className="font-normal text-gray-400">(max. 1 Person)</span>
            </div>

            {/* Konflikt-Hinweis */}
            {konfliktInfo && (
              <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <span className="mt-0.5 text-amber-500 flex-shrink-0">⚠</span>
                {konfliktInfo}
              </div>
            )}

            <div className="relative mb-2">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="input pl-9 text-sm"
                placeholder="Vollzustellung suchen..."
                value={vollSuche}
                onChange={(e) => setVollSuche(e.target.value)}
                autoFocus
              />
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
              <div
                onClick={() => { setVollId(''); setVollSuche(''); }}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-b border-gray-100 ${
                  vollId === '' ? 'bg-red-50 text-red-700' : 'hover:bg-gray-50 text-gray-500 italic'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  vollId === '' ? 'bg-red-500 border-red-500' : 'border-gray-300'
                }`}>
                  {vollId === '' && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                – Unbesetzt –
              </div>
              {gefilterteVoll.map(m => (
                <div
                  key={m.id}
                  onClick={() => { setVollId(m.id); setVollSuche(''); }}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${
                    vollId === m.id ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    vollId === m.id ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}>
                    {vollId === m.id && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-400">Nr. {m.personalnummer}</div>
                  </div>
                </div>
              ))}
              {gefilterteVoll.length === 0 && (
                <div className="text-center py-3 text-gray-400 text-sm">Keine Mitarbeiter gefunden</div>
              )}
            </div>
          </div>

          {/* ── Sektion 2: Teilmitnahmen ── */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Teilmitnahmen <span className="font-normal text-gray-400">(mehrere möglich)</span>
            </div>

            {/* Aktuelle Teilmitnahmen-Liste */}
            {teilIds.length > 0 && (
              <div className="mb-2 space-y-1">
                {teilIds.map(id => {
                  const ma = mitarbeiter.find(m => m.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>
                        <span className="text-sm font-medium text-yellow-900">{ma?.name || `MA #${id}`}</span>
                      </div>
                      <button
                        onClick={() => teilmitnahmeEntfernen(id)}
                        className="text-yellow-500 hover:text-red-600 transition-colors"
                        title="Entfernen"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Teilmitnahme hinzufügen */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9 text-sm"
                  placeholder="Teilmitnahme hinzufügen..."
                  value={teilSuche}
                  onChange={(e) => { setTeilSuche(e.target.value); setTeilAuswahl(''); }}
                />
              </div>
            </div>
            {teilSuche && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mt-1 max-h-36 overflow-y-auto">
                {gefilterteTeil.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 text-sm">Keine weiteren Mitarbeiter</div>
                ) : (
                  gefilterteTeil.map(m => (
                    <div
                      key={m.id}
                      onClick={() => teilmitnahmeHinzufuegen(m.id)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-yellow-50 border-b border-gray-50 last:border-0"
                    >
                      <UserIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-400">Nr. {m.personalnummer}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {fehler && <div className="text-red-600 text-sm">{fehler}</div>}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={handleSpeichern} disabled={speichernLaeuft} className="btn-primary disabled:opacity-50">
            {speichernLaeuft ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Monatszuteilung Modal ────────────────────────────────────────────────────
function MonatsZuteilungModal({ monat, onClose }) {
  const [rayone, setRayone] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [zuteilungen, setZuteilungen] = useState({});
  const [laden, setLaden] = useState(true);
  const [gespeichert, setGespeichert] = useState(false);
  const [bearbeiteRayonId, setBearbeiteRayonId] = useState(null);
  const [validierungsFehler, setValidierungsFehler] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/rayone'),
      api.get('/mitarbeiter'),
      api.get('/monatszuteilungen', { params: { monat } }),
    ]).then(([rRes, mRes, zRes]) => {
      setRayone(rRes.data);
      setMitarbeiter(mRes.data);
      const bestehend = {};
      for (const z of zRes.data) {
        bestehend[z.rayon_id] = { mitarbeiter_id: z.mitarbeiter_id, ist_teilzuteilung: z.ist_teilzuteilung };
      }
      for (const m of mRes.data) {
        if (m.stamm_rayon_id) {
          const bereitsZugeteilt = Object.values(bestehend).some(z => z.mitarbeiter_id === m.id);
          if (!bereitsZugeteilt && !bestehend[m.stamm_rayon_id]) {
            bestehend[m.stamm_rayon_id] = { mitarbeiter_id: m.id, ist_teilzuteilung: 0 };
          }
        }
      }
      setZuteilungen(bestehend);
      setLaden(false);
    });
  }, [monat]);

  const handleSpeichern = async () => {
    setValidierungsFehler([]);

    // R2/R3: Clientseitige Validierung – max. 1 Ganzmitnahme, max. 2 Teilmitnahmen pro Mitarbeiter
    const perMitarbeiter = {};
    for (const [, z] of Object.entries(zuteilungen)) {
      if (!z.mitarbeiter_id) continue;
      const id = z.mitarbeiter_id;
      if (!perMitarbeiter[id]) perMitarbeiter[id] = { ganz: 0, teil: 0 };
      if (z.ist_teilzuteilung) perMitarbeiter[id].teil++;
      else perMitarbeiter[id].ganz++;
    }
    const fehler = [];
    for (const [id, counts] of Object.entries(perMitarbeiter)) {
      if (counts.ganz > 1) {
        const ma = mitarbeiter.find(m => m.id === parseInt(id));
        fehler.push(`${ma?.name || 'Mitarbeiter ' + id}: Maximal 1 Ganzmitnahme erlaubt (${counts.ganz} zugewiesen)`);
      }
      if (counts.teil > 2) {
        const ma = mitarbeiter.find(m => m.id === parseInt(id));
        fehler.push(`${ma?.name || 'Mitarbeiter ' + id}: Maximal 2 Teilmitnahmen erlaubt (${counts.teil} zugewiesen)`);
      }
    }
    if (fehler.length > 0) {
      setValidierungsFehler(fehler);
      return;
    }

    const eintraege = Object.entries(zuteilungen)
      .filter(([, z]) => z.mitarbeiter_id)
      .map(([rayon_id, z]) => ({
        rayon_id: parseInt(rayon_id),
        mitarbeiter_id: z.mitarbeiter_id,
        ist_teilzuteilung: z.ist_teilzuteilung ? 1 : 0,
      }));
    try {
      await api.post('/monatszuteilungen', { monat, eintraege });
      setGespeichert(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      const msg = err?.response?.data?.fehler || 'Speichern fehlgeschlagen';
      setValidierungsFehler([msg]);
    }
  };

  const monatAnzeige = new Date(monat + '-01').toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

  if (laden) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-8 text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Monatszuteilung</h2>
            <p className="text-sm text-gray-500">{monatAnzeige} – Welcher Mitarbeiter besetzt welchen Rayon?</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="space-y-1">
            {rayone.map(rayon => {
              const zuteilung = zuteilungen[rayon.id] || { mitarbeiter_id: '', ist_teilzuteilung: 0 };
              const istOffen = bearbeiteRayonId === rayon.id;
              return (
                <div key={rayon.id}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-yellow-700 font-bold text-sm">{rayon.nummer}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{rayon.bezeichnung}</div>
                      {rayon.gebiet && rayon.gebiet !== rayon.bezeichnung && (
                        <div className="text-xs text-gray-400">{rayon.gebiet}</div>
                      )}
                    </div>
                    <div className="w-48">
                      <SearchableSelect
                        options={mitarbeiter.map(m => ({ id: m.id, label: m.name, sublabel: `Nr. ${m.personalnummer}` }))}
                        value={zuteilung.mitarbeiter_id || ''}
                        onChange={id => setZuteilungen(prev => ({
                          ...prev,
                          [rayon.id]: { ...prev[rayon.id], mitarbeiter_id: id ? parseInt(id) : '', ist_teilzuteilung: prev[rayon.id]?.ist_teilzuteilung || 0 }
                        }))}
                        emptyLabel="– Unbesetzt –"
                        searchPlaceholder="Name oder Personalnummer..."
                      />
                    </div>
                    {/* Ganz/Teil-Toggle – nur sichtbar wenn Mitarbeiter ausgewählt */}
                    {zuteilung.mitarbeiter_id ? (
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 whitespace-nowrap"
                        value={zuteilung.ist_teilzuteilung ? '1' : '0'}
                        onChange={e => setZuteilungen(prev => ({
                          ...prev,
                          [rayon.id]: { ...prev[rayon.id], ist_teilzuteilung: e.target.value === '1' ? 1 : 0 }
                        }))}
                        title="Art der Zuteilung"
                      >
                        <option value="0">Ganzmitnahme</option>
                        <option value="1">Teilmitnahme</option>
                      </select>
                    ) : (
                      <div className="w-24" />
                    )}
                    <button
                      onClick={() => setBearbeiteRayonId(istOffen ? null : rayon.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                        istOffen
                          ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                      title="Einzelne Wochen oder Tage manuell besetzen"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      Bearbeiten
                    </button>
                  </div>

                  {/* Wochen-Editor (inline, wenn Bearbeiten aktiv) */}
                  {istOffen && (
                    <WochenEditor
                      rayon={rayon}
                      monat={monat}
                      mitarbeiter={mitarbeiter}
                      standardMitarbeiterId={zuteilung.mitarbeiter_id || ''}
                      onClose={() => setBearbeiteRayonId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pt-2 pb-0">
          {validierungsFehler.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-2">
              <div className="text-sm font-semibold text-red-700 mb-1">Zuteilung nicht möglich:</div>
              {validierungsFehler.map((f, i) => (
                <div key={i} className="text-sm text-red-600">• {f}</div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
          {gespeichert ? (
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckIcon className="w-5 h-5" />
              Gespeichert!
            </div>
          ) : (
            <div className="text-sm text-gray-500 space-y-0.5">
              <div>{Object.values(zuteilungen).filter(z => z.mitarbeiter_id && !z.ist_teilzuteilung).length} Ganzmitnahmen</div>
              <div>{Object.values(zuteilungen).filter(z => z.mitarbeiter_id && z.ist_teilzuteilung).length} Teilmitnahmen</div>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button onClick={handleSpeichern} className="btn-primary">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wochen-Editor (inline in MonatsZuteilungsModal) ─────────────────────────
function WochenEditor({ rayon, monat, mitarbeiter, standardMitarbeiterId, onClose }) {
  const wochen = getWeeksOfMonth(monat).slice(0, 4);
  const [wochenZuteilungen, setWochenZuteilungen] = useState({});
  const [laden, setLaden] = useState(true);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api.get('/tagesplan/wochenbesetzung', { params: { rayon_id: rayon.id, monat } })
      .then(({ data }) => {
        // Bestehende Tagespläne auf Wochen mappen
        const map = {};
        for (const eintrag of data) {
          const datum = eintrag.datum;
          // Woche finden, in die dieses Datum fällt
          const woche = wochen.find(w => datum >= w.von && datum <= w.bis);
          if (woche && !map[woche.von]) {
            map[woche.von] = eintrag.mitarbeiter_id || '';
          }
        }
        setWochenZuteilungen(map);
        setLaden(false);
      })
      .catch(() => setLaden(false));
  }, [rayon.id, monat]);

  const handleSpeichern = async () => {
    setFehler('');
    try {
      const wocheneintraege = wochen.map(w => ({
        von: w.von,
        bis: w.bis,
        mitarbeiter_id: wochenZuteilungen[w.von] !== undefined
          ? (wochenZuteilungen[w.von] || null)
          : null,
      })).filter(w => w.mitarbeiter_id !== null);

      await api.post('/tagesplan/wochenbesetzung', { rayon_id: rayon.id, wocheneintraege });
      setGespeichert(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      setFehler('Speichern fehlgeschlagen.');
    }
  };

  return (
    <div className="ml-14 mr-2 mb-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
        Wochenweise Besetzung – {rayon.bezeichnung}
      </div>
      {laden ? (
        <div className="text-xs text-gray-400">Lade...</div>
      ) : (
        <div className="space-y-2">
          {wochen.map(woche => {
            const val = wochenZuteilungen[woche.von] !== undefined
              ? wochenZuteilungen[woche.von]
              : ''; // leer = kein Override
            return (
              <div key={woche.von} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-40 flex-shrink-0">{woche.label}</span>
                <div className="flex-1">
                  <SearchableSelect
                    options={mitarbeiter.map(m => ({
                      id: m.id,
                      label: m.name + (m.id === standardMitarbeiterId ? ' (Standard)' : ''),
                      sublabel: `Nr. ${m.personalnummer}`,
                    }))}
                    value={val}
                    onChange={id => setWochenZuteilungen(prev => ({
                      ...prev,
                      [woche.von]: id ? parseInt(id) : '',
                    }))}
                    emptyLabel="– Standard (Monatszuteilung) –"
                    searchPlaceholder="Name oder Personalnummer..."
                  />
                </div>
              </div>
            );
          })}
          {fehler && <div className="text-red-600 text-xs">{fehler}</div>}
          {gespeichert && (
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
              <CheckIcon className="w-4 h-4" />
              Wochenbesetzung gespeichert!
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary text-xs py-1 px-3">Schließen</button>
            <button onClick={handleSpeichern} className="btn-primary text-xs py-1 px-3">
              Wochenbesetzung speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
