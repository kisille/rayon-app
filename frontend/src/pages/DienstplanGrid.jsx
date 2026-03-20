import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import MonthPicker from '../components/MonthPicker';

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

const NAME_W = 200;
const DAY_W = 56;

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
      const resp = await api.get('/dienstplan/grid?monat=' + m);
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

  const totalW = daten ? NAME_W + daten.tage.length * DAY_W : NAME_W;

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
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-blue-600 font-bold">U</span>
              <span className="text-gray-600">Urlaub</span>
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

        {/* Day column headers */}
        <div className="overflow-x-hidden" ref={headerScrollRef}>
          <div style={{ width: totalW, display: 'flex' }}>
            <div
              className="sticky left-0 z-10 bg-gray-100 border-r border-b border-gray-200 flex items-center px-3 text-xs font-semibold text-gray-600 shrink-0"
              style={{ width: NAME_W, minWidth: NAME_W, height: 44 }}
            >
              Mitarbeiter
            </div>
            {daten?.tage.map(t => (
              <div
                key={t.datum}
                className={`border-b border-r border-gray-200 flex flex-col items-center justify-center text-xs font-semibold shrink-0 ${
                  t.wochentag === 0
                    ? 'text-red-600 bg-red-100 font-bold'
                    : t.wochentag === 6
                    ? 'text-amber-700 bg-amber-100 font-bold'
                    : 'text-gray-600 bg-gray-100'
                }`}
                style={{ width: DAY_W, minWidth: DAY_W, height: 44 }}
              >
                <span>{t.tag}</span>
                <span className="font-normal text-gray-400">{WOCHENTAG[t.wochentag]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <div className="overflow-x-auto" ref={bodyScrollRef}>
        <div style={{ width: totalW }}>
          {loading && !daten && (
            <div className="text-center py-12 text-gray-400">Laden...</div>
          )}
          {daten?.mitarbeiter.map(m => (
            <div key={m.id} className="flex border-b border-gray-100 hover:bg-yellow-50/40">
              <div
                className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 flex flex-col justify-center shrink-0"
                style={{ width: NAME_W, minWidth: NAME_W, height: 48 }}
              >
                <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                <div className="text-xs text-gray-400">{m.personalnummer}</div>
              </div>
              {daten.tage.map(t => {
                const abw = m.abwesenheiten[t.datum];
                // Tagesplan hat Vorrang vor Monatszuteilung
                const tpRayon = m.tagesplan?.[t.datum];
                const wert = abw
                  ? STATUS_KUERZEL[abw] || abw
                  : tpRayon != null
                  ? formatRayon(tpRayon)
                  : m.rayon_nummer && t.wochentag !== 0
                  ? formatRayon(m.rayon_nummer)
                  : null;
                const klasse = abw
                  ? (STATUS_KLASSE[abw] || 'text-gray-500')
                  : tpRayon != null && tpRayon !== m.rayon_nummer
                  ? 'text-purple-600 font-medium'
                  : 'text-gray-700';

                return (
                  <div
                    key={t.datum}
                    className={`flex items-center justify-center text-xs shrink-0 border-r border-gray-100 ${
                      t.wochentag === 0 ? 'bg-red-100/60' : t.wochentag === 6 ? 'bg-amber-50/60' : ''
                    }`}
                    style={{ width: DAY_W, minWidth: DAY_W, height: 48 }}
                  >
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
