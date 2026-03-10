import React, { useState, useEffect } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';

export default function Statistik() {
  const [statistik, setStatistik] = useState([]);
  const [laden, setLaden] = useState(true);
  const [monat, setMonat] = useState(new Date().toISOString().substring(0, 7));
  const [sortierung, setSortierung] = useState('monat');

  const laden_ = async () => {
    setLaden(true);
    const { data } = await api.get('/statistik', {
      params: { monat, jahr: monat.substring(0, 4) }
    });
    setStatistik(data);
    setLaden(false);
  };

  useEffect(() => { laden_(); }, [monat]);

  const sortiert = [...statistik].sort((a, b) => {
    if (sortierung === 'monat') return b.einsätze_monat - a.einsätze_monat;
    if (sortierung === 'jahr') return b.einsätze_jahr - a.einsätze_jahr;
    return a.name.localeCompare(b.name);
  });

  const maxMonat = Math.max(...statistik.map(s => s.einsätze_monat), 1);
  const maxJahr = Math.max(...statistik.map(s => s.einsätze_jahr), 1);

  if (laden) return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fairness-Statistik</h1>
          <p className="text-gray-500 mt-1">Mitnahmeeinsätze pro Mitarbeiter</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="input w-auto"
            value={monat}
            onChange={(e) => setMonat(e.target.value)}
          />
          <select
            className="input w-auto"
            value={sortierung}
            onChange={(e) => setSortierung(e.target.value)}
          >
            <option value="monat">Sortierung: Diesen Monat</option>
            <option value="jahr">Sortierung: Dieses Jahr</option>
            <option value="name">Sortierung: Name</option>
          </select>
        </div>
      </div>

      {statistik.every(s => s.einsätze_monat === 0 && s.einsätze_jahr === 0) && (
        <div className="card text-center py-8 mb-6 text-gray-400">
          <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Noch keine Mitnahmeeinsätze erfasst.</p>
          <p className="text-sm mt-1">Einsätze werden gespeichert wenn Sie Tagespläne über die Mitnahmeplanung bestätigen.</p>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mitarbeiter</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monat</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Jahr</th>
              <th className="px-4 py-3 hidden md:table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {sortiert.map((s, i) => (
              <tr key={s.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-yellow-700 font-bold text-xs">{s.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">Nr. {s.personalnummer}</div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    s.einsätze_monat === 0 ? 'bg-gray-100 text-gray-400' :
                    s.einsätze_monat <= 2 ? 'bg-green-100 text-green-700' :
                    s.einsätze_monat <= 5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {s.einsätze_monat}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-semibold ${
                    s.einsätze_jahr === 0 ? 'text-gray-400' : 'text-gray-800'
                  }`}>
                    {s.einsätze_jahr}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="w-32">
                    <div className="text-xs text-gray-400 mb-0.5">Monat</div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{ width: `${(s.einsätze_monat / maxMonat) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Erklärung */}
      <div className="mt-4 text-xs text-gray-400 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div>
          0–2 Einsätze
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300"></div>
          3–5 Einsätze
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div>
          6+ Einsätze
        </div>
      </div>
    </div>
  );
}
