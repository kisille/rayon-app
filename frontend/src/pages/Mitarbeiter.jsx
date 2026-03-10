import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

const MITNAHME_MODUS_LABEL = {
  normal: null, // kein Badge
  teilweise: { label: 'Nur Teilmitnahme', klasse: 'bg-blue-100 text-blue-700' },
  keine: { label: 'Keine Mitnahme', klasse: 'bg-orange-100 text-orange-700' },
};

const monat = new Date().toISOString().substring(0, 7);

export default function Mitarbeiter() {
  const navigate = useNavigate();
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [rayone, setRayone] = useState([]);
  const [suche, setSuche] = useState('');
  const [zeigFormular, setZeigFormular] = useState(false);
  const [laden, setLaden] = useState(true);
  const [formDaten, setFormDaten] = useState({
    name: '', personalnummer: '', telefon: '', email: '', stamm_rayon_id: '', mitnahme_modus: 'normal'
  });
  const [quickAktion, setQuickAktion] = useState(null); // { mitarbeiterId, x, y }
  const [rayonAendernId, setRayonAendernId] = useState(null); // mitarbeiterId für Modal
  const [neuerRayonId, setNeuerRayonId] = useState('');
  const quickRef = useRef(null);

  const ladeAlles = () => {
    Promise.all([
      api.get('/mitarbeiter'),
      api.get('/rayone'),
    ]).then(([mRes, rRes]) => {
      setMitarbeiter(mRes.data);
      setRayone(rRes.data);
      setLaden(false);
    });
  };

  useEffect(() => {
    ladeAlles();
    const onVisible = () => { if (document.visibilityState === 'visible') ladeAlles(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ladeAlles);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ladeAlles);
    };
  }, []);

  // Quick-Aktion schließen bei Klick außerhalb
  useEffect(() => {
    function handle(e) {
      if (quickRef.current && !quickRef.current.contains(e.target)) {
        setQuickAktion(null);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const ladeMitarbeiter = async () => {
    const { data } = await api.get('/mitarbeiter');
    setMitarbeiter(data);
  };


  const gefilterte = mitarbeiter.filter(m =>
    m.name.toLowerCase().includes(suche.toLowerCase()) ||
    m.personalnummer.includes(suche)
  );

  const handleSpeichern = async (e) => {
    e.preventDefault();
    await api.post('/mitarbeiter', {
      ...formDaten,
      stamm_rayon_id: formDaten.stamm_rayon_id || null,
    });
    const { data } = await api.get('/mitarbeiter');
    setMitarbeiter(data);
    setZeigFormular(false);
    setFormDaten({ name: '', personalnummer: '', telefon: '', email: '', stamm_rayon_id: '', mitnahme_modus: 'normal' });
  };

  const handleRayonEntfernen = async (mitarbeiterId) => {
    setQuickAktion(null);
    await api.delete(`/monatszuteilungen/${monat}/${mitarbeiterId}`);
    await ladeMitarbeiter();
  };

  const handleRayonAendern = async () => {
    if (!neuerRayonId || !rayonAendernId) return;
    await api.put(`/monatszuteilungen/${monat}/rayon/${neuerRayonId}`, {
      mitarbeiter_id: rayonAendernId,
      ist_teilzuteilung: 0,
    });
    setRayonAendernId(null);
    setNeuerRayonId('');
    await ladeMitarbeiter();
  };

  if (laden) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-lg">Laden...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mitarbeiter</h1>
          <p className="text-gray-500 mt-1">{mitarbeiter.length} Mitarbeiter erfasst</p>
        </div>
        <button onClick={() => setZeigFormular(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Neu anlegen
        </button>
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Name oder Personalnummer suchen..."
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      {/* Mitarbeiter-Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {gefilterte.map((m) => {
          const modusInfo = MITNAHME_MODUS_LABEL[m.mitnahme_modus];
          return (
            <Link
              key={m.id}
              to={`/mitarbeiter/${m.id}`}
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-yellow-700 font-bold text-lg">{m.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 group-hover:text-yellow-700 truncate">{m.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Nr. {m.personalnummer}</div>

                  {/* Stamm-Rayon */}
                  {m.stamm_rayon_bezeichnung && (
                    <div className="text-xs text-gray-500 mt-1">
                      Stamm: {m.stamm_rayon_bezeichnung}
                    </div>
                  )}

                  {/* Heute besetzter Rayon (aus Tagesplan) */}
                  {m.heute_rayon_id && m.heute_rayon_id !== m.stamm_rayon_id && (
                    <div className="text-xs font-medium text-blue-600 mt-0.5">
                      Heute: {m.heute_rayon_bezeichnung}
                    </div>
                  )}
                  {m.heute_rayon_id && m.heute_rayon_id === m.stamm_rayon_id && (
                    <div className="text-xs font-medium text-green-600 mt-0.5">
                      Heute auf Stammrayon
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {modusInfo && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${modusInfo.klasse}`}>
                        {modusInfo.label}
                      </span>
                    )}
                    {m.fahrzeug_kennzeichen && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate('/fahrzeuge', { state: { editId: m.fahrzeug_id } });
                        }}
                        className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                        title="Fahrzeug bearbeiten"
                      >
                        🚐 {m.fahrzeug_kennzeichen}
                      </button>
                    )}
                    {m.telefon && (
                      <span className="text-xs text-gray-500">📞 {m.telefon}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {gefilterte.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <UserCircleIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Keine Mitarbeiter gefunden</p>
          </div>
        )}
      </div>

      {/* Quick-Aktion Dropdown */}
      {quickAktion && (
        <div className="fixed inset-0 z-40" onClick={() => setQuickAktion(null)}>
          <div
            ref={quickRef}
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 min-w-44"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-700">
              {quickAktion.mitarbeiterName}
            </div>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => {
                setRayonAendernId(quickAktion.mitarbeiterId);
                setQuickAktion(null);
              }}
            >
              Rayon ändern
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => handleRayonEntfernen(quickAktion.mitarbeiterId)}
            >
              Rayon entfernen
            </button>
          </div>
        </div>
      )}

      {/* Rayon ändern Modal */}
      {rayonAendernId && (
        <Modal title="Rayon ändern" onClose={() => { setRayonAendernId(null); setNeuerRayonId(''); }}>
          <div className="space-y-4">
            <div>
              <label className="label">Neuer Rayon</label>
              <SearchableSelect
                options={rayone.map(r => ({ id: r.id, label: `${r.nummer} – ${r.bezeichnung}` }))}
                value={neuerRayonId}
                onChange={(id) => setNeuerRayonId(id)}
                emptyLabel="– Rayon auswählen –"
                searchPlaceholder="Rayon suchen..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => { setRayonAendernId(null); setNeuerRayonId(''); }}>
                Abbrechen
              </button>
              <button type="button" className="btn-primary" disabled={!neuerRayonId} onClick={handleRayonAendern}>
                Speichern
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Formular-Modal */}
      {zeigFormular && (
        <Modal title="Neuen Mitarbeiter anlegen" onClose={() => setZeigFormular(false)}>
          <form onSubmit={handleSpeichern} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Name *</label>
                <input className="input" required value={formDaten.name}
                  onChange={(e) => setFormDaten({ ...formDaten, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Personalnummer *</label>
                <input className="input" required value={formDaten.personalnummer}
                  onChange={(e) => setFormDaten({ ...formDaten, personalnummer: e.target.value })} />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="input" value={formDaten.telefon}
                  onChange={(e) => setFormDaten({ ...formDaten, telefon: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">E-Mail</label>
                <input type="email" className="input" value={formDaten.email}
                  onChange={(e) => setFormDaten({ ...formDaten, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Stamm-Rayon</label>
                <SearchableSelect
                  options={rayone.map(r => ({ id: r.id, label: r.bezeichnung, sublabel: r.gebiet || undefined }))}
                  value={formDaten.stamm_rayon_id}
                  onChange={(id) => setFormDaten({ ...formDaten, stamm_rayon_id: id })}
                  emptyLabel="– Kein Stamm-Rayon –"
                  searchPlaceholder="Rayon suchen..."
                />
              </div>
              <div className="col-span-2">
                <label className="label">Mitnahmemodus</label>
                <select className="input" value={formDaten.mitnahme_modus}
                  onChange={(e) => setFormDaten({ ...formDaten, mitnahme_modus: e.target.value })}>
                  <option value="normal">Normal (Voll- und Teilmitnahme möglich)</option>
                  <option value="teilweise">Nur Teilmitnahme</option>
                  <option value="keine">Keine Mitnahme</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setZeigFormular(false)}>
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

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
