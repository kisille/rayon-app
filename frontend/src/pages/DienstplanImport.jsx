import React, { useState } from 'react';
import api from '../utils/api';

function parseCSV(text) {
  const entries = [];
  const parseErrors = [];
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/[;,\t]/);
    if (parts.length < 2) { parseErrors.push(`Ungültige Zeile: "${line}"`); continue; }
    const pnr = parts[0].trim();
    const rawNum = parts[1].trim().replace(/^0+/, '') || '0';
    const num = parseInt(rawNum);
    if (isNaN(num)) { parseErrors.push(`Ungültige Rayon-Nummer in: "${line}"`); continue; }
    // Auf 10er runden
    const rayon_nummer = Math.round(num / 10) * 10;
    entries.push({ pnr, rayon_nummer });
  }
  return { entries, parseErrors };
}

export default function DienstplanImport() {
  const monat = new Date().toISOString().substring(0, 7);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [editableEntries, setEditableEntries] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [ersetzen, setErsetzen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePreview = () => {
    const { entries, parseErrors: errors } = parseCSV(csvText);
    setPreview(true);
    setEditableEntries(entries.map(e => ({ ...e })));
    setParseErrors(errors);
    setResult(null);
  };

  const handleEntryChange = (i, field, value) => {
    setEditableEntries(prev => prev.map((e, idx) =>
      idx === i ? { ...e, [field]: field === 'rayon_nummer' ? (parseInt(value) || 0) : value } : e
    ));
  };

  const handleEntryRemove = (i) => {
    setEditableEntries(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleImport = async () => {
    if (!preview) return;
    setLoading(true);
    setResult(null);
    try {
      const resp = await api.post('/dienstplan/import', {
        monat,
        eintraege: editableEntries,
        ersetzen,
      });
      setResult({ success: true, ...resp.data });
    } catch (e) {
      setResult({ success: false, fehler: e.response?.data?.fehler || e.message });
    }
    setLoading(false);
  };

  const monatLabel = new Date().toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Import</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Monatliche Rayon-Zuteilungen aus dem Dienstplan importieren.<br />
          Format pro Zeile: <code className="bg-gray-100 px-1 rounded">PNR;Rayonnummer</code>
        </p>
      </div>

      {/* Monat + Optionen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <div className="flex flex-wrap gap-6 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monat</label>
            <span className="inline-block bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">
              {monatLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="ersetzen"
              checked={ersetzen}
              onChange={e => setErsetzen(e.target.checked)}
              className="w-4 h-4 text-yellow-500"
            />
            <label htmlFor="ersetzen" className="text-sm text-gray-700">
              Bestehende Zuteilungen ersetzen
            </label>
          </div>
        </div>
      </div>

      {/* CSV-Editor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Zuteilungen (PNR;Rayon je Zeile)
        </label>
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          rows={6}
          className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          placeholder="418649;9050&#10;342962;0010&#10;401363;0040"
          autoComplete="new-password"
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={handlePreview}
            disabled={!csvText.trim()}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Vorschau prüfen
          </button>
        </div>
      </div>

      {/* Vorschau – editierbar */}
      {preview && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Vorschau – {editableEntries.length} Einträge
              <span className="ml-2 text-xs font-normal text-gray-400">(bearbeitbar vor Import)</span>
            </h2>
            <button
              onClick={handleImport}
              disabled={loading || editableEntries.length === 0}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? 'Importiere…' : `${editableEntries.length} Einträge importieren`}
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {parseErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">PNR</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Rayon</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editableEntries.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={e.pnr}
                        onChange={ev => handleEntryChange(i, 'pnr', ev.target.value)}
                        autoComplete="new-password"
                        className="font-mono text-gray-700 border border-transparent hover:border-gray-300 focus:border-yellow-400 focus:outline-none rounded px-1 py-0.5 w-28 bg-transparent"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={e.rayon_nummer}
                        onChange={ev => handleEntryChange(i, 'rayon_nummer', ev.target.value)}
                        autoComplete="new-password"
                        className="font-mono text-yellow-800 bg-yellow-50 border border-transparent hover:border-yellow-300 focus:border-yellow-400 focus:outline-none rounded px-2 py-0.5 w-20"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => handleEntryRemove(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                        title="Eintrag entfernen"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ergebnis */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {result.success ? (
            <>
              <div className="text-green-800 font-semibold">
                {result.importiert} Zuteilungen erfolgreich importiert für {monatLabel}
              </div>
              {result.fehler?.length > 0 && (
                <div className="mt-2 text-sm text-orange-700">
                  <div className="font-medium">Warnungen:</div>
                  {result.fehler.map((f, i) => <div key={i} className="text-xs mt-0.5">{f}</div>)}
                </div>
              )}
            </>
          ) : (
            <div className="text-red-800">{result.fehler}</div>
          )}
        </div>
      )}
    </div>
  );
}
