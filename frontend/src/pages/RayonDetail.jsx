import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PencilIcon, CheckIcon, XMarkIcon, UserPlusIcon, MagnifyingGlassIcon, TrashIcon, PlusIcon, MapIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { kompetenzLabel, kompetenzBadgeClass } from '../utils/helpers.js';

export default function RayonDetail() {
  const { id } = useParams();
  const [rayon, setRayon] = useState(null);
  const [laden, setLaden] = useState(true);
  const [bearbeiteModus, setBearbeiteModus] = useState(false);
  const [formDaten, setFormDaten] = useState({});
  const [zuweisungsModalOffen, setZuweisungsModalOffen] = useState(false);
  const [kompetenzModalLevel, setKompetenzModalLevel] = useState(null); // 1 oder 2

  const monat = new Date().toISOString().substring(0, 7);

  const laden_ = async () => {
    const { data } = await api.get(`/rayone/${id}`, { params: { monat } });
    setRayon(data);
    setFormDaten({
      bezeichnung: data.bezeichnung,
      gebiet: data.gebiet || '',
      priorität: data.priorität ?? 'normal',
    });
    setLaden(false);
  };

  useEffect(() => { laden_(); }, [id]);

  const handleSpeichern = async () => {
    await api.put(`/rayone/${id}`, formDaten);
    await laden_();
    setBearbeiteModus(false);
  };

  if (laden || !rayon) return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;

  const aktuellebesetzung = rayon.aktuelle_besetzung || [];
  const stammBesetzung = rayon.stamm_besetzung || [];
  const vertreterLevel2 = rayon.mitarbeiter?.filter(m => m.level === 2) || [];
  const vertreterLevel3 = rayon.mitarbeiter?.filter(m => m.level === 3) || [];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/rayone" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          {bearbeiteModus ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapIcon className="w-5 h-5 text-yellow-600" />
                </div>
                <input
                  className="input text-xl font-bold max-w-xs"
                  placeholder="Rayonname / -nummer"
                  value={formDaten.bezeichnung}
                  onChange={(e) => setFormDaten({ ...formDaten, bezeichnung: e.target.value })}
                  autoComplete="new-password"
                />
                <button onClick={handleSpeichern} className="text-green-600 hover:text-green-700">
                  <CheckIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setBearbeiteModus(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <input
                className="input text-sm max-w-xs"
                placeholder="Ort/e (Gebiet)"
                value={formDaten.gebiet}
                onChange={(e) => setFormDaten({ ...formDaten, gebiet: e.target.value })}
                autoComplete="new-password"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Priorität:</label>
                <div className="flex gap-1">
                  {[
                    { value: 'wenig', label: 'Wenig', cls: 'bg-gray-200 text-gray-700', activeCls: 'bg-gray-500 text-white' },
                    { value: 'normal', label: 'Normal', cls: 'bg-yellow-100 text-yellow-800', activeCls: 'bg-yellow-400 text-gray-900' },
                    { value: 'hoch', label: 'Hoch', cls: 'bg-red-100 text-red-700', activeCls: 'bg-red-500 text-white' },
                  ].map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormDaten({ ...formDaten, priorität: p.value })}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${formDaten.priorität === p.value ? p.activeCls : p.cls + ' hover:opacity-80'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapIcon className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{rayon.bezeichnung}</h1>
                  <button onClick={() => setBearbeiteModus(true)} className="text-gray-400 hover:text-yellow-600">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                </div>
                {rayon.gebiet && <p className="text-gray-500 mt-0.5">{rayon.gebiet}</p>}
                {stammBesetzung.length > 0 && (
                  <p className="text-xs text-green-700 mt-0.5">
                    Stammzusteller: {stammBesetzung.map(s => s.mitarbeiter_name).join(', ')}
                  </p>
                )}
                <p className="text-xs mt-0.5">
                  {(() => {
                    const p = rayon.priorität || 'normal';
                    const cfg = { wenig: 'text-gray-400', normal: 'text-yellow-600', hoch: 'text-red-500 font-medium' };
                    return <span className={cfg[p] || 'text-gray-400'}>Priorität: {p.charAt(0).toUpperCase() + p.slice(1)}</span>;
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Aktuelle Besetzung */}
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-green-800">Aktuell besetzt</h3>
            <button
              onClick={() => setZuweisungsModalOffen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium transition-colors"
              title="Anderen Mitarbeiter zuweisen"
            >
              <UserPlusIcon className="w-3.5 h-3.5" />
              Zuweisen
            </button>
          </div>
          {aktuellebesetzung.length === 0 ? (
            <p className="text-gray-400 text-sm italic">Nicht besetzt</p>
          ) : (
            <div className="space-y-2">
              {aktuellebesetzung.map((b) => (
                <div key={b.mitarbeiter_id} className="flex items-center gap-2 text-sm group">
                  <Link
                    to={`/mitarbeiter/${b.mitarbeiter_id}`}
                    className="flex items-center gap-2 flex-1 hover:underline"
                  >
                    <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center border border-gray-200 text-xs font-semibold text-gray-700 flex-shrink-0">
                      {b.mitarbeiter_name?.charAt(0)}
                    </div>
                    <div>
                      <span className="text-gray-800">{b.mitarbeiter_name}</span>
                      {b.ist_teilzuteilung ? (
                        <span className="ml-1 text-xs text-yellow-600">(teilw.)</span>
                      ) : null}
                    </div>
                  </Link>
                  <button
                    onClick={async () => {
                      await api.delete(`/monatszuteilungen/${monat}/${b.mitarbeiter_id}/${parseInt(id)}`);
                      // Auch heutigen Tagesplan-Eintrag für diesen Rayon leeren,
                      // damit der Mitarbeiter nicht weiter als "heute" angezeigt wird
                      const heute = new Date().toISOString().split('T')[0];
                      await api.post(`/tagesplan/${heute}/speichern`, {
                        eintraege: [{
                          rayon_id: parseInt(id),
                          mitarbeiter_id: null,
                          ist_vertretung: false,
                          ist_teilbesetzung: false,
                          vertritt_mitarbeiter_id: null,
                          teilmitnahmen: [],
                        }],
                      });
                      await laden_();
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Aus Rayon entfernen"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vertreter Level 2 */}
        <MitarbeiterGruppe
          titel="Sehr gut (Level 2)"
          mitarbeiter={vertreterLevel2}
          farbe="blue"
          onHinzufuegen={() => setKompetenzModalLevel(2)}
          rayonId={parseInt(id)}
          onEntfernen={laden_}
        />

        {/* Vertreter Level 3 */}
        <MitarbeiterGruppe
          titel="Geht so (Level 3)"
          mitarbeiter={vertreterLevel3}
          farbe="orange"
          onHinzufuegen={() => setKompetenzModalLevel(3)}
          rayonId={parseInt(id)}
          onEntfernen={laden_}
        />
      </div>

      {/* Zuweisungs-Modal */}
      {zuweisungsModalOffen && (
        <ZuweisungsModal
          rayonId={parseInt(id)}
          monat={monat}
          onClose={() => setZuweisungsModalOffen(false)}
          onSaved={() => { setZuweisungsModalOffen(false); laden_(); }}
        />
      )}

      {/* Kompetenz hinzufügen Modal */}
      {kompetenzModalLevel && (
        <KompetenzHinzufuegenModal
          rayonId={parseInt(id)}
          level={kompetenzModalLevel}
          vorhandene={rayon.mitarbeiter || []}
          onClose={() => setKompetenzModalLevel(null)}
          onSaved={() => { setKompetenzModalLevel(null); laden_(); }}
        />
      )}
    </div>
  );
}

function ZuweisungsModal({ rayonId, monat, onClose, onSaved }) {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [suche, setSuche] = useState('');
  const [ausgewaehlt, setAusgewaehlt] = useState('');
  const [istTeilzuteilung, setIstTeilzuteilung] = useState(false);
  const [speichern, setSpeichern] = useState(false);
  const [fehler, setFehler] = useState('');
  const [kannErzwingen, setKannErzwingen] = useState(false);

  useEffect(() => {
    api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data));
  }, []);

  const gefiltert = mitarbeiter.filter(m =>
    m.name.toLowerCase().includes(suche.toLowerCase()) ||
    m.personalnummer.includes(suche)
  );

  const handleSpeichern = async (force = false) => {
    if (!ausgewaehlt) return;
    setSpeichern(true);
    setFehler('');
    setKannErzwingen(false);
    try {
      await api.put(`/monatszuteilungen/${monat}/rayon/${rayonId}`, {
        mitarbeiter_id: parseInt(ausgewaehlt),
        ist_teilzuteilung: istTeilzuteilung ? 1 : 0,
        force,
      });
      // Auch Tagesplan für heute aktualisieren
      const heute = new Date().toISOString().split('T')[0];
      await api.post(`/tagesplan/${heute}/speichern`, {
        eintraege: [{
          rayon_id: rayonId,
          mitarbeiter_id: parseInt(ausgewaehlt),
          ist_vertretung: false,
          ist_teilbesetzung: istTeilzuteilung,
          vertritt_mitarbeiter_id: null,
          teilmitnahmen: [],
        }],
      });
      onSaved();
    } catch (err) {
      const data = err?.response?.data;
      setFehler(data?.fehler || 'Speichern fehlgeschlagen');
      setKannErzwingen(!!data?.kannErzwingen);
      setSpeichern(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Mitarbeiter zuweisen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="Name oder Personalnummer suchen..."
              value={suche}
              onChange={e => setSuche(e.target.value)}
              autoFocus
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              readOnly
              onFocus={e => { e.target.readOnly = false; }}
            />
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            {gefiltert.map(m => (
              <div
                key={m.id}
                onClick={() => { setAusgewaehlt(String(m.id)); setFehler(''); setKannErzwingen(false); }}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${
                  ausgewaehlt === String(m.id) ? 'bg-yellow-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  ausgewaehlt === String(m.id) ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300'
                }`}>
                  {ausgewaehlt === String(m.id) && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-400">Nr. {m.personalnummer}</div>
                </div>
              </div>
            ))}
            {gefiltert.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">Keine Mitarbeiter gefunden</div>
            )}
          </div>
        </div>
        <div className="px-5 pb-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={istTeilzuteilung}
              onChange={(e) => setIstTeilzuteilung(e.target.checked)}
              className="rounded"
            />
            Teilbesetzung (zusätzlich zu bestehendem Rayon)
          </label>
          {fehler && (
            <div className="mt-2 space-y-1">
              <div className="text-red-600 text-sm">{fehler}</div>
              {kannErzwingen && (
                <button
                  onClick={() => handleSpeichern(true)}
                  className="text-sm text-orange-600 hover:text-orange-800 font-medium underline"
                >
                  Trotzdem zuweisen (bisherige Ganzmitnahme ersetzen)
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button
            onClick={() => handleSpeichern(false)}
            disabled={!ausgewaehlt || speichern}
            className="btn-primary disabled:opacity-50"
          >
            {speichern ? 'Speichere...' : 'Zuweisen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function KompetenzHinzufuegenModal({ rayonId, level, vorhandene, onClose, onSaved }) {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [suche, setSuche] = useState('');
  const [ausgewaehlt, setAusgewaehlt] = useState('');
  const [speichern, setSpeichern] = useState(false);

  useEffect(() => {
    api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data));
  }, []);

  const vorhandeneIds = new Set(vorhandene.map(m => m.id));
  const gefiltert = mitarbeiter.filter(m =>
    !vorhandeneIds.has(m.id) &&
    (m.name.toLowerCase().includes(suche.toLowerCase()) || m.personalnummer.includes(suche))
  );

  const handleSpeichern = async () => {
    if (!ausgewaehlt) return;
    setSpeichern(true);
    await api.post('/kompetenzen', { mitarbeiter_id: parseInt(ausgewaehlt), rayon_id: rayonId, level });
    onSaved();
  };

  const levelLabel = level === 1 ? 'Level 1 – Stamm' : level === 2 ? 'Level 2 – Sehr gut' : 'Level 3 – Geht so';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Mitarbeiter hinzufügen – {levelLabel}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" className="input pl-9 text-sm" placeholder="Name oder Personalnummer suchen..."
              value={suche} onChange={e => setSuche(e.target.value)} autoFocus
              autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              data-lpignore="true" data-form-type="other"
              readOnly onFocus={e => { e.target.readOnly = false; }} />
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            {gefiltert.map(m => (
              <div key={m.id} onClick={() => setAusgewaehlt(String(m.id))}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${ausgewaehlt === String(m.id) ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ausgewaehlt === String(m.id) ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300'}`}>
                  {ausgewaehlt === String(m.id) && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-400">Nr. {m.personalnummer}</div>
                </div>
              </div>
            ))}
            {gefiltert.length === 0 && <div className="text-center py-4 text-gray-400 text-sm">Keine weiteren Mitarbeiter</div>}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={handleSpeichern} disabled={!ausgewaehlt || speichern} className="btn-primary disabled:opacity-50">
            {speichern ? 'Speichere...' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MitarbeiterGruppe({ titel, mitarbeiter, farbe, onHinzufuegen, rayonId, onEntfernen }) {
  const farben = {
    blue: 'border-blue-200 bg-blue-50',
    orange: 'border-orange-200 bg-orange-50',
  };
  const titelFarben = {
    blue: 'text-blue-800',
    orange: 'text-orange-800',
  };
  const btnFarben = {
    blue: 'bg-blue-100 hover:bg-blue-200 text-blue-700',
    orange: 'bg-orange-100 hover:bg-orange-200 text-orange-700',
  };

  const monat = new Date().toISOString().substring(0, 7);

  return (
    <div className={`rounded-xl border-2 ${farben[farbe]} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-sm ${titelFarben[farbe]}`}>{titel}</h3>
        {onHinzufuegen && (
          <button onClick={onHinzufuegen}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${btnFarben[farbe]}`}>
            <PlusIcon className="w-3.5 h-3.5" />
            Hinzufügen
          </button>
        )}
      </div>
      {mitarbeiter.length === 0 ? (
        <p className="text-gray-400 text-sm italic">Niemand erfasst</p>
      ) : (
        <div className="space-y-2">
          {mitarbeiter.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm group">
              <Link to={`/mitarbeiter/${m.id}`} className="flex items-center gap-2 flex-1 hover:underline">
                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center border border-gray-200 text-xs font-semibold text-gray-700 flex-shrink-0">
                  {m.name.charAt(0)}
                </div>
                <span className="text-gray-800">{m.name}</span>
              </Link>
              {onEntfernen && (
                <button
                  onClick={async () => {
                    await api.delete(`/kompetenzen/${m.id}/${rayonId}`);
                    onEntfernen();
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  title="Entfernen"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
