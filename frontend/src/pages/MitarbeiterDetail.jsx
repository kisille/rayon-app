import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { kompetenzLabel, kompetenzBadgeClass } from '../utils/helpers.js';
import { Modal } from './Mitarbeiter.jsx';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

export default function MitarbeiterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mitarbeiter, setMitarbeiter] = useState(null);
  const [rayone, setRayone] = useState([]);
  const [laden, setLaden] = useState(true);
  const [bearbeiteModus, setBearbeiteModus] = useState(false);
  const [zeigKompetenzForm, setZeigKompetenzForm] = useState(false);
  const [formDaten, setFormDaten] = useState({});
  const [neueKompetenz, setNeueKompetenz] = useState({ rayon_id: '', level: 2 });

  const laden_ = async () => {
    const [mRes, rRes] = await Promise.all([
      api.get(`/mitarbeiter/${id}`),
      api.get('/rayone'),
    ]);
    setMitarbeiter(mRes.data);
    setFormDaten({
      name: mRes.data.name,
      personalnummer: mRes.data.personalnummer,
      telefon: mRes.data.telefon || '',
      email: mRes.data.email || '',
      stamm_rayon_id: mRes.data.stamm_rayon_id || '',
      mitnahme_modus: mRes.data.mitnahme_modus || 'normal',
    });
    setRayone(rRes.data);
    setLaden(false);
  };

  useEffect(() => { laden_(); }, [id]);

  const handleSpeichern = async (e) => {
    e.preventDefault();
    await api.put(`/mitarbeiter/${id}`, {
      ...formDaten,
      stamm_rayon_id: formDaten.stamm_rayon_id || null,
    });
    await laden_();
    setBearbeiteModus(false);
  };

  const handleLöschen = async () => {
    if (!window.confirm(`${mitarbeiter.name} wirklich löschen?`)) return;
    await api.delete(`/mitarbeiter/${id}`);
    navigate('/mitarbeiter');
  };

  const handleKompetenzHinzufügen = async (e) => {
    e.preventDefault();
    await api.post('/kompetenzen', {
      mitarbeiter_id: parseInt(id),
      rayon_id: parseInt(neueKompetenz.rayon_id),
      level: parseInt(neueKompetenz.level),
    });
    setZeigKompetenzForm(false);
    setNeueKompetenz({ rayon_id: '', level: 2 });
    await laden_();
  };

  const handleKompetenzEntfernen = async (rayonId) => {
    await api.delete(`/kompetenzen/${id}/${rayonId}`);
    await laden_();
  };

  if (laden || !mitarbeiter) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;
  }

  const verfügbareRayone = rayone.filter(r =>
    !mitarbeiter.kompetenzen.some(k => k.rayon_id === r.id)
  );

  const aktuelleZuteilung = mitarbeiter.aktuelle_zuteilung; // Ganzmitnahme (backward compat)
  const ganzmitnahme = mitarbeiter.ganzmitnahme || aktuelleZuteilung;
  const teilmitnahmen = mitarbeiter.teilmitnahmen || [];

  const MODUS_LABEL = {
    normal: 'Normal (Voll- und Teilmitnahme)',
    teilweise: 'Nur Teilmitnahme',
    keine: 'Keine Mitnahme',
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/mitarbeiter" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{mitarbeiter.name}</h1>
          <p className="text-gray-500 text-sm">Personalnummer: {mitarbeiter.personalnummer}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBearbeiteModus(true)} className="btn-secondary">Bearbeiten</button>
          <button onClick={handleLöschen} className="btn-danger">Löschen</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stammdaten */}
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-gray-900 mb-4">Stammdaten</h2>
          <dl className="space-y-3">
            <Detail label="Name" wert={mitarbeiter.name} />
            <Detail label="Personalnr." wert={mitarbeiter.personalnummer} />
            <Detail label="Telefon" wert={mitarbeiter.telefon || '–'} />
            <Detail label="E-Mail" wert={mitarbeiter.email || '–'} />
            <Detail
              label="Stamm-Rayon"
              wert={mitarbeiter.stamm_rayon_bezeichnung || '–'}
            />
            {mitarbeiter.heute_rayon_bezeichnung && (
              <Detail
                label="Heute besetzt"
                wert={
                  <span className={mitarbeiter.heute_rayon_id === mitarbeiter.stamm_rayon_id ? 'text-green-600 font-medium' : 'text-blue-600 font-medium'}>
                    {mitarbeiter.heute_rayon_bezeichnung}
                    {mitarbeiter.heute_rayon_id === mitarbeiter.stamm_rayon_id ? ' (Stammrayon)' : ''}
                  </span>
                }
              />
            )}
            <Detail
              label="Ganzmitnahme"
              wert={ganzmitnahme
                ? `${ganzmitnahme.rayon_bezeichnung}${ganzmitnahme.rayon_id === mitarbeiter.stamm_rayon_id ? ' (= Stamm)' : ''}`
                : (mitarbeiter.stamm_rayon_bezeichnung
                    ? `${mitarbeiter.stamm_rayon_bezeichnung} (Stamm)`
                    : '–')}
            />
            {teilmitnahmen.length > 0 && (
              <Detail
                label={`Teilmitnahmen (${teilmitnahmen.length}/2)`}
                wert={teilmitnahmen.map(t => t.rayon_bezeichnung).join(' · ')}
              />
            )}
            <Detail label="Mitnahmemodus" wert={MODUS_LABEL[mitarbeiter.mitnahme_modus] || 'Normal'} />
          </dl>

          {/* Fairness-Statistik */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Mitnahmeeinsätze</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{mitarbeiter.statistik?.monat || 0}</div>
                <div className="text-xs text-blue-600">Diesen Monat</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{mitarbeiter.statistik?.jahr || 0}</div>
                <div className="text-xs text-purple-600">Dieses Jahr</div>
              </div>
            </div>
          </div>
        </div>

        {/* Kompetenzen */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Rayon-Kompetenzen</h2>
            <button
              onClick={() => setZeigKompetenzForm(true)}
              className="btn-primary flex items-center gap-1 text-sm py-1.5"
            >
              <PlusIcon className="w-4 h-4" />
              Rayon hinzufügen
            </button>
          </div>

          <div className="space-y-2">
            {mitarbeiter.kompetenzen.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Noch keine Kompetenzen erfasst.</p>
            ) : (
              mitarbeiter.kompetenzen.map((k) => (
                <div key={k.rayon_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="font-medium text-sm">{k.bezeichnung}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={kompetenzBadgeClass(k.level)}>
                      {kompetenzLabel(k.level)}
                    </span>
                    {k.level !== 1 && (
                      <button
                        onClick={() => handleKompetenzEntfernen(k.rayon_id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bearbeiten-Modal */}
      {bearbeiteModus && (
        <Modal title="Mitarbeiter bearbeiten" onClose={() => setBearbeiteModus(false)}>
          <form autoComplete="off" onSubmit={handleSpeichern} className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" required value={formDaten.name} autoComplete="off"
                name="x-name" data-lpignore="true"
                onChange={(e) => setFormDaten({ ...formDaten, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Personalnummer *</label>
              <input className="input" required value={formDaten.personalnummer} autoComplete="new-password"
                onChange={(e) => setFormDaten({ ...formDaten, personalnummer: e.target.value })} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={formDaten.telefon} autoComplete="off"
                name="x-telefon" data-lpignore="true"
                onChange={(e) => setFormDaten({ ...formDaten, telefon: e.target.value })} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input type="text" className="input" value={formDaten.email} autoComplete="off"
                name="x-email" data-lpignore="true"
                onChange={(e) => setFormDaten({ ...formDaten, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Stamm-Rayon</label>
              <SearchableSelect
                options={rayone.map(r => ({ id: r.id, label: r.bezeichnung, sublabel: r.gebiet || undefined }))}
                value={formDaten.stamm_rayon_id}
                onChange={(id) => setFormDaten({ ...formDaten, stamm_rayon_id: id })}
                emptyLabel="– Kein Stamm-Rayon –"
                searchPlaceholder="Rayon suchen..."
              />
            </div>
            <div>
              <label className="label">Mitnahmemodus</label>
              <select className="input" value={formDaten.mitnahme_modus}
                onChange={(e) => setFormDaten({ ...formDaten, mitnahme_modus: e.target.value })}>
                <option value="normal">Normal (Voll- und Teilmitnahme möglich)</option>
                <option value="teilweise">Nur Teilmitnahme</option>
                <option value="keine">Keine Mitnahme</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setBearbeiteModus(false)}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary">Speichern</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Kompetenz hinzufügen */}
      {zeigKompetenzForm && (
        <Modal title="Rayon-Kompetenz hinzufügen" onClose={() => setZeigKompetenzForm(false)}>
          <form autoComplete="off" onSubmit={handleKompetenzHinzufügen} className="space-y-4">
            <div>
              <label className="label">Rayon *</label>
              <select className="input" required value={neueKompetenz.rayon_id}
                onChange={(e) => setNeueKompetenz({ ...neueKompetenz, rayon_id: e.target.value })}>
                <option value="">– Rayon auswählen –</option>
                {verfügbareRayone.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nummer} – {r.bezeichnung}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kompetenz-Level *</label>
              <select className="input" value={neueKompetenz.level}
                onChange={(e) => setNeueKompetenz({ ...neueKompetenz, level: e.target.value })}>
                <option value={2}>2 – Sehr gut (kann Rayon problemlos übernehmen)</option>
                <option value={3}>3 – Geht so (nur im Notfall)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setZeigKompetenzForm(false)}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary">Hinzufügen</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Detail({ label, wert }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 text-right max-w-48 break-words">{wert}</dd>
    </div>
  );
}
