#!/usr/bin/env python3
"""Patch v2 – DienstplanGrid fixes, MonthPicker, Fahrzeuge modal fix"""
import os, re, textwrap

BASE = os.path.expanduser('~/hello-world')

def read(rel):
    return open(os.path.join(BASE, rel), encoding='utf-8').read()

def write(rel, content):
    open(os.path.join(BASE, rel), 'w', encoding='utf-8').write(content)

# ──────────────────────────────────────────────────────────────────────────────
# 1. Backend: Tagesplan-Daten zum Grid-Endpoint hinzufügen
# ──────────────────────────────────────────────────────────────────────────────
srv = read('backend/server.js')

# Fix regex \\d -> \d falls nötig
srv = srv.replace('\\\\d{4}-\\\\d{2}', '\\d{4}-\\d{2}')

if 'tagesplanMap' not in srv and '/api/dienstplan/grid' in srv:
    # Tagesplan-Query vor der Tage-Berechnung einfügen
    srv = srv.replace(
        "  const [jahr, mon] = monat.split('-').map(Number);\n  const tageImMonat",
        """  // Tagespläne: tägliche Rayon-Zuweisungen
  const tagesplaene = db.prepare(`
    SELECT t.datum, t.mitarbeiter_id, r.nummer as rayon_nummer
    FROM tagespläne t
    JOIN rayone r ON t.rayon_id = r.id
    WHERE t.datum LIKE ? AND t.mitarbeiter_id IS NOT NULL
  `).all(monat + '%');
  const tagesplanMap = {};
  for (const t of tagesplaene) {
    if (!tagesplanMap[t.mitarbeiter_id]) tagesplanMap[t.mitarbeiter_id] = {};
    tagesplanMap[t.mitarbeiter_id][t.datum] = t.rayon_nummer;
  }

  const [jahr, mon] = monat.split('-').map(Number);
  const tageImMonat""",
        1
    )
    # tagesplan zum Response hinzufügen
    srv = srv.replace(
        "      abwesenheiten: abwesenheitMap[m.id] || {},\n    })),",
        "      abwesenheiten: abwesenheitMap[m.id] || {},\n      tagesplan: tagesplanMap[m.id] || {},\n    })),",
        1
    )
    write('backend/server.js', srv)
    print('OK backend/server.js: Tagesplan-Daten + Regex-Fix')
elif 'tagesplanMap' in srv:
    # Nur Regex-Fix nötig
    write('backend/server.js', srv)
    print('OK backend/server.js: Regex-Fix (Tagesplan bereits vorhanden)')
else:
    print('-- backend/server.js: Grid-Endpoint nicht gefunden')

