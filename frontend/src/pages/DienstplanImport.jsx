import React, { useState } from 'react';
import api from '../utils/api';

// Vorgeladene Daten aus Dienstplan März 2026 (abgelesen aus Foto, gerundet auf 10er)
const MAERZ_2026 = `# Dienstplan März 2026 – Rayon-Zuteilungen
# Format: PNR;Rayon  (Kommentare mit # werden ignoriert)
418649;9050
342962;0010
401363;0040
86189;0130
339785;0130
378701;0150
106981;0150
425017;0090
417902;0140
418207;0160
416590;9190
377128;9150
423521;0100
369399;0040
400569;0160
422591;9020
90023882;9030
90022756;9060
333721;9060
338170;9070
230596;9080
359852;9100
26402;9110
354319;9160
422015;9180
422042;9180
419119;9260
413946;0060
424211;9200
355431;9210
19364;9220
345439;9230
334291;9120
415106;9240
418217;9140
425480;0170
425885;0020
90033401;9130
90020590;6030
381792;6080
417921;6010
422486;6060
422904;6010
424137;6050
359973;6220
407009;6210
421468;6210`;

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
  const [monat, setMonat] = useState('2026-03');
  const [csvText, setCsvText] = useState(MAERZ_2026);
  const [preview, setPreview] = useState(null);
  const [ersetzen, setErsetzen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePreview = () => {
    const { entries, parseErrors } = parseCSV(csvText);
    setPreview({ entries, parseErrors });
    setResult(null);
  };

  const handleImport = async () => {
    if (!preview) return;
    setLoading(true);
    setResult(null);
    try {
      const resp = await api.post('/dienstplan/import', {
        monat,
        eintraege: preview.entries,
        ersetzen,
      });
      setResult({ success: true, ...resp.data });
    } catch (e) {
      setResult({ success: false, fehler: e.response?.data?.fehler || e.message });
    }
    setLoading(false);
  };

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
            <input
              type="month"
              value={monat}
              onChange={e => setMonat(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
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
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-medium text-gray-700">
            Zuteilungen (PNR;Rayon je Zeile)
          </label>
          <button
            onClick={() => setCsvText(MAERZ_2026)}
            className="text-xs text-yellow-600 hover:text-yellow-800 underline"
          >
            März 2026 laden
          </button>
        </div>
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          rows={16}
          className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          placeholder="# PNR;Rayon&#10;418649;9050&#10;342962;0010"
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={handlePreview}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Vorschau prüfen
          </button>
        </div>
      </div>

      {/* Vorschau */}
      {preview && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Vorschau – {preview.entries.length} Einträge
            </h2>
            <button
              onClick={handleImport}
              disabled={loading || preview.entries.length === 0}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? 'Importiere…' : `${preview.entries.length} Einträge importieren`}
            </button>
          </div>

          {preview.parseErrors.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {preview.parseErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">PNR</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Rayon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.entries.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-700">{e.pnr}</td>
                    <td className="px-3 py-1.5">
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-mono">
                        {String(e.rayon_nummer).padStart(4, '0')}
                      </span>
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
                {result.importiert} Zuteilungen erfolgreich importiert für {monat}
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
