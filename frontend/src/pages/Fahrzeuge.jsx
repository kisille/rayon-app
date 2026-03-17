import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  ExclamationTriangleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';

const STATUS_OPTIONEN = [
  { value: 'verfügbar', label: 'Verfügbar', farbe: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  { value: 'im_einsatz', label: 'Im Einsatz', farbe: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  { value: 'werkstatt', label: 'Werkstatt', farbe: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  { value: 'ausser_betrieb', label: 'Außer Betrieb', farbe: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
];

const MARKEN = [
  { value: 'Maxus',   antrieb: 'Elektro', typ: 'Zustellfahrzeug' },
  { value: 'Peugeot', antrieb: 'Diesel',  typ: 'Zustellfahrzeug' },
  { value: 'Mercedes', antrieb: 'Elektro', typ: 'Grosspaketfahrzeug' },
  { value: 'Renault', antrieb: 'Diesel',  typ: 'Zustellfahrzeug' },
  { value: 'Fiat',    antrieb: 'Diesel',  typ: 'Zustellfahrzeug' },
  { value: 'Jumug',   antrieb: 'Elektro', typ: 'Grosspaketfahrzeug' },
];

// §57a: nächste Vorführung = letzte + 1 Jahr
// Ampel: rot = überfällig, gelb = <90 Tage, grün = ok, grau = kein Datum
function pickerl57a(letzteVorführung) {
  if (!letzteVorführung) return null;
  const letzte = new Date(letzteVorführung);
  const nächste = new Date(letzte);
  nächste.setFullYear(nächste.getFullYear() + 1);
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const diffMs = nächste - heute;
  const diffTage = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffTage < 0) {
    return { label: `Überfällig (${Math.abs(diffTage)} Tage)`, farbe: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', nächste };
  } else if (diffTage <= 90) {
    return { label: `Fällig in ${diffTage} Tagen`, farbe: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', nächste };
  } else {
    const monate = Math.floor(diffTage / 30);
    return { label: `OK (noch ${monate} Mon.)`, farbe: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', nächste };
  }
}

function formatDatum(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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

const LEERES_FORMULAR = {
  kennzeichen: '',
  marke: 'Maxus',
  modell: '',
  antrieb: 'Elektro',
  typ: 'Zustellfahrzeug',
  status: 'verfügbar',
  mitarbeiter_id: '',
  bemerkung: '',
  erstzulassung: '',
  letzte_vorführung: '',
};

export default function Fahrzeuge() {
  const location = useLocation();
  const navigate = useNavigate();
  const editIdFromState = location.state?.editId;
  const editInitialized = useRef(false);

  const [fahrzeuge, setFahrzeuge] = useState([]);
  const [mitarbeiterListe, setMitarbeiterListe] = useState([]);
  const [laden, setLaden] = useState(true);
  const [modalOffen, setModalOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(null);
  const [filter, setFilter] = useState({ marke: '', status: '' });
  const [kennzeichenSuche, setKennzeichenSuche] = useState('');
  const [formular, setFormular] = useState(LEERES_FORMULAR);

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
    setFormular(LEERES_FORMULAR);
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
      erstzulassung: f.erstzulassung || '',
      letzte_vorführung: f.letzte_vorführung || '',
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
    const payload = {
      ...formular,
      erstzulassung: formular.erstzulassung || null,
      letzte_vorführung: formular.letzte_vorführung || null,
    };
    if (bearbeiten) {
      await api.put(`/fahrzeuge/${bearbeiten.id}`, payload);
    } else {
      await api.post('/fahrzeuge', payload);
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

  const zusammenfassung = {
    gesamt: fahrzeuge.length,
    verfügbar: fahrzeuge.filter(f => f.status === 'verfügbar').length,
    im_einsatz: fahrzeuge.filter(f => f.status === 'im_einsatz').length,
    werkstatt: fahrzeuge.filter(f => f.status === 'werkstatt').length,
    ausser_betrieb: fahrzeuge.filter(f => f.status === 'ausser_betrieb').length,
  };

  // §57a Warnungen
  const pickerlWarnungen = fahrzeuge.filter(f => {
    const p = pickerl57a(f.letzte_vorführung);
    return p && (p.dot === 'bg-red-500' || p.dot === 'bg-yellow-500');
  }).length;

  if (laden) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">Laden...</div>
      </div>
    );
  }

  const gefilterteFahrzeuge = fahrzeuge.filter(f =>
    !kennzeichenSuche || f.kennzeichen.toLowerCase().includes(kennzeichenSuche.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einsatzfahrzeuge</h1>
          <p className="text-gray-500 mt-1">
            {zusammenfassung.gesamt} Fahrzeuge registriert
            {pickerlWarnungen > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                <ExclamationTriangleIcon className="w-4 h-4" />
                {pickerlWarnungen} §57a fällig
              </span>
            )}
          </p>
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
          autoComplete="new-password"
        />
      </div>

      {/* Filter nach Marke */}
      <div className="flex flex-wrap gap-2 mb-4">
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
      {gefilterteFahrzeuge.length === 0 && fahrzeuge.length > 0 ? (
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
          {gefilterteFahrzeuge.map(f => {
            const si = statusInfo(f.status);
            const pickerl = pickerl57a(f.letzte_vorführung);
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

                {/* Antrieb + Mitarbeiter */}
                <div className="flex items-center gap-2 mb-3">
                  {antriebBadge(f.antrieb)}
                  {f.mitarbeiter_name && (
                    <button
                      onClick={() => navigate(`/mitarbeiter/${f.mitarbeiter_id}`)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                    >
                      {f.mitarbeiter_name}
                    </button>
                  )}
                </div>

                {/* §57a Pickerl */}
                {pickerl && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border mb-3 ${pickerl.farbe}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pickerl.dot}`}></span>
                    <span>§57a: {pickerl.label}</span>
                    <span className="ml-auto text-xs opacity-75">
                      bis {formatDatum(pickerl.nächste.toISOString())}
                    </span>
                  </div>
                )}
                {!f.letzte_vorführung && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-gray-50 text-gray-400 border-gray-200 mb-3">
                    <CalendarDaysIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>§57a Datum nicht eingetragen</span>
                  </div>
                )}

                {/* Erstzulassung */}
                {f.erstzulassung && (
                  <div className="text-xs text-gray-400 mb-2">
                    Erstzulassung: <span className="text-gray-600">{formatDatum(f.erstzulassung)}</span>
                  </div>
                )}

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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {bearbeiten ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
              </h2>
              <button onClick={() => setModalOffen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form autoComplete="off" onSubmit={speichern} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kennzeichen *</label>
                <input
                  type="text"
                  required
                  value={formular.kennzeichen}
                  onChange={e => setFormular(f => ({ ...f, kennzeichen: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. PT 12345"
                  autoComplete="new-password"
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
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Antrieb</label>
                <input
                  type="text"
                  value={formular.antrieb}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
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

              {/* Daten */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Zulassung & Pickerl</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Erstzulassung</label>
                    <input
                      type="date"
                      value={formular.erstzulassung}
                      onChange={e => setFormular(f => ({ ...f, erstzulassung: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Letzte §57a Vorführung</label>
                    <input
                      type="date"
                      value={formular.letzte_vorführung}
                      onChange={e => setFormular(f => ({ ...f, letzte_vorführung: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-sm"
                      autoComplete="off"
                    />
                  </div>
                </div>
                {formular.letzte_vorführung && (() => {
                  const p = pickerl57a(formular.letzte_vorführung);
                  return p ? (
                    <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${p.farbe}`}>
                      <span className={`w-2 h-2 rounded-full ${p.dot}`}></span>
                      Nächste §57a: {formatDatum(p.nächste.toISOString())} — {p.label}
                    </div>
                  ) : null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zugeteilter Mitarbeiter</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-sm bg-white"
                  value={formular.mitarbeiter_id || ''}
                  onChange={e => setFormular(f => ({ ...f, mitarbeiter_id: e.target.value ? parseInt(e.target.value) : null }))}
                >
                  <option value="">— Kein Mitarbeiter —</option>
                  {mitarbeiterListe.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Nr. {m.personalnummer})</option>
                  ))}
                </select>
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
