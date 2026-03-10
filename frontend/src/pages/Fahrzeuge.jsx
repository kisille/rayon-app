import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  TruckIcon,
  PlusIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  BoltIcon,
  FireIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

const STATUS_OPTIONEN = [
  { value: 'verfügbar', label: 'Verfügbar', farbe: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  { value: 'im_einsatz', label: 'Im Einsatz', farbe: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  { value: 'werkstatt', label: 'Werkstatt', farbe: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  { value: 'ausser_betrieb', label: 'Außer Betrieb', farbe: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
];

const MARKEN = [
  { value: 'Maxus', antrieb: 'Elektro', typ: 'Zustellfahrzeug' },
  { value: 'Peugeot', antrieb: 'Diesel', typ: 'Zustellfahrzeug' },
  { value: 'Mercedes', antrieb: 'Elektro', typ: 'Grosspaketfahrzeug' },
];

function statusInfo(status) {
  return STATUS_OPTIONEN.find(s => s.value === status) || STATUS_OPTIONEN[0];
}

function antriebBadge(antrieb) {
  if (antrieb === 'Elektro') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <BoltIcon className="w-3 h-3" />
        Elektro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <FireIcon className="w-3 h-3" />
      Diesel
    </span>
  );
}

export default function Fahrzeuge() {
  const location = useLocation();
  const editIdFromState = location.state?.editId;
  const editInitialized = useRef(false);

  const [fahrzeuge, setFahrzeuge] = useState([]);
  const [mitarbeiterListe, setMitarbeiterListe] = useState([]);
  const [laden, setLaden] = useState(true);
  const [modalOffen, setModalOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(null);
  const [filter, setFilter] = useState({ marke: '', status: '' });
  const [kennzeichenSuche, setKennzeichenSuche] = useState('');
  const [formular, setFormular] = useState({
    kennzeichen: '',
    marke: 'Maxus',
    modell: '',
    antrieb: 'Elektro',
    typ: 'Zustellfahrzeug',
    status: 'verfügbar',
    mitarbeiter_id: '',
    bemerkung: '',
  });

  const ladeFahrzeuge = () => {
    const params = new URLSearchParams();
    if (filter.marke) params.set('marke', filter.marke);
    if (filter.status) params.set('status', filter.status);
    api.get(`/fahrzeuge?${params}`).then(({ data }) => {
      setFahrzeuge(data);
      setLaden(false);
    });
  };

  useEffect(() => {
    ladeFahrzeuge();
    api.get('/mitarbeiter').then(({ data }) => setMitarbeiterListe(data));
  }, [filter]);

  // Wenn per Navigation ein Fahrzeug-Edit angefordert wurde
  useEffect(() => {
    if (!editIdFromState || editInitialized.current || laden) return;
    const f = fahrzeuge.find(fz => fz.id === editIdFromState);
    if (f) {
      editInitialized.current = true;
      öffneBearbeiten(f);
    }
  }, [fahrzeuge, laden, editIdFromState]);

  const öffneNeu = () => {
    setBearbeiten(null);
    setFormular({
      kennzeichen: '',
      marke: 'Maxus',
      modell: '',
      antrieb: 'Elektro',
      typ: 'Zustellfahrzeug',
      status: 'verfügbar',
      mitarbeiter_id: '',
      bemerkung: '',
    });
    setModalOffen(true);
  };

  const öffneBearbeiten = (f) => {
    setBearbeiten(f);
    setFormular({
      kennzeichen: f.kennzeichen,
      marke: f.marke,
      modell: f.modell || '',
      antrieb: f.antrieb,
      typ: f.typ,
      status: f.status,
      mitarbeiter_id: f.mitarbeiter_id || '',
      bemerkung: f.bemerkung || '',
    });
    setModalOffen(true);
  };

  const markeGeändert = (marke) => {
    const info = MARKEN.find(m => m.value === marke);
    setFormular(prev => ({
      ...prev,
      marke,
      antrieb: info?.antrieb || prev.antrieb,
      typ: info?.typ || prev.typ,
    }));
  };

  const speichern = async (e) => {
    e.preventDefault();
    if (bearbeiten) {
      await api.put(`/fahrzeuge/${bearbeiten.id}`, formular);
    } else {
      await api.post('/fahrzeuge', formular);
    }
    setModalOffen(false);
    ladeFahrzeuge();
  };

  const statusÄndern = async (fahrzeugId, neuerStatus) => {
    const f = fahrzeuge.find(fz => fz.id === fahrzeugId);
    if (!f) return;
    await api.put(`/fahrzeuge/${fahrzeugId}`, { ...f, status: neuerStatus });
    ladeFahrzeuge();
  };

  const löschen = async (id) => {
    if (!confirm('Fahrzeug wirklich entfernen?')) return;
    await api.delete(`/fahrzeuge/${id}`);
    ladeFahrzeuge();
  };

  // Zusammenfassung
  const zusammenfassung = {
    gesamt: fahrzeuge.length,
    verfügbar: fahrzeuge.filter(f => f.status === 'verfügbar').length,
    im_einsatz: fahrzeuge.filter(f => f.status === 'im_einsatz').length,
    werkstatt: fahrzeuge.filter(f => f.status === 'werkstatt').length,
    ausser_betrieb: fahrzeuge.filter(f => f.status === 'ausser_betrieb').length,
  };

  if (laden) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">Laden...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einsatzfahrzeuge</h1>
          <p className="text-gray-500 mt-1">{zusammenfassung.gesamt} Fahrzeuge registriert</p>
        </div>
        <button onClick={öffneNeu} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Fahrzeug hinzufügen
        </button>
      </div>

      {/* Status-Übersicht */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatusKarte
          label="Verfügbar"
          wert={zusammenfassung.verfügbar}
          icon={<CheckCircleIcon className="w-5 h-5 text-green-600" />}
          bg="bg-green-50"
          aktiv={filter.status === 'verfügbar'}
          onClick={() => setFilter(f => ({ ...f, status: f.status === 'verfügbar' ? '' : 'verfügbar' }))}
        />
        <StatusKarte
          label="Im Einsatz"
          wert={zusammenfassung.im_einsatz}
          icon={<TruckIcon className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          aktiv={filter.status === 'im_einsatz'}
          onClick={() => setFilter(f => ({ ...f, status: f.status === 'im_einsatz' ? '' : 'im_einsatz' }))}
        />
        <StatusKarte
          label="Werkstatt"
          wert={zusammenfassung.werkstatt}
          icon={<WrenchScrewdriverIcon className="w-5 h-5 text-orange-600" />}
          bg="bg-orange-50"
          aktiv={filter.status === 'werkstatt'}
          onClick={() => setFilter(f => ({ ...f, status: f.status === 'werkstatt' ? '' : 'werkstatt' }))}
        />
        <StatusKarte
          label="Außer Betrieb"
          wert={zusammenfassung.ausser_betrieb}
          icon={<XMarkIcon className="w-5 h-5 text-red-600" />}
          bg="bg-red-50"
          aktiv={filter.status === 'ausser_betrieb'}
          onClick={() => setFilter(f => ({ ...f, status: f.status === 'ausser_betrieb' ? '' : 'ausser_betrieb' }))}
        />
      </div>

      {/* Kennzeichen-Suche */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Nach Kennzeichen suchen..."
          value={kennzeichenSuche}
          onChange={e => setKennzeichenSuche(e.target.value)}
        />
      </div>

      {/* Filter nach Marke */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter(f => ({ ...f, marke: '' }))}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !filter.marke ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Alle
        </button>
        {MARKEN.map(m => (
          <button
            key={m.value}
            onClick={() => setFilter(f => ({ ...f, marke: f.marke === m.value ? '' : m.value }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter.marke === m.value ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m.value}
          </button>
        ))}
      </div>

      {/* Fahrzeug-Liste */}
      {(() => { const gefilterteFahrzeuge = fahrzeuge.filter(f => !kennzeichenSuche || f.kennzeichen.toLowerCase().includes(kennzeichenSuche.toLowerCase())); return gefilterteFahrzeuge; })().length === 0 && fahrzeuge.length > 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg">Kein Fahrzeug mit diesem Kennzeichen gefunden</p>
        </div>
      ) : fahrzeuge.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <TruckIcon className="w-16 h-16 mx-auto mb-3 text-gray-300" />
          <p className="text-lg">Keine Fahrzeuge gefunden</p>
          <p className="text-sm mt-1">
            {filter.marke || filter.status
              ? 'Passe die Filter an oder füge ein neues Fahrzeug hinzu.'
              : 'Füge dein erstes Fahrzeug hinzu.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fahrzeuge.filter(f => !kennzeichenSuche || f.kennzeichen.toLowerCase().includes(kennzeichenSuche.toLowerCase())).map(f => {
            const si = statusInfo(f.status);
            return (
              <div key={f.id} className="card hover:shadow-md transition-shadow">
                {/* Kopfzeile */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-gray-900 text-lg">{f.kennzeichen}</div>
                    <div className="text-sm text-gray-500">{f.marke}{f.modell ? ` ${f.modell}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => öffneBearbeiten(f)}
                      className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => löschen(f.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Entfernen"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Infos */}
                <div className="flex items-center gap-2 mb-3">
                  {antriebBadge(f.antrieb)}
                  {f.mitarbeiter_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {f.mitarbeiter_name}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${si.farbe}`}>
                    <span className={`w-2 h-2 rounded-full ${si.dot}`}></span>
                    {si.label}
                  </span>

                  {/* Schnell-Status-Buttons */}
                  <div className="flex gap-1">
                    {STATUS_OPTIONEN.filter(s => s.value !== f.status).map(s => (
                      <button
                        key={s.value}
                        onClick={() => statusÄndern(f.id, s.value)}
                        className="p-1 rounded text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title={`Auf "${s.label}" setzen`}
                      >
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`}></span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bemerkung */}
                {f.bemerkung && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    {f.bemerkung}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {bearbeiten ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
              </h2>
              <button onClick={() => setModalOffen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={speichern} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kennzeichen *</label>
                <input
                  type="text"
                  required
                  value={formular.kennzeichen}
                  onChange={e => setFormular(f => ({ ...f, kennzeichen: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. PT 12345"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marke *</label>
                  <select
                    value={formular.marke}
                    onChange={e => markeGeändert(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  >
                    {MARKEN.map(m => (
                      <option key={m.value} value={m.value}>{m.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modell</label>
                  <input
                    type="text"
                    value={formular.modell}
                    onChange={e => setFormular(f => ({ ...f, modell: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                    placeholder="z.B. eDeliver 3"
                  />
                </div>
              </div>

              <div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Antrieb</label>
                  <input
                    type="text"
                    value={formular.antrieb}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
  
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formular.status}
                  onChange={e => setFormular(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                >
                  {STATUS_OPTIONEN.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zugeteilter Mitarbeiter</label>
                <SearchableSelect
                  options={mitarbeiterListe.map(m => ({ id: m.id, label: m.name, sublabel: `Nr. ${m.personalnummer}` }))}
                  value={formular.mitarbeiter_id}
                  onChange={id => setFormular(f => ({ ...f, mitarbeiter_id: id }))}
                  emptyLabel="— Kein Mitarbeiter —"
                  searchPlaceholder="Name oder Personalnummer..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bemerkung</label>
                <textarea
                  value={formular.bemerkung}
                  onChange={e => setFormular(f => ({ ...f, bemerkung: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. Reparatur bis 15.03."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOffen(false)} className="btn-secondary flex-1">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {bearbeiten ? 'Speichern' : 'Hinzufügen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusKarte({ label, wert, icon, bg, aktiv, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card text-left transition-all ${aktiv ? 'ring-2 ring-yellow-400 shadow-md' : 'hover:shadow-md'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900">{wert}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </button>
  );
}
