import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const MONATE = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
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
    const val = `${ansicht.jahr}-${String(m).padStart(2, '0')}`;
    onChange(val);
    setOffen(false);
  };

  const waehleDatum = (datum) => {
    onChange(datum);
    setOffen(false);
  };

  const heute = new Date().toISOString().split('T')[0];
  const heuteMonat = heute.substring(0, 7);

  // Kalender-Tage für die Monatsansicht generieren
  const kalenderTage = () => {
    const ersterTag = new Date(ansicht.jahr, ansicht.monat - 1, 1);
    const letzterTag = new Date(ansicht.jahr, ansicht.monat, 0);
    let startWochentag = ersterTag.getDay(); // 0=So
    startWochentag = startWochentag === 0 ? 6 : startWochentag - 1; // Mo=0

    const tage = [];
    // Tage des Vormonats
    const vorMonatLetzer = new Date(ansicht.jahr, ansicht.monat - 1, 0).getDate();
    for (let i = startWochentag - 1; i >= 0; i--) {
      const t = vorMonatLetzer - i;
      const m = ansicht.monat === 1 ? 12 : ansicht.monat - 1;
      const j = ansicht.monat === 1 ? ansicht.jahr - 1 : ansicht.jahr;
      tage.push({ tag: t, datum: `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`, aktuell: false });
    }
    // Tage des aktuellen Monats
    for (let d = 1; d <= letzterTag.getDate(); d++) {
      tage.push({ tag: d, datum: `${ansicht.jahr}-${String(ansicht.monat).padStart(2, '0')}-${String(d).padStart(2, '0')}`, aktuell: true });
    }
    // Tage des nächsten Monats
    const rest = 42 - tage.length;
    const nm = ansicht.monat === 12 ? 1 : ansicht.monat + 1;
    const nj = ansicht.monat === 12 ? ansicht.jahr + 1 : ansicht.jahr;
    for (let d = 1; d <= rest; d++) {
      tage.push({ tag: d, datum: `${nj}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, aktuell: false });
    }
    return tage;
  };

  const formatAnzeige = () => {
    if (!value) return '—';
    if (mode === 'month') {
      const [j, m] = value.split('-').map(Number);
      return `${MONATE[m - 1]} ${j}`;
    }
    // date mode
    const [j, m, d] = value.split('-').map(Number);
    return `${d}. ${MONATE[m - 1]} ${j}`;
  };

  const aktuellerMonatStr = `${ansicht.jahr}-${String(ansicht.monat).padStart(2, '0')}`;
  const istAktuellerMonat = mode === 'month' && value === aktuellerMonatStr;

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
          {/* Navigation */}
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
            /* Monats-Grid */
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
            /* Tages-Kalender */
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

          {/* Heute-Button */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => {
                const h = new Date();
                if (mode === 'month') {
                  const val = h.toISOString().substring(0, 7);
                  onChange(val);
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
