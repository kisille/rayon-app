import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../utils/api.js';
import { statusBadgeClass, statusLabel } from '../utils/helpers.js';

const STATUS_FARBEN = {
  krank: 'bg-red-500',
  urlaub: 'bg-blue-500',
  frei: 'bg-green-500',
  sonstige: 'bg-gray-400',
};

export default function Jahreskalender() {
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [abwesenheitMap, setAbwesenheitMap] = useState({});
  const [laden, setLaden] = useState(true);
  const [selectedTag, setSelectedTag] = useState(null); // { datum, list }
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const popupRef = useRef(null);
  const heute = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const laden_ = async () => {
      setLaden(true);
      try {
        const res = await api.get('/abwesenheiten', {
          params: { von: `${jahr}-01-01`, bis: `${jahr}-12-31` },
        });
        const map = {};
        for (const a of res.data) {
          if (!map[a.datum]) map[a.datum] = [];
          map[a.datum].push(a);
        }
        setAbwesenheitMap(map);
      } finally {
        setLaden(false);
      }
    };
    laden_();
  }, [jahr]);

  // Popup schliessen bei Klick ausserhalb
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setSelectedTag(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTagClick = (datum, list, e) => {
    if (!list || list.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    setSelectedTag({ datum, list });
  };

  const monate = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jahreskalender</h1>
          <p className="text-gray-500 mt-1">Abwesenheiten im Jahresüberblick</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary p-2"
            onClick={() => setJahr(j => j - 1)}
            title="Vorjahr"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="text-xl font-bold text-gray-800 w-16 text-center">{jahr}</span>
          <button
            className="btn-secondary p-2"
            onClick={() => setJahr(j => j + 1)}
            title="Nächstes Jahr"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          <button
            className="btn-secondary ml-2"
            onClick={() => setJahr(new Date().getFullYear())}
          >
            Heute
          </button>
        </div>
      </div>

      {/* Legende */}
      <div className="card mb-6 flex items-center gap-6 flex-wrap">
        {Object.entries(STATUS_FARBEN).map(([status, farbe]) => (
          <div key={status} className="flex items-center gap-2 text-sm text-gray-600">
            <span className={`w-3 h-3 rounded-full ${farbe}`} />
            {statusLabel(status)}
          </div>
        ))}
      </div>

      {laden ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {monate.map(monatIndex => (
            <MonatsKarte
              key={monatIndex}
              jahr={jahr}
              monatIndex={monatIndex}
              abwesenheitMap={abwesenheitMap}
              heute={heute}
              onTagClick={handleTagClick}
              selectedDatum={selectedTag?.datum}
            />
          ))}
        </div>
      )}

      {/* Popup für Tagesdetails */}
      {selectedTag && (
        <div
          ref={popupRef}
          className="fixed z-50 card shadow-xl border border-gray-200 min-w-64 max-w-xs"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-800 text-sm">
              {format(parseISO(selectedTag.datum), 'EEEE, dd. MMMM yyyy', { locale: de })}
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className="text-gray-300 hover:text-gray-600 ml-2"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {selectedTag.list.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <span className={statusBadgeClass(a.status)}>{statusLabel(a.status)}</span>
                <span className="text-sm text-gray-700">{a.mitarbeiter_name}</span>
                {a.bemerkung && (
                  <span className="text-xs text-gray-400">({a.bemerkung})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonatsKarte({ jahr, monatIndex, abwesenheitMap, heute, onTagClick, selectedDatum }) {
  const ersterTag = new Date(jahr, monatIndex, 1);
  const monatsName = format(ersterTag, 'MMMM', { locale: de });
  const tageImMonat = getDaysInMonth(ersterTag);

  // Wochentag des ersten Tags (0=So → umrechnen auf Mo=0)
  let startWochentag = getDay(ersterTag); // 0=So,1=Mo,...,6=Sa
  startWochentag = (startWochentag + 6) % 7; // Mo=0,...,So=6

  const tagNummern = Array.from({ length: tageImMonat }, (_, i) => i + 1);
  const wochentage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 text-sm mb-3 text-center">{monatsName}</h3>

      {/* Wochentag-Header */}
      <div className="grid grid-cols-7 mb-1">
        {wochentage.map(wt => (
          <div key={wt} className="text-center text-xs text-gray-400 font-medium py-0.5">{wt}</div>
        ))}
      </div>

      {/* Tage */}
      <div className="grid grid-cols-7">
        {/* Leerfelder vor dem ersten Tag */}
        {Array.from({ length: startWochentag }, (_, i) => (
          <div key={`leer-${i}`} />
        ))}

        {tagNummern.map(tag => {
          const datum = `${jahr}-${String(monatIndex + 1).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
          const abw = abwesenheitMap[datum] || [];
          const istHeute = datum === heute;
          const istSelected = datum === selectedDatum;

          // Wochentag für Wochenende-Styling
          const tagObj = new Date(jahr, monatIndex, tag);
          const wt = getDay(tagObj);
          const istWochenende = wt === 0 || wt === 6;

          return (
            <div
              key={tag}
              onClick={(e) => onTagClick(datum, abw, e)}
              className={`
                relative flex flex-col items-center py-0.5 rounded cursor-pointer
                ${abw.length > 0 ? 'hover:bg-yellow-50' : ''}
                ${istSelected ? 'bg-yellow-100' : ''}
              `}
              title={abw.length > 0 ? `${abw.length} Abwesenheit(en)` : ''}
            >
              <span className={`
                text-xs w-6 h-6 flex items-center justify-center rounded-full
                ${istHeute ? 'bg-yellow-400 text-gray-900 font-bold' : ''}
                ${!istHeute && istWochenende ? 'text-gray-400' : ''}
                ${!istHeute && !istWochenende ? 'text-gray-700' : ''}
              `}>
                {tag}
              </span>

              {/* Abwesenheits-Punkte */}
              {abw.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {abw.slice(0, 3).map((a, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${STATUS_FARBEN[a.status] || 'bg-gray-400'}`}
                    />
                  ))}
                  {abw.length > 3 && (
                    <span className="text-gray-400" style={{ fontSize: '8px', lineHeight: '6px' }}>
                      +{abw.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monats-Zusammenfassung */}
      <MonatsSummary monatIndex={monatIndex} jahr={jahr} abwesenheitMap={abwesenheitMap} />
    </div>
  );
}

function MonatsSummary({ monatIndex, jahr, abwesenheitMap }) {
  const counts = { krank: 0, urlaub: 0, frei: 0, sonstige: 0 };
  const tage = getDaysInMonth(new Date(jahr, monatIndex, 1));
  for (let t = 1; t <= tage; t++) {
    const datum = `${jahr}-${String(monatIndex + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
    for (const a of (abwesenheitMap[datum] || [])) {
      if (counts[a.status] !== undefined) counts[a.status]++;
    }
  }
  const gesamt = Object.values(counts).reduce((s, v) => s + v, 0);
  if (gesamt === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 flex-wrap">
      {Object.entries(counts).map(([status, count]) =>
        count > 0 ? (
          <span key={status} className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${STATUS_FARBEN[status]}`} />
            {count}
          </span>
        ) : null
      )}
    </div>
  );
}
