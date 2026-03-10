import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, MapIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';

const PRIORITÄT_BADGE = {
  hoch:   'bg-red-100 text-red-700',
  normal: 'bg-yellow-100 text-yellow-700',
  wenig:  'bg-gray-100 text-gray-500',
};
const PRIORITÄT_LABEL = { hoch: 'Hoch', normal: 'Normal', wenig: 'Wenig' };

export default function Rayone() {
  const [rayone, setRayone] = useState([]);
  const [suche, setSuche] = useState('');
  const [laden, setLaden] = useState(true);

  const monat = new Date().toISOString().substring(0, 7);

  const ladeData = useCallback(() => {
    api.get('/rayone', { params: { monat } }).then(({ data }) => {
      setRayone(data);
      setLaden(false);
    });
  }, []);

  useEffect(() => {
    ladeData();
    // Auto-refresh wenn Tab/Fenster wieder aktiv wird
    const onVisible = () => { if (document.visibilityState === 'visible') ladeData(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ladeData);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ladeData);
    };
  }, [ladeData]);

  const gefilterte = rayone.filter(r =>
    r.nummer.toString().includes(suche) ||
    r.bezeichnung.toLowerCase().includes(suche.toLowerCase()) ||
    (r.gebiet || '').toLowerCase().includes(suche.toLowerCase())
  );

  if (laden) return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rayone</h1>
          <p className="text-gray-500 mt-1">Alle {rayone.length} Zustellbezirke</p>
        </div>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Nummer, Bezeichnung oder Gebiet suchen..."
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {gefilterte.map((r) => {
          const prio = r.priorität || 'normal';
          return (
            <Link
              key={r.id}
              to={`/rayone/${r.id}`}
              className="card hover:shadow-md transition-shadow group p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapIcon className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Titel + Priorität oben rechts */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-gray-900 group-hover:text-yellow-700">
                      {r.bezeichnung}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITÄT_BADGE[prio] || PRIORITÄT_BADGE.normal}`}>
                      {PRIORITÄT_LABEL[prio] || prio}
                    </span>
                  </div>
                  {r.gebiet && <div className="text-xs text-gray-500 mt-0.5">{r.gebiet}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.hat_tagesplan_heute && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Heute</span>
                    )}
                    {r.aktuelle_besetzung && r.aktuelle_besetzung.length > 0 ? (
                      r.aktuelle_besetzung.map(b => (
                        <span key={b.mitarbeiter_id} className={`badge-stamm ${b.ist_teilzuteilung ? 'opacity-75' : ''}`}>
                          {b.mitarbeiter_name}
                          {b.ist_teilzuteilung ? (
                            <span className="ml-1 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">Teil</span>
                          ) : null}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">Nicht besetzt</span>
                    )}
                    {r.anzahl_mitarbeiter > 0 && (
                      <span className="text-xs text-gray-400">{r.anzahl_mitarbeiter} kennen diesen Rayon</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {gefilterte.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <MapIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Keine Rayone gefunden</p>
          </div>
        )}
      </div>
    </div>
  );
}