# ──────────────────────────────────────────────────────────────────────────────
# 2. MonthPicker-Komponente erstellen
# ──────────────────────────────────────────────────────────────────────────────
MONTHPICKER = r"""import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const MONATE = ['J\u00e4n', 'Feb', 'M\u00e4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function MonthPicker({ value, onChange, mode = 'month' }) {
  const [offen, setOffen] = useState(false);
  const [ansicht, setAnsicht] = useState(() => {
    const [j, m] = (value || new Date().toISOString().substring(0, 7)).split('-').map(Number);
    return { jahr: j, monat: m };
  });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOffen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (value) {
      const [j, m] = value.split('-').map(Number);
      setAnsicht({ jahr: j, monat: m || 1 });
    }
  }, [value]);

  const vorMonat = () => setAnsicht(a => a.monat === 1 ? { jahr: a.jahr - 1, monat: 12 } : { ...a, monat: a.monat - 1 });
  const nachMonat = () => setAnsicht(a => a.monat === 12 ? { jahr: a.jahr + 1, monat: 1 } : { ...a, monat: a.monat + 1 });
  const vorJahr = () => setAnsicht(a => ({ ...a, jahr: a.jahr - 1 }));
  const nachJahr = () => setAnsicht(a => ({ ...a, jahr: a.jahr + 1 }));

  const waehleMonat = (m) => {
    onChange(`${ansicht.jahr}-${String(m).padStart(2, '0')}`);
    setOffen(false);
  };

  const waehleDatum = (datum) => {
    onChange(datum);
    setOffen(false);
  };

  const heute = new Date().toISOString().split('T')[0];
  const heuteMonat = heute.substring(0, 7);

  const kalenderTage = () => {
    const ersterTag = new Date(ansicht.jahr, ansicht.monat - 1, 1);
    const letzterTag = new Date(ansicht.jahr, ansicht.monat, 0);
    let startWochentag = ersterTag.getDay();
    startWochentag = startWochentag === 0 ? 6 : startWochentag - 1;
    const tage = [];
    const vorMonatLetzter = new Date(ansicht.jahr, ansicht.monat - 1, 0).getDate();
    for (let i = startWochentag - 1; i >= 0; i--) {
      const t = vorMonatLetzter - i;
      const m = ansicht.monat === 1 ? 12 : ansicht.monat - 1;
      const j = ansicht.monat === 1 ? ansicht.jahr - 1 : ansicht.jahr;
      tage.push({ tag: t, datum: `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`, aktuell: false });
    }
    for (let d = 1; d <= letzterTag.getDate(); d++) {
      tage.push({ tag: d, datum: `${ansicht.jahr}-${String(ansicht.monat).padStart(2, '0')}-${String(d).padStart(2, '0')}`, aktuell: true });
    }
    const rest = 42 - tage.length;
    const nm = ansicht.monat === 12 ? 1 : ansicht.monat + 1;
    const nj = ansicht.monat === 12 ? ansicht.jahr + 1 : ansicht.jahr;
    for (let d = 1; d <= rest; d++) {
      tage.push({ tag: d, datum: `${nj}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, aktuell: false });
    }
    return tage;
  };

  const formatAnzeige = () => {
    if (!value) return '\u2014';
    if (mode === 'month') {
      const [j, m] = value.split('-').map(Number);
      return `${MONATE[m - 1]} ${j}`;
    }
    const [j, m, d] = value.split('-').map(Number);
    return `${d}. ${MONATE[m - 1]} ${j}`;
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOffen(!offen)}
        className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-yellow-400 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className="font-medium text-gray-700">{formatAnzeige()}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${offen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {offen && (
        <div className="absolute right-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <button onClick={mode === 'month' ? vorJahr : vorMonat} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {mode === 'month' ? ansicht.jahr : `${MONATE[ansicht.monat - 1]} ${ansicht.jahr}`}
            </span>
            <button onClick={mode === 'month' ? nachJahr : nachMonat} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {mode === 'month' ? (
            <div className="grid grid-cols-3 gap-1">
              {MONATE.map((name, i) => {
                const mStr = `${ansicht.jahr}-${String(i + 1).padStart(2, '0')}`;
                const istAktuell = value === mStr;
                const istHeute = heuteMonat === mStr;
                return (
                  <button
                    key={i}
                    onClick={() => waehleMonat(i + 1)}
                    className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      istAktuell
                        ? 'bg-yellow-500 text-white shadow-sm'
                        : istHeute
                        ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-1">
                {WOCHENTAGE.map(t => (
                  <div key={t} className="text-center text-xs font-medium text-gray-400 py-1">{t}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {kalenderTage().map((t, i) => {
                  const istGewaehlt = value === t.datum;
                  const istHeute2 = heute === t.datum;
                  const wochentag = new Date(t.datum).getDay();
                  const istWochenende = wochentag === 0 || wochentag === 6;
                  return (
                    <button
                      key={i}
                      onClick={() => waehleDatum(t.datum)}
                      className={`w-9 h-9 rounded-lg text-sm flex items-center justify-center transition-colors ${
                        istGewaehlt
                          ? 'bg-yellow-500 text-white font-bold shadow-sm'
                          : istHeute2
                          ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300 font-semibold'
                          : !t.aktuell
                          ? 'text-gray-300'
                          : istWochenende
                          ? 'text-red-400 hover:bg-red-50'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {t.tag}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => {
                const h = new Date();
                if (mode === 'month') {
                  onChange(h.toISOString().substring(0, 7));
                  setAnsicht({ jahr: h.getFullYear(), monat: h.getMonth() + 1 });
                } else {
                  onChange(heute);
                  setAnsicht({ jahr: h.getFullYear(), monat: h.getMonth() + 1 });
                }
                setOffen(false);
              }}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium px-3 py-1 hover:bg-yellow-50 rounded-md transition-colors"
            >
              {mode === 'month' ? 'Aktueller Monat' : 'Heute'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
"""

