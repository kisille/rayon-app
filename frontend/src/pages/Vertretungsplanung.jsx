import React, { useState, useEffect } from 'react';
import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { heuteDatum, formatDatumLang, kompetenzLabel } from '../utils/helpers.js';

export default function Vertretungsplanung() {
  const [datum, setDatum] = useState(heuteDatum());
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [ausgewählteAusfälle, setAusgewählteAusfälle] = useState([]);
  const [vertretungsplan, setVertretungsplan] = useState(null);
  const [berechnet, setBerechnet] = useState(false);
  const [berechnung, setBerechnung] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [abwesenheiten, setAbwesenheiten] = useState([]);

  useEffect(() => {
    api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data));
  }, []);

  useEffect(() => {
    setBerechnet(false);
    setVertretungsplan(null);
    setGespeichert(false);
    // Bereits eingetragene Abwesenheiten laden
    api.get('/abwesenheiten', { params: { datum } }).then(({ data }) => {
      const ausfälle = data.filter(a => a.status !== 'anwesend');
      setAbwesenheiten(ausfälle);
      // Automatisch als Ausfälle vorauswählen
      setAusgewählteAusfälle(ausfälle.map(a => a.mitarbeiter_id));
    });
  }, [datum]);

  const toggleAusfall = (mitarbeiterId) => {
    setAusgewählteAusfälle(prev =>
      prev.includes(mitarbeiterId)
        ? prev.filter(id => id !== mitarbeiterId)
        : [...prev, mitarbeiterId]
    );
    setBerechnet(false);
    setVertretungsplan(null);
  };

  const handleBerechnen = async () => {
    if (ausgewählteAusfälle.length === 0) return;
    setBerechnung(true);
    try {
      const { data } = await api.post('/vertretung/berechnen', {
        datum,
        ausfälle: ausgewählteAusfälle.map(id => ({ mitarbeiter_id: id })),
      });
      setVertretungsplan(data.plan);
      setBerechnet(true);
    } finally {
      setBerechnung(false);
    }
  };

  const handleSpeichern = async () => {
    if (!vertretungsplan) return;

    const einträge = vertretungsplan.map(p => ({
      rayon_id: p.rayon_id,
      mitarbeiter_id: p.vertreter_id,
      ist_vertretung: true,
      vertritt_mitarbeiter_id: p.ausgefallener_mitarbeiter_id,
    })).filter(e => e.mitarbeiter_id);

    await api.post(`/tagesplan/${datum}/speichern`, { einträge });
    setGespeichert(true);
  };

  const mitarbeiterMitStatus = mitarbeiter.map(m => {
    const abwesenheit = abwesenheiten.find(a => a.mitarbeiter_id === m.id);
    return { ...m, abwesenheit, istAusgefallen: ausgewählteAusfälle.includes(m.id) };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vertretungsplanung</h1>
          <p className="text-gray-500 mt-1">Optimale Vertretungen automatisch berechnen</p>
        </div>
        <input
          type="date"
          className="input w-auto"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Seite: Ausfälle auswählen */}
        <div>
          <div className="card mb-4">
            <h2 className="font-semibold text-gray-900 mb-1">
              Schritt 1: Ausfälle markieren
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Wählen Sie alle Mitarbeiter aus, die am {formatDatumLang(datum)} fehlen.
              Bereits eingetragene Abwesenheiten sind vorausgewählt.
            </p>

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {mitarbeiterMitStatus.map((m) => (
                <div
                  key={m.id}
                  onClick={() => toggleAusfall(m.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    m.istAusgefallen
                      ? 'bg-red-50 border-2 border-red-300'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      m.istAusgefallen ? 'bg-red-500 border-red-500' : 'border-gray-300'
                    }`}>
                      {m.istAusgefallen && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{m.name}</div>
                      {m.stamm_rayon_nummer && (
                        <div className="text-xs text-gray-500">Rayon {m.stamm_rayon_nummer}</div>
                      )}
                    </div>
                  </div>
                  {m.abwesenheit && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.abwesenheit.status === 'krank' ? 'bg-red-100 text-red-700' :
                      m.abwesenheit.status === 'urlaub' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {m.abwesenheit.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {ausgewählteAusfälle.length} Ausfall{ausgewählteAusfälle.length !== 1 ? 'fälle' : ''} ausgewählt
            </span>
            <button
              onClick={handleBerechnen}
              disabled={ausgewählteAusfälle.length === 0 || berechnung}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SparklesIcon className="w-4 h-4" />
              {berechnung ? 'Berechne...' : 'Vertretung berechnen'}
            </button>
          </div>
        </div>

        {/* Rechte Seite: Ergebnis */}
        <div>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">
              Schritt 2: Vertretungsplan
            </h2>

            {!berechnet && (
              <div className="text-center py-12 text-gray-400">
                <ArrowsRightLeftIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">
                  Wählen Sie die Ausfälle aus und klicken Sie auf "Vertretung berechnen"
                </p>
              </div>
            )}

            {berechnet && vertretungsplan && (
              <div className="space-y-3">
                {vertretungsplan.map((p, i) => (
                  <VertretungsEintrag key={i} eintrag={p} />
                ))}

                <div className="mt-6 pt-4 border-t border-gray-100">
                  {gespeichert ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircleIcon className="w-5 h-5" />
                      Tagesplan wurde gespeichert!
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        Plan überprüfen und bestätigen:
                      </p>
                      <button onClick={handleSpeichern} className="btn-primary">
                        Plan bestätigen & speichern
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Legende */}
          {berechnet && (
            <div className="mt-4 card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kompetenz-Legende</h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-green-100 text-green-800 rounded text-center font-bold text-xs leading-4">2</span>
                  Sehr gut – kann Rayon problemlos übernehmen
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-orange-100 text-orange-800 rounded text-center font-bold text-xs leading-4">3</span>
                  Geht so – nur im Notfall
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold">↪</span>
                  Kettenvertretung
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VertretungsEintrag({ eintrag }) {
  const hatVertreter = !!eintrag.vertreter_id;

  return (
    <div className={`rounded-lg border-2 p-3 ${
      !hatVertreter ? 'border-red-200 bg-red-50' :
      eintrag.ist_kettenvertretung ? 'border-blue-200 bg-blue-50' :
      eintrag.kompetenz_level === 2 ? 'border-green-200 bg-green-50' :
      'border-orange-200 bg-orange-50'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-sm text-gray-900">
            {eintrag.rayon_nummer} – {eintrag.rayon_bezeichnung}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Ausgefallen: <span className="font-medium text-red-600">{eintrag.ausgefallener_name}</span>
          </div>
        </div>
        {eintrag.kompetenz_level && (
          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
            eintrag.kompetenz_level === 2
              ? 'bg-green-200 text-green-800'
              : 'bg-orange-200 text-orange-800'
          }`}>
            L{eintrag.kompetenz_level}
          </span>
        )}
      </div>

      {hatVertreter ? (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="font-semibold text-sm text-gray-900">{eintrag.vertreter_name}</span>
            <span className="text-xs text-gray-500">übernimmt den Rayon</span>
          </div>

          {eintrag.ist_kettenvertretung && eintrag.kette && (
            <div className="mt-1 ml-5 text-xs text-blue-700 flex items-center gap-1">
              <span>↪</span>
              <span className="font-medium">{eintrag.kette.kandidatB_name}</span>
              <span>übernimmt dann Rayon von {eintrag.vertreter_name}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-red-600">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">Kein geeigneter Vertreter verfügbar!</span>
        </div>
      )}
    </div>
  );
}
