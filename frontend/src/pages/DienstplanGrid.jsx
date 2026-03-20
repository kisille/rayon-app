import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const STATUS_KUERZEL = {
  krank: 'K',
  urlaub: 'U',
  frei: 'Fr',
  sonstige: 'So',
};

const STATUS_KLASSE = {
  krank: 'text-red-600 font-bold',
  urlaub: 'text-blue-600 font-bold',
  frei: 'text-gray-500 font-medium',
  sonstige: 'text-orange-600 font-medium',
};

function formatRayon(nummer) {
  if (nummer == null) return '';
  return String(nummer).padStart(4, '0');
}

export default function DienstplanGrid() {
  const [monat, setMonat] = useState(() => new Date().toISOString().substring(0, 7));
  const [daten, setDaten] = useState(null);
  const [loading, setLoading] = useState(false);

  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  const ladeDaten = useCallback(async (m) => {
    setLoading(true);
    try {
      const resp = await api.get(`/dienstplan/grid?monat=${m}`);
      setDaten(resp.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { ladeDaten(monat); }, [monat, ladeDaten]);

  // Sync horizontal scroll: body drives header
  useEffect(() => {
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener('scroll', sync, { passive: true });
    return () => body.removeEventListener('scroll', sync);
  }, [daten]);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">

      {/* ── Sticky header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">

        {/* Title row */}
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-2 flex items-center gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Grid</h1>
            <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
              <span className="text-gray-400">Codes:</span>
              <span className="text-red-600 font-bold">K</span>
              <span className="text-gray-600">Krank</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-blue-600 font-bold">U</span>
              <span className="text-gray-600">Urlaub</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-teal-600 font-semibold">Kur</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-blue-800 font-semibold">SA1–SA8</span>
            </div>
          </div>
          <div className="ml-auto">
            <input
              type="month"
              value={monat}
              onChange={e => setMonat(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white"
            />
          </div>
        </div>

        {/* Day column headers – scrolls in sync with body */}
        <div className="overflow-x-hidden" ref={headerScrollRef}>
          <table className="border-collapse w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-100 border-r border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600 w-48 min-w-[12rem]">
                  Mitarbeiter
                </th>
                {daten?.tage.map(t => (
                  <th
                    key={t.datum}
                    className={`border-b border-r border-gray-200 px-1 py-1.5 text-center text-xs font-semibold w-14 min-w-[3.5rem] ${
                      t.wochentag === 0
                        ? 'text-red-500 bg-red-50'
                        : t.wochentag === 6
                        ? 'text-orange-500 bg-orange-50'
                        : 'text-gray-600 bg-gray-100'
                    }`}
                  >
                    <div>{t.tag}</div>
                    <div className="font-normal text-gray-400">{WOCHENTAG[t.wochentag]}</div>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <div className="overflow-x-auto" ref={bodyScrollRef}>
        <table className="border-collapse w-max">
          <colgroup>
            <col style={{ width: '12rem', minWidth: '12rem' }} />
            {daten?.tage.map(t => (
              <col key={t.datum} style={{ width: '3.5rem', minWidth: '3.5rem' }} />
            ))}
          </colgroup>
          <tbody>
            {loading && !daten && (
              <tr>
                <td colSpan={32} className="text-center py-12 text-gray-400">
                  Laden…
                </td>
              </tr>
            )}
            {daten?.mitarbeiter.map(m => (
              <tr key={m.id} className="hover:bg-yellow-50/40 border-b border-gray-100">
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5">
                  <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                  <div className="text-xs text-gray-400">{m.personalnummer}</div>
                </td>
                {daten.tage.map(t => {
                  const abw = m.abwesenheiten[t.datum];
                  const wert = abw
                    ? STATUS_KUERZEL[abw] || abw
                    : m.rayon_nummer && t.wochentag !== 0
                    ? formatRayon(m.rayon_nummer)
                    : null;
                  const klasse = abw ? (STATUS_KLASSE[abw] || 'text-gray-500') : 'text-gray-700';

                  return (
                    <td
                      key={t.datum}
                      className={`border-r border-gray-100 px-1 py-1.5 text-center text-xs ${
                        t.wochentag === 0 ? 'bg-red-50/40' : t.wochentag === 6 ? 'bg-orange-50/30' : ''
                      }`}
                    >
                      {wert && <span className={klasse}>{wert}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