write('frontend/src/components/MonthPicker.jsx', MONTHPICKER)
print('OK MonthPicker.jsx erstellt')

# ──────────────────────────────────────────────────────────────────────────────
# 3. DienstplanGrid.jsx komplett ersetzen (Alignment-Fix + Tagesplan + MonthPicker)
# ──────────────────────────────────────────────────────────────────────────────
GRID = r"""import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import MonthPicker from '../components/MonthPicker';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const STATUS_KUERZEL = { krank: 'K', urlaub: 'U', frei: 'Fr', sonstige: 'So' };
const STATUS_KLASSE = { krank: 'text-red-600 font-bold', urlaub: 'text-blue-600 font-bold', frei: 'text-gray-500 font-medium', sonstige: 'text-orange-600 font-medium' };
const NAME_W = 200;
const DAY_W = 56;

function formatRayon(n) { return n == null ? '' : String(n).padStart(4, '0'); }

export default function DienstplanGrid() {
  const [monat, setMonat] = useState(() => new Date().toISOString().substring(0, 7));
  const [daten, setDaten] = useState(null);
  const [loading, setLoading] = useState(false);
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  const ladeDaten = useCallback(async (m) => {
    setLoading(true);
    try { const r = await api.get('/dienstplan/grid?monat=' + m); setDaten(r.data); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { ladeDaten(monat); }, [monat, ladeDaten]);

  useEffect(() => {
    const body = bodyRef.current; const header = headerRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener('scroll', sync, { passive: true });
    return () => body.removeEventListener('scroll', sync);
  }, [daten]);

  const totalW = daten ? NAME_W + daten.tage.length * DAY_W : NAME_W;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-2 flex items-center gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Grid</h1>
            <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
              <span className="text-gray-400">Codes:</span>
              <span className="text-red-600 font-bold">K</span><span className="text-gray-600">Krank</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-blue-600 font-bold">U</span><span className="text-gray-600">Urlaub</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-teal-600 font-semibold">Kur</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-blue-800 font-semibold">SA1&ndash;SA8</span>
            </div>
          </div>
          <div className="ml-auto">
            <MonthPicker value={monat} onChange={setMonat} mode="month" />
          </div>
        </div>
        <div className="overflow-x-hidden" ref={headerRef}>
          <div style={{ width: totalW, display: 'flex' }}>
            <div className="sticky left-0 z-10 bg-gray-100 border-r border-b border-gray-200 flex items-center px-3 text-xs font-semibold text-gray-600 shrink-0" style={{ width: NAME_W, minWidth: NAME_W, height: 44 }}>
              Mitarbeiter
            </div>
            {daten?.tage.map(t => (
              <div key={t.datum}
                className={`border-b border-r border-gray-200 flex flex-col items-center justify-center text-xs font-semibold shrink-0 ${t.wochentag === 0 ? 'text-red-500 bg-red-50' : t.wochentag === 6 ? 'text-orange-500 bg-orange-50' : 'text-gray-600 bg-gray-100'}`}
                style={{ width: DAY_W, minWidth: DAY_W, height: 44 }}>
                <span>{t.tag}</span>
                <span className="font-normal text-gray-400">{WOCHENTAG[t.wochentag]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto" ref={bodyRef}>
        <div style={{ width: totalW }}>
          {loading && !daten && <div className="text-center py-12 text-gray-400">Laden...</div>}
          {daten?.mitarbeiter.map(m => (
            <div key={m.id} className="flex border-b border-gray-100 hover:bg-yellow-50/40">
              <div className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 flex flex-col justify-center shrink-0" style={{ width: NAME_W, minWidth: NAME_W, height: 48 }}>
                <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                <div className="text-xs text-gray-400">{m.personalnummer}</div>
              </div>
              {daten.tage.map(t => {
                const abw = m.abwesenheiten[t.datum];
                const tpRayon = m.tagesplan && m.tagesplan[t.datum];
                const wert = abw
                  ? (STATUS_KUERZEL[abw] || abw)
                  : tpRayon != null
                  ? formatRayon(tpRayon)
                  : (m.rayon_nummer && t.wochentag !== 0 ? formatRayon(m.rayon_nummer) : null);
                const klasse = abw
                  ? (STATUS_KLASSE[abw] || 'text-gray-500')
                  : (tpRayon != null && tpRayon !== m.rayon_nummer ? 'text-purple-600 font-medium' : 'text-gray-700');
                return (
                  <div key={t.datum}
                    className={`flex items-center justify-center text-xs shrink-0 border-r border-gray-100 ${t.wochentag === 0 ? 'bg-red-50/40' : t.wochentag === 6 ? 'bg-orange-50/30' : ''}`}
                    style={{ width: DAY_W, minWidth: DAY_W, height: 48 }}>
                    {wert && <span className={klasse}>{wert}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
"""
write('frontend/src/pages/DienstplanGrid.jsx', GRID)
print('OK DienstplanGrid.jsx (Alignment + Tagesplan + MonthPicker)')

