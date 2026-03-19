import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ShieldCheckIcon, UserIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { formatDatum } from '../utils/helpers.js';

export default function Benutzer() {
  const [benutzer, setBenutzer] = useState([]);
  const [laden, setLaden] = useState(true);
  const [modalOffen, setModalOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(null);
  const [form, setForm] = useState({ benutzername: '', passwort: '', name: '', rolle: 'schichtleiter' });
  const [fehler, setFehler] = useState('');
  const [speichern, setSpeichern] = useState(false);

  const laden_ = async () => {
    setLaden(true);
    try {
      const { data } = await api.get('/benutzer');
      setBenutzer(data);
    } catch (e) {
      setFehler(e.response?.data?.fehler || 'Fehler beim Laden');
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => { laden_(); }, []);

  const oeffneNeu = () => {
    setBearbeiten(null);
    setForm({ benutzername: '', passwort: '', name: '', rolle: 'schichtleiter' });
    setFehler('');
    setModalOffen(true);
  };

  const oeffneBearbeiten = (b) => {
    setBearbeiten(b);
    setForm({ benutzername: b.benutzername, passwort: '', name: b.name, rolle: b.rolle });
    setFehler('');
    setModalOffen(true);
  };

  const speichern_ = async (e) => {
    e.preventDefault();
    setSpeichern(true);
    setFehler('');
    try {
      if (bearbeiten) {
        await api.put(`/benutzer/${bearbeiten.id}`, { name: form.name, rolle: form.rolle, passwort: form.passwort || undefined });
      } else {
        await api.post('/benutzer', form);
      }
      setModalOffen(false);
      laden_();
    } catch (e) {
      setFehler(e.response?.data?.fehler || 'Fehler beim Speichern');
    } finally {
      setSpeichern(false);
    }
  };

  const loeschen = async (b) => {
    if (!confirm(`Benutzer "${b.name}" wirklich löschen?`)) return;
    try {
      await api.delete(`/benutzer/${b.id}`);
      laden_();
    } catch (e) {
      alert(e.response?.data?.fehler || 'Fehler beim Löschen');
    }
  };

  const rolleLabel = (rolle) => rolle === 'admin' ? 'Administrator' : 'Schichtleiter';
  const rolleBadge = (rolle) => rolle === 'admin'
    ? 'bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded-full'
    : 'bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benutzerverwaltung</h1>
          <p className="text-gray-500 mt-1">Benutzer und Zugriffsrechte verwalten</p>
        </div>
        <button onClick={oeffneNeu} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Neuer Benutzer
        </button>
      </div>

      {/* Hinweis */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        <strong>Rollen:</strong> <strong>Administrator</strong> hat vollen Zugriff inkl. Benutzerverwaltung und Audit-Log.
        <strong> Schichtleiter</strong> kann Tagespläne, Abwesenheiten und Mitnahmeplanung bearbeiten, aber keine Benutzer verwalten.
      </div>

      {laden ? (
        <div className="text-center py-12 text-gray-400">Lade Benutzer...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Benutzername</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rolle</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Erstellt am</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benutzer.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        {b.rolle === 'admin'
                          ? <ShieldCheckIcon className="w-4 h-4 text-red-600" />
                          : <UserIcon className="w-4 h-4 text-blue-600" />
                        }
                      </div>
                      <span className="font-medium text-gray-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-mono text-sm">{b.benutzername}</td>
                  <td className="px-6 py-4">
                    <span className={rolleBadge(b.rolle)}>{rolleLabel(b.rolle)}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{formatDatum(b.erstellt_am?.split(' ')[0])}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => oeffneBearbeiten(b)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => loeschen(b)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOffen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {bearbeiten ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
              </h2>
            </div>
            <form onSubmit={speichern_} className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Name (Anzeigename)</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoComplete="off" />
              </div>
              {!bearbeiten && (
                <div>
                  <label className="label">Benutzername</label>
                  <input className="input" value={form.benutzername} onChange={e => setForm({ ...form, benutzername: e.target.value })} required autoComplete="off" />
                </div>
              )}
              <div>
                <label className="label">{bearbeiten ? 'Neues Passwort (leer = nicht ändern)' : 'Passwort'}</label>
                <input
                  type="password"
                  className="input"
                  value={form.passwort}
                  onChange={e => setForm({ ...form, passwort: e.target.value })}
                  required={!bearbeiten}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              <div>
                <label className="label">Rolle</label>
                <select className="input" value={form.rolle} onChange={e => setForm({ ...form, rolle: e.target.value })}>
                  <option value="schichtleiter">Schichtleiter</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              {fehler && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{fehler}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOffen(false)} className="btn-secondary">Abbrechen</button>
                <button type="submit" disabled={speichern} className="btn-primary">
                  {speichern ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
