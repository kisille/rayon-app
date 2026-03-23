import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, FunnelIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';

const METHODE_FARBE = {
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-orange-100 text-orange-800',
};

const METHODE_LABEL = { POST: 'Erstellt', PUT: 'Geändert', DELETE: 'Gelöscht', PATCH: 'Aktualisiert' };

function pfadLabel(pfad) {
  const map = [
    ['/mitarbeiter', 'Mitarbeiter'],
    ['/rayone', 'Rayon'],
    ['/kompetenzen', 'Kompetenz'],
    ['/monatszuteilungen', 'Monatszuteilung'],
    ['/abwesenheiten', 'Abwesenheit'],
    ['/fahrzeuge', 'Fahrzeug'],
    ['/tagesplan', 'Tagesplan'],
    ['/mitnahme', 'Mitnahmeplanung'],
    ['/dienstplan', 'Dienstplan-Import'],
    ['/benutzer', 'Benutzer'],
  ];
  for (const [key, label] of map) {
    if (pfad.includes(key)) return label;
  }
  return pfad;
}

export default function AuditLog() {
  const [eintraege, setEintraege] = useState([]);
  const [gesamt, setGesamt] = useState(0);
  const [laden, setLaden] = useState(true);
  const [seite, setSeite] = useState(0);
  const [filterBenutzer, setFilterBenutzer] = useState('');
  const [filterMethode, setFilterMethode] = useState('');
  const LIMIT = 50;

  const laden_ = async () => {
    setLaden(true);
    try {
      const { data } = await api.get('/audit-log', { params: { limit: LIMIT, offset: seite * LIMIT } });
      setEintraege(data.eintraege);
      setGesamt(data.gesamt);
    } catch (e) {
      console.error(e);
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => { laden_(); }, [seite]);

  const gefiltriert = eintraege.filter(e => {
    if (filterBenutzer && !e.benutzername.includes(filterBenutzer)) return false;
    if (filterMethode && e.methode !== filterMethode) return false;
    return true;
  });

  const formatZeitstempel = (ts) => {
    if (!ts) return '';
    const d = new Date(ts.replace(' ', 'T') + 'Z');
    return d.toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatDetails = (details) => {
    try {
      const obj = JSON.parse(details);
      const wichtig = Object.entries(obj)
        .filter(([k]) => !['id', 'erstellt_am'].includes(k))
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${String(v).substring(0, 40)}`)
        .join(', ');
      return wichtig || '–';
    } catch {
      return details?.substring(0, 80) || '–';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit-Log</h1>
          <p className="text-gray-500 mt-1">{gesamt} Einträge insgesamt</p>
        </div>
        <button onClick={laden_} className="btn-secondary flex items-center gap-2">
          <ArrowPathIcon className="w-4 h-4" />
          Aktualisieren
        </button>
      </div>

      {/* Filter */}
      <div className="card mb-4 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <input
            className="input w-48"
            placeholder="Benutzer filtern..."
            value={filterBenutzer}
            onChange={e => setFilterBenutzer(e.target.value)}
            autoComplete="off"
          />
          <select className="input w-44" value={filterMethode} onChange={e => setFilterMethode(e.target.value)}>
            <option value="">Alle Aktionen</option>
            <option value="POST">Erstellt (POST)</option>
            <option value="PUT">Geändert (PUT)</option>
            <option value="DELETE">Gelöscht (DELETE)</option>
          </select>
          {(filterBenutzer || filterMethode) && (
            <button onClick={() => { setFilterBenutzer(''); setFilterMethode(''); }} className="text-sm text-gray-500 hover:text-gray-700">
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {laden ? (
        <div className="text-center py-12 text-gray-400">Lade Audit-Log...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Zeitstempel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Benutzer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Aktion</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Bereich</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gefiltriert.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">Keine Einträge gefunden</td>
                  </tr>
                ) : gefiltriert.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {formatZeitstempel(e.zeitstempel)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.benutzername}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${METHODE_FARBE[e.methode] || 'bg-gray-100 text-gray-700'}`}>
                        {METHODE_LABEL[e.methode] || e.methode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pfadLabel(e.pfad)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={e.details}>
                      {formatDetails(e.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {gesamt > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-sm text-gray-500">
                Seite {seite + 1} von {Math.ceil(gesamt / LIMIT)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSeite(s => Math.max(0, s - 1))}
                  disabled={seite === 0}
                  className="btn-secondary py-1 px-3 text-sm disabled:opacity-40"
                >Zurück</button>
                <button
                  onClick={() => setSeite(s => s + 1)}
                  disabled={(seite + 1) * LIMIT >= gesamt}
                  className="btn-secondary py-1 px-3 text-sm disabled:opacity-40"
                >Weiter</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