# ──────────────────────────────────────────────────────────────────────────────
# 4. Fahrzeuge Modal fix
# ──────────────────────────────────────────────────────────────────────────────
fz = read('frontend/src/pages/Fahrzeuge.jsx')
changed = False
OLD1 = 'justify-center bg-black/50">'
NEW1 = 'justify-center bg-black/50" onClick={() => setModalOffen(false)}>'
OLD2 = 'max-h-[90vh] overflow-y-auto">'
NEW2 = 'max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>'
if 'stopPropagation' not in fz:
    fz = fz.replace(OLD1, NEW1, 1)
    fz = fz.replace(OLD2, NEW2, 1)
    write('frontend/src/pages/Fahrzeuge.jsx', fz)
    print('OK Fahrzeuge.jsx modal fix')
    changed = True
else:
    print('-- Fahrzeuge.jsx: bereits gefixt')

# ──────────────────────────────────────────────────────────────────────────────
# 5. App.jsx: Duplikat-Import entfernen
# ──────────────────────────────────────────────────────────────────────────────
app = read('frontend/src/App.jsx')
dupe = "import DienstplanGrid from './pages/DienstplanGrid.jsx';\nimport DienstplanGrid from './pages/DienstplanGrid.jsx';"
if dupe in app:
    app = app.replace(dupe, "import DienstplanGrid from './pages/DienstplanGrid.jsx';")
    write('frontend/src/App.jsx', app)
    print('OK App.jsx: Duplikat-Import entfernt')
else:
    print('-- App.jsx: ok')

# ──────────────────────────────────────────────────────────────────────────────
# 6. Layout.jsx: Duplikat-Eintrag entfernen
# ──────────────────────────────────────────────────────────────────────────────
lay = read('frontend/src/components/Layout.jsx')
lines = lay.split('\n')
seen_grid = False
new_lines = []
for line in lines:
    if "href: '/dienstplan-grid'" in line:
        if seen_grid:
            continue
        seen_grid = True
    new_lines.append(line)
new_lay = '\n'.join(new_lines)
if new_lay != lay:
    write('frontend/src/components/Layout.jsx', new_lay)
    print('OK Layout.jsx: Duplikat entfernt')
else:
    print('-- Layout.jsx: ok')

print('\nAlle Patches angewendet!')
print('Jetzt: cd frontend && npm run build && cd .. && ./starten.sh')
