import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { formatDatum, statusLabel, statusBadgeClass, heuteDatum } from '../utils/helpers.js';
import { Modal } from './Mitarbeiter.jsx';

export default function Abwesenheiten() {
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [von, setVon] = useState(heuteDatum());
  const [bis, setBis] = useState(heuteDatum());
  const [laden, setLaden] = useState(true);
  const [zeigFormular, setZeigFormular] = useState(false);
  const [bearbeiteEintrag, setBearbeiteEintrag] = useState(null); // { mitarbeiter_id, datum, status, bemerkung }
  const [formDaten, setFormDaten] = useState({
    mitarbeiter_id: '',
    von: heuteDatum(),
    bis: heuteDatum(),
    status: 'krank',
    bemerkung: '',
  });

  const laden_ = async () => {
    const [abRes, mRes] = await Promise.all([
      api.get('/abwesenheiten', { params: { von, bis } }),
      api.get('/mitarbeiter'),
    ]);
    setAbwesenheiten(abRes.data);
    setMitarbeiter(mRes.data);
    setLaden(false);
  };

  useEffect(() => { laden_(); }, [von, bis]);

  const handleEintragen = async (e) => {
    e.preventDefault();
    // Datumsbereich zu Array expandieren
    const daten = [];
    const start = new Date(formDaten.von);
    const ende = new Date(formDaten.bis);
    for (let d = new Date(start); d <= ende; d.setDate(d.getDate() + 1)) {
      daten.push(d.toISOString().split('T')[0]);
    }

    await api.post('/abwesenheiten', {
      mitarbeiter_id: parseInt(formDaten.mitarbeiter_id),
      datum: daten.length === 1 ? daten[0] : daten,
      status: formDaten.status,
      bemerkung: formDaten.bemerkung,
    });

    schliesseFormular();
    await laden_();
  };

  const handleLöschen = async (mitarbeiterId, datum) => {
    await api.delete(`/abwesenheiten/${mitarbeiterId}/${datum}`);
    await laden_();
  };

  const öffneBearbeiten = (a) => {
    setBearbeiteEintrag(a);
    setFormDaten({
      mitarbeiter_id: String(a.mitarbeiter_id),
      von: a.datum,
      bis: a.datum,
      status: a.status,
      bemerkung: a.bemerkung || '',
    });
    setZeigFormular(true);
  };

  const schliesseFormular = () => {
    setZeigFormular(false);
    setBearbeiteEintrag(null);
    setFormDaten({ mitarbeiter_id: '', von: heuteDatum(), bis: heuteDatum(), status: 'krank', bemerkung: '' });
  };

  // Abwesenheiten nach Datum gruppieren
  const nachDatum = {};
  for (const a of abwesenheiten) {
    if (!nachDatum[a.datum]) nachDatum[a.datum] = [];
    nachDatum[a.datum].push(a);
  }
  const sortedDaten = Object.keys(nachDatum).sort();

  if (laden) return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abwesenheiten</h1>
          <p className="text-gray-500 mt-1">Urlaub, Krankheit und weitere Abwesenheiten</p>
        </div>
        <button onClick={() => { setBearbeiteEintrag(null); setZeigFormular(true); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Eintragen
        </button>
      </div>

      {/* Zeitraum-Filter */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="label text-xs">Von</label>
            <input type="date" className="input" value={von} onChange={(e) => setVon(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Bis</label>
            <input type="date" className="input" value={bis} onChange={(e) => setBis(e.target.value)} />
          </div>
          <button
            className="btn-secondary mt-5"
            onClick={() => { setVon(heuteDatum()); setBis(heuteDatum()); }}
          >
            Heute
          </button>
          <button
            className="btn-secondary mt-5"
            onClick={() => {
              const heute = new Date();
              const monatsStart = new Date(heute.getFullYear(), heute.getMonth(), 1);
              const monatsEnde = new Date(heute.getFullYear(), heute.getMonth() + 1, 0);
              setVon(monatsStart.toISOString().split('T')[0]);
              setBis(monatsEnde.toISOString().split('T')[0]);
            }}
          >
            Dieser Monat
          </button>
        </div>
      </div>

      {/* Abwesenheiten-Liste */}
      {sortedDaten.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          Keine Abwesenheiten im gewählten Zeitraum
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDaten.map(datum => (
            <div key={datum} className="card">
              <h3 className="font-semibold text-gray-700 mb-3">{formatDatum(datum)}</h3>
              <div className="space-y-2">
                {nachDatum[datum].map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={statusBadgeClass(a.status)}>{statusLabel(a.status)}</span>
                      <span className="font-medium text-sm">{a.mitarbeiter_name}</span>
                      {a.bemerkung && (
                        <span className="text-gray-400 text-xs">({a.bemerkung})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => öffneBearbeiten(a)}
                        className="text-gray-300 hover:text-yellow-500 transition-colors"
                        title="Bearbeiten"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleLöschen(a.mitarbeiter_id, a.datum)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Löschen"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formular-Modal */}
      {zeigFormular && (
        <Modal title={bearbeiteEintrag ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'} onClose={schliesseFormular}>
          <form onSubmit={handleEintragen} className="space-y-4">
            <div>
              <label className="label">Mitarbeiter *</label>
              {bearbeiteEintrag ? (
                <div className="input bg-gray-50 text-gray-600 text-sm">
                  {mitarbeiter.find(m => m.id === bearbeiteEintrag.mitarbeiter_id)?.name || bearbeiteEintrag.mitarbeiter_name}
                </div>
              ) : (
                <select className="input" required value={formDaten.mitarbeiter_id}
                  onChange={(e) => setFormDaten({ ...formDaten, mitarbeiter_id: e.target.value })}>
                  <option value="">– Mitarbeiter auswählen –</option>
                  {mitarbeiter.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Nr. {m.personalnummer})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Von *</label>
                <input type="date" className="input" required value={formDaten.von}
                  onChange={(e) => setFormDaten({ ...formDaten, von: e.target.value })} />
              </div>
              <div>
                <label className="label">Bis *</label>
                <input type="date" className="input" required value={formDaten.bis}
                  min={formDaten.von}
                  onChange={(e) => setFormDaten({ ...formDaten, bis: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Art der Abwesenheit *</label>
              <select className="input" value={formDaten.status}
                onChange={(e) => setFormDaten({ ...formDaten, status: e.target.value })}>
                <option value="krank">Krank</option>
                <option value="urlaub">Urlaub</option>
                <option value="frei">Frei (Freischicht)</option>
                <option value="sonstige">Sonstige Abwesenheit</option>
              </select>
            </div>
            <div>
              <label className="label">Bemerkung (optional)</label>
              <input className="input" value={formDaten.bemerkung}
                onChange={(e) => setFormDaten({ ...formDaten, bemerkung: e.target.value })}
                placeholder="z.B. Arzttermin, Fortbildung..."
                autoComplete="off" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={schliesseFormular}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary">Speichern</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
