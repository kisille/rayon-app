import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UsersIcon,
  MapIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { formatDatumLang, statusLabel, statusBadgeClass, heuteDatum } from '../utils/helpers.js';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

export default function Dashboard() {
  const [daten, setDaten] = useState(null);
  const [laden, setLaden] = useState(true);
  const [abwesenheitModal, setAbwesenheitModal] = useState(false);
  const [bearbeiteDaten, setBearbeiteDaten] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);

  const ladeDaten = () => {
    api.get('/dashboard').then(({ data }) => {
      setDaten(data);
      setLaden(false);
    });
  };

  useEffect(() => {
    ladeDaten();
    api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data));
  }, []);

  if (laden) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">Laden...</div>
      </div>
    );
  }

  const abwesenheitenMap = {};
  for (const a of daten?.abwesenheiten_heute || []) {
    abwesenheitenMap[a.status] = a.count;
  }

  const anzahlAusfälle = (abwesenheitenMap.krank || 0) +
    (abwesenheitenMap.urlaub || 0) +
    (abwesenheitenMap.sonstige || 0);

  const öffneBearbeiten = (a) => {
    setBearbeiteDaten(a);
    setAbwesenheitModal(true);
  };

  const löscheAbwesenheit = async (a) => {
    if (!window.confirm(`Abwesenheit von ${a.mitarbeiter_name} wirklich löschen?`)) return;
    await api.delete(`/abwesenheiten/${a.mitarbeiter_id}/${a.datum}`);
    setLaden(true);
    ladeDaten();
  };

  const öffneNeu = () => {
    setBearbeiteDaten(null);
    setAbwesenheitModal(true);
  };

  return (
    <div>
      {/* Datum-Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">{formatDatumLang(daten?.heute)}</p>
      </div>

      {/* Stat-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<UsersIcon className="w-6 h-6 text-blue-600" />}
          bg="bg-blue-50"
          wert={daten?.anzahl_mitarbeiter || 0}
          label="Mitarbeiter gesamt"
          link="/mitarbeiter"
        />
        <StatCard
          icon={<MapIcon className="w-6 h-6 text-green-600" />}
          bg="bg-green-50"
          wert={daten?.anzahl_rayone || 0}
          label="Aktive Rayone"
          link="/rayone"
        />
        <StatCard
          icon={<ExclamationTriangleIcon className="w-6 h-6 text-red-600" />}
          bg="bg-red-50"
          wert={anzahlAusfälle}
          label="Ausfälle heute"
          link="/vertretung"
          highlight={anzahlAusfälle > 0}
        />
        <StatCard
          icon={<CheckCircleIcon className="w-6 h-6 text-yellow-600" />}
          bg="bg-yellow-50"
          wert={abwesenheitenMap.anwesend || (daten?.anzahl_mitarbeiter - anzahlAusfälle) || 0}
          label="Anwesend heute"
          link="/tagesplan"
        />
      </div>

      {/* Hauptbereich */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Abwesenheiten heute */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Abwesenheiten heute</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={öffneNeu}
                className="flex items-center gap-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium px-2 py-1 rounded-lg transition-colors"
                title="Abwesenheit manuell eintragen"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Eintragen
              </button>
              <Link to="/vertretung" className="text-sm text-yellow-600 hover:text-yellow-700 flex items-center gap-1">
                Vertretung <ArrowRightIcon className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {daten?.abwesenheiten_details?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p>Heute sind alle Mitarbeiter anwesend!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {daten?.abwesenheiten_details?.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="font-medium text-sm">{a.mitarbeiter_name}</span>
                    {a.rayon_nummer && (
                      <span className="text-gray-400 text-xs ml-2">Rayon {a.rayon_nummer}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadgeClass(a.status)}>
                      {statusLabel(a.status)}
                    </span>
                    <button
                      onClick={() => öffneBearbeiten(a)}
                      className="text-gray-300 hover:text-yellow-500 transition-colors"
                      title="Bearbeiten"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => löscheAbwesenheit(a)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Löschen"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schnellaktionen */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Schnellaktionen</h2>
          <div className="space-y-3">
            <QuickAction
              href="/tagesplan"
              icon="📋"
              title="Tagesplan aufrufen"
              desc={`Übersicht aller ${daten?.anzahl_rayone || 0} Rayone für heute`}
            />
            <QuickAction
              href="/vertretung"
              icon="🔄"
              title="Vertretung planen"
              desc="Optimale Vertretungen berechnen lassen"
            />
            <QuickAction
              href="/fahrzeuge"
              icon="🚛"
              title="Fahrzeuge verwalten"
              desc="Status der Einsatzfahrzeuge prüfen"
            />
            <QuickAction
              href="/statistik"
              icon="📊"
              title="Fairness-Statistik"
              desc="Wer hat wie oft eingesprungen?"
            />
          </div>
        </div>
      </div>

      {/* Modal: Abwesenheit eintragen / bearbeiten */}
      {abwesenheitModal && (
        <AbwesenheitModal
          mitarbeiter={mitarbeiter}
          bearbeiteDaten={bearbeiteDaten}
          onClose={() => { setAbwesenheitModal(false); setBearbeiteDaten(null); }}
          onSaved={() => { setAbwesenheitModal(false); setBearbeiteDaten(null); setLaden(true); ladeDaten(); }}
        />
      )}
    </div>
  );
}

// ─── AbwesenheitModal ─────────────────────────────────────────────────────────
function AbwesenheitModal({ mitarbeiter, bearbeiteDaten, onClose, onSaved }) {
  const isEdit = !!bearbeiteDaten;
  const [formDaten, setFormDaten] = useState({
    mitarbeiter_id: bearbeiteDaten ? String(bearbeiteDaten.mitarbeiter_id) : '',
    von: bearbeiteDaten ? bearbeiteDaten.datum : heuteDatum(),
    bis: bearbeiteDaten ? bearbeiteDaten.datum : heuteDatum(),
    status: bearbeiteDaten ? bearbeiteDaten.status : 'krank',
    bemerkung: bearbeiteDaten ? (bearbeiteDaten.bemerkung || '') : '',
  });
  const [speichern, setSpeichern] = useState(false);
  const [fehler, setFehler] = useState('');

  const handleSpeichern = async (e) => {
    e.preventDefault();
    if (!formDaten.mitarbeiter_id) { setFehler('Bitte Mitarbeiter auswählen.'); return; }
    setSpeichern(true);
    setFehler('');

    // Datumsbereich expandieren
    const daten = [];
    const start = new Date(formDaten.von);
    const ende = new Date(formDaten.bis);
    for (let d = new Date(start); d <= ende; d.setDate(d.getDate() + 1)) {
      daten.push(d.toISOString().split('T')[0]);
    }

    try {
      // Bei Bearbeitung: alten Eintrag löschen
      if (isEdit) {
        await api.delete(`/abwesenheiten/${bearbeiteDaten.mitarbeiter_id}/${bearbeiteDaten.datum}`);
      }
      // Neue Einträge speichern
      await api.post('/abwesenheiten', {
        mitarbeiter_id: parseInt(formDaten.mitarbeiter_id),
        datum: daten.length === 1 ? daten[0] : daten,
        status: formDaten.status,
        bemerkung: formDaten.bemerkung || null,
      });
      onSaved();
    } catch (err) {
      setFehler('Fehler beim Speichern: ' + (err?.response?.data?.fehler || err.message));
      setSpeichern(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {isEdit ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form autoComplete="off" onSubmit={handleSpeichern} className="px-6 py-4 space-y-4">
          {/* Mitarbeiter-Suche */}
          <div>
            <label className="label">Mitarbeiter *</label>
            {isEdit ? (
              <div className="input bg-gray-50 text-gray-600 text-sm">
                {bearbeiteDaten.mitarbeiter_name}
              </div>
            ) : (
              <SearchableSelect
                options={mitarbeiter.map(m => ({ id: String(m.id), label: m.name, sublabel: `Nr. ${m.personalnummer}` }))}
                value={formDaten.mitarbeiter_id}
                onChange={id => setFormDaten({ ...formDaten, mitarbeiter_id: id })}
                emptyLabel="– Mitarbeiter auswählen –"
                searchPlaceholder="Name oder Personalnummer..."
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Von *</label>
              <input
                type="date"
                className="input"
                required
                value={formDaten.von}
                onChange={(e) => setFormDaten({ ...formDaten, von: e.target.value, bis: formDaten.bis < e.target.value ? e.target.value : formDaten.bis })}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Bis *</label>
              <input
                type="date"
                className="input"
                required
                value={formDaten.bis}
                min={formDaten.von}
                onChange={(e) => setFormDaten({ ...formDaten, bis: e.target.value })}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="label">Status *</label>
            <select
              className="input"
              value={formDaten.status}
              onChange={(e) => setFormDaten({ ...formDaten, status: e.target.value })}
            >
              <option value="krank">Krank</option>
              <option value="urlaub">Urlaub</option>
              <option value="frei">Frei</option>
              <option value="sonstige">Sonstige</option>
            </select>
          </div>

          <div>
            <label className="label">Bemerkung</label>
            <input
              type="text"
              className="input"
              placeholder="Optional..."
              value={formDaten.bemerkung}
              onChange={(e) => setFormDaten({ ...formDaten, bemerkung: e.target.value })}
              autoComplete="new-password"
            />
          </div>

          {fehler && <div className="text-red-600 text-sm">{fehler}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={speichern}>
              {speichern ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, wert, label, link, highlight }) {
  return (
    <Link to={link} className={`card hover:shadow-md transition-shadow ${highlight ? 'ring-2 ring-red-200' : ''}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <div className={`text-2xl font-bold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{wert}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </Link>
  );
}

function QuickAction({ href, icon, title, desc }) {
  return (
    <Link
      to={href}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 group-hover:text-yellow-700">{title}</div>
        <div className="text-xs text-gray-500 truncate">{desc}</div>
      </div>
      <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-yellow-500 flex-shrink-0" />
    </Link>
  );
}
