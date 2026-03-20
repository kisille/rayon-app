import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, MapIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';

const PRIORITÄT_BADGE = {
  hoch:   'bg-red-100 text-red-700',
  normal: 'bg-yellow-100 text-yellow-700',
  wenig:  'bg-gray-100 text-gray-500',
};
const PRIORITÄT_LABEL = { hoch: 'Hoch', normal: 'Normal', wenig: 'Wenig' };

function formatRayonNr(nummer) {
  return String(nummer).padStart(4, '0');
}

export default function Rayone() {
  const [rayone, setRayone] = useState([]);
  const [suche, setSuche] = useState('');
  const [laden, setLaden] = useState(true);
  const [modalOffen, setModalOffen] = useState(false);
  const [formular, setFormular] = useState({ nummer: '', bezeichnung: '', gebiet: '', priorität: 'normal' });
  const [fehler, setFehler] = useState('');

  const monat = new Date().toISOString().substring(0, 7);

  const ladeData = useCallback(() => {
    api.get('/rayone', { params: { monat } }).then(({ data }) => {
      setRayone(data);
      setLaden(false);
    });
  }, []);

  useEffect(() => {
    ladeData();
    const onVisible = () => { if (document.visibilityState === 'visible') ladeData(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ladeData);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ladeData);
    };
  }, [ladeData]);

  const gefilterte = rayone.filter(r =>
    formatRayonNr(r.nummer).includes(suche) ||
    r.bezeichnung.toLowerCase().includes(suche.toLowerCase()) ||
    (r.gebiet || '').toLowerCase().includes(suche.toLowerCase())
  );

  const öffneNeu = () => {
    setFormular({ nummer: '', bezeichnung: '', gebiet: '', priorität: 'normal' });
    setFehler('');
    setModalOffen(true);
  };

  const erstellen = async (e) => {
    e.preventDefault();
    setFehler('');
    try {
      await api.post('/rayone', {
        nummer: Number(formular.nummer),
        bezeichnung: formular.bezeichnung || `Rayon ${String(formular.nummer).padStart(4, '0')}`,
        gebiet: formular.gebiet || null,
        priorität: formular.priorität,
      });
      setModalOffen(false);
      ladeData();
    } catch (err) {
      setFehler(err.response?.data?.fehler || 'Fehler beim Erstellen');
    }
  };

  const löschen = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Rayon wirklich deaktivieren?')) return;
    await api.delete(`/rayone/${id}`);
    ladeData();
  };

  if (laden) return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rayone</h1>
          <p className="text-gray-500 mt-1">Alle {rayone.length} Zustellbezirke</p>
        </div>
        <button onClick={öffneNeu} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Neuer Rayon
        </button>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Nummer, Bezeichnung oder Gebiet suchen..."
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          autoComplete="new-password"
          readOnly
          onFocus={e => { e.target.readOnly = false; }}
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-gray-900 group-hover:text-yellow-700">
                      {r.bezeichnung}
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">{formatRayonNr(r.nummer)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITÄT_BADGE[prio] || PRIORITÄT_BADGE.normal}`}>
                        {PRIORITÄT_LABEL[prio] || prio}
                      </span>
                      <button
                        onClick={(e) => löschen(e, r.id)}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Rayon entfernen"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

      {/* Modal: Neuer Rayon */}
      {modalOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOffen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Neuer Rayon</h2>
              <button onClick={() => setModalOffen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form autoComplete="off" onSubmit={erstellen} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zustellbezirk-Nummer *</label>
                <input
                  type="number"
                  required
                  value={formular.nummer}
                  onChange={e => setFormular(f => ({ ...f, nummer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. 9010"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-400 mt-1">Vierstellige Bezirksnummer (z.B. 0010 → 10, 9010 → 9010)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
                <input
                  type="text"
                  value={formular.bezeichnung}
                  onChange={e => setFormular(f => ({ ...f, bezeichnung: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder={formular.nummer ? `Rayon ${String(formular.nummer).padStart(4, '0')}` : 'Automatisch aus Nummer'}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gebiet / Beschreibung</label>
                <input
                  type="text"
                  value={formular.gebiet}
                  onChange={e => setFormular(f => ({ ...f, gebiet: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. Stadtmitte, Außenbezirk..."
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
                <select
                  value={formular.priorität}
                  onChange={e => setFormular(f => ({ ...f, priorität: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                >
                  <option value="hoch">Hoch</option>
                  <option value="normal">Normal</option>
                  <option value="wenig">Wenig</option>
                </select>
              </div>

              {fehler && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{fehler}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOffen(false)} className="btn-secondary flex-1">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
