import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const CODE_STYLES = {
  K:   'bg-red-100 text-red-800',
  U:   'bg-green-100 text-green-800',
  KUR: 'bg-orange-100 text-orange-800',
  VS:  'bg-purple-100 text-purple-800',
  F:   'bg-purple-100 text-purple-800',
  SA1: 'bg-blue-100 text-blue-800',
  SA2: 'bg-blue-100 text-blue-800',
  SA3: 'bg-blue-100 text-blue-800',
  SA4: 'bg-blue-100 text-blue-800',
  SA5: 'bg-blue-100 text-blue-800',
  SA6: 'bg-blue-100 text-blue-800',
  SA7: 'bg-blue-100 text-blue-800',
  SA8: 'bg-blue-100 text-blue-800',
};

function getCellStyle(code) {
  if (!code) return '';
  const upper = code.toUpperCase();
  if (CODE_STYLES[upper]) return CODE_STYLES[upper];
  if (/^\d+$/.test(code)) return 'bg-yellow-50 text-yellow-900';
  return '';
}

function getDaysInMonth(monat) {
  const [year, month] = monat.split('-').map(Number);
  const days = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    days.push(date.toISOString().substring(0, 10));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function statusToCode(status, bemerkung) {
  if (status === 'krank') return 'K';
  if (status === 'urlaub') return 'U';
  if (bemerkung) return bemerkung;
  if (status === 'frei') return 'VS';
  return 'S';
}

export default function DienstplanGrid() {
  const currentMonat = new Date().toISOString().substring(0, 7);
  const [monat, setMonat] = useState(currentMonat);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [grid, setGrid] = useState({});
  const [ersetzen, setErsetzen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ladeDaten, setLadeDaten] = useState(false);
  const [result, setResult] = useState(null);

  const days = getDaysInMonth(monat);

  useEffect(() => {
    ladeAlles();
  }, [monat]);

  const ladeAlles = async () => {
    setLadeDaten(true);
    setResult(null);
    try {
      const [maRes, abwRes, zutRes, tagesRes] = await Promise.all([
        api.get('/mitarbeiter'),
        api.get(`/abwesenheiten?von=${monat}-01&bis=${monat}-31`),
        api.get(`/monatszuteilungen?monat=${monat}`),
        api.get(`/tagesplan-zuteilungen?von=${monat}-01&bis=${monat}-31`),
      ]);

      const maListe = maRes.data.filter(m => m.aktiv !== 0);
      setMitarbeiter(maListe);

      const monthDays = getDaysInMonth(monat);
      const neuesGrid = {};

      for (const ma of maListe) {
        neuesGrid[ma.id] = {};
      }

      // Fill rayon numbers for all working days
      for (const z of zutRes.data) {
        if (!z.ist_teilzuteilung && neuesGrid[z.mitarbeiter_id] !== undefined) {
          const rayonCode = String(z.rayon_nummer).padStart(4, '0');
          for (const day of monthDays) {
            const d = new Date(day + 'T12:00:00');
            if (d.getDay() !== 0) {
              neuesGrid[z.mitarbeiter_id][day] = rayonCode;
            }
          }
        }
      }

      // Overwrite with daily tagesplan assignments
      for (const t of tagesRes.data) {
        if (neuesGrid[t.mitarbeiter_id] !== undefined) {
          neuesGrid[t.mitarbeiter_id][t.datum] = String(t.rayon_nummer).padStart(4, '0');
        }
      }

      // Overwrite with absences
      for (const abw of abwRes.data) {
        if (neuesGrid[abw.mitarbeiter_id] !== undefined) {
          neuesGrid[abw.mitarbeiter_id][abw.datum] = statusToCode(abw.status, abw.bemerkung);
        }
      }

      setGrid(neuesGrid);
    } catch (e) {
      console.error(e);
    }
    setLadeDaten(false);
  };

  const handleCellChange = useCallback((maId, datum, value) => {
    setGrid(prev => ({
      ...prev,
      [maId]: { ...prev[maId], [datum]: value.toUpperCase() },
    }));
  }, []);

  const handleImport = async () => {
    setLoading(true);
    setResult(null);

    const eintraege = [];
    for (const ma of mitarbeiter) {
      const maGrid = grid[ma.id] || {};
      for (const datum of days) {
        const code = (maGrid[datum] || '').trim();
        if (code) {
          eintraege.push({ pnr: ma.personalnummer, datum, code });
        }
      }
    }

    try {
      const resp = await api.post('/dienstplan/grid-import', { monat, eintraege, ersetzen });
      setResult({ success: true, ...resp.data });
    } catch (e) {
      setResult({ success: false, fehler: e.response?.data?.fehler || e.message });
    }
    setLoading(false);
  };

  const monatLabel = new Date(monat + '-15').toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Grid</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Codes: <span className="font-mono bg-red-100 text-red-800 px-1 rounded">K</span> Krank &nbsp;
            <span className="font-mono bg-green-100 text-green-800 px-1 rounded">U</span> Urlaub &nbsp;
            <span className="font-mono bg-orange-100 text-orange-800 px-1 rounded">Kur</span> &nbsp;
            <span className="font-mono bg-blue-100 text-blue-800 px-1 rounded">SA1–SA8</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="month"
            value={monat}
            onChange={e => setMonat(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ersetzen}
              onChange={e => setErsetzen(e.target.checked)}
              className="w-4 h-4 text-yellow-500"
            />
            Bestehende Daten ersetzen
          </label>
          <button
            onClick={handleImport}
            disabled={loading || ladeDaten}
            className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Importiere…' : `${monatLabel} importieren`}
          </button>
        </div>
      </div>

      {result && (
        <div className={`mb-4 rounded-lg border p-4 text-sm ${result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {result.success
            ? `${result.importiertAbwesenheiten} Abwesenheiten und ${result.importiertZuteilungen} Rayon-Zuteilungen importiert für ${monatLabel}`
            : result.fehler}
          {result.success && Array.isArray(result.fehler) && result.fehler.length > 0 && (
            <div className="mt-2 text-xs text-orange-700 border-t border-orange-200 pt-2">
              {result.fehler.map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </div>
      )}

      {ladeDaten ? (
        <div className="text-center py-12 text-gray-400">Lade Daten…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-semibold text-gray-600 border-r border-gray-200" style={{ width: 180, minWidth: 180 }}>
                    Mitarbeiter
                  </th>
                  {days.map(day => {
                    const d = new Date(day + 'T12:00:00');
                    const dayNum = d.getDate();
                    const dayName = d.toLocaleDateString('de-AT', { weekday: 'short' });
                    const isSun = d.getDay() === 0;
                    return (
                      <th
                        key={day}
                        style={{ width: 44, minWidth: 44 }}
                        className={`py-1 text-center font-medium ${isSun ? 'text-red-400 bg-red-50' : 'text-gray-500'}`}
                      >
                        <div>{dayNum}</div>
                        <div className="text-[9px] font-normal">{dayName}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {mitarbeiter.map((ma, i) => (
                  <tr key={ma.id} className={i % 2 === 0 ? '' : 'bg-gray-50/40'}>
                    <td
                      className="sticky left-0 z-10 px-3 py-1 border-r border-gray-100"
                      style={{ width: 180, minWidth: 180, backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}
                    >
                      <div className="font-medium text-gray-700 truncate" title={ma.name}>{ma.name}</div>
                      <div className="text-gray-400 text-[10px]">{ma.personalnummer}</div>
                    </td>
                    {days.map(datum => {
                      const code = grid[ma.id]?.[datum] || '';
                      const d = new Date(datum + 'T12:00:00');
                      const isSun = d.getDay() === 0;
                      return (
                        <td key={datum} className={`p-0 ${isSun ? 'bg-red-50/30' : ''}`} style={{ width: 44 }}>
                          <input
                            type="text"
                            maxLength={5}
                            value={code}
                            onChange={e => handleCellChange(ma.id, datum, e.target.value)}
                            autoComplete="off"
                            readOnly={isSun}
                            className={`w-full h-[30px] text-center text-[11px] font-mono border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-yellow-400 ${getCellStyle(code)} ${isSun ? 'opacity-40 cursor-default bg-gray-100' : ''}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
