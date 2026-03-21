import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowPathIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../utils/api';
import MonthPicker from '../components/MonthPicker';
import { SearchableSelect } from '../components/SearchableSelect';
import { useToast } from '../components/Toast';
import { feiertageFuerMonat } from '../utils/feiertage';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const STATUS_KUERZEL = {
  krank: 'K',
  urlaub: 'U',
  frei: 'Fr',
  kur: 'Kur',
  sonstige: 'So',
};

const STATUS_KLASSE = {
  krank: 'text-red-600 font-bold',
  urlaub: 'text-blue-600 font-bold',
  frei: 'text-gray-500 font-medium',
  kur: 'text-teal-600 font-semibold',
  sonstige: 'text-orange-600 font-medium',
};

const NAME_W = 200;
const DAY_W = 56;

function formatRayon(nummer) {
  if (nummer == null) return '';
  return String(nummer).padStart(4, '0');
}

// ─── Monatszuteilung-Edit-Modal ────────────────────────────────────────────────
function ZuteilungModal({ mitarbeiter, monat, onClose, onSaved }) {
  const toast = useToast();
  const [rayone, setRayone] = useState([]);
  const [neuerRayonId, setNeuerRayonId] = useState('');
  const [laden, setLaden] = useState(true);
  const [speichern, setSpeichern] = useState(false);

  useEffect(() => {
    api.get('/rayone').then(({ data }) => {
      setRayone(data);
      setLaden(false);
    });
  }, []);

  const handleSpeichern = async () => {
    if (!neuerRayonId) return;
    setSpeichern(true);
    try {
      await api.put(`/monatszuteilungen/${monat}/rayon/${neuerRayonId}`, {
        mitarbeiter_id: mitarbeiter.id,
        ist_teilzuteilung: 0,
      });
      toast('Monatszuteilung gespeichert', 'success');
      onSaved();
    } catch (e) {
      toast(e.response?.data?.fehler || 'Fehler beim Speichern', 'error');
    } finally {
      setSpeichern(false);
    }
  };

  const handleEntfernen = async () => {
    if (!mitarbeiter.rayon_id) return;
    setSpeichern(true);
    try {
      await api.delete(`/monatszuteilungen/${monat}/${mitarbeiter.id}`);
      toast('Zuteilung entfernt', 'info');
      onSaved();
    } catch {
      toast('Fehler beim Entfernen', 'error');
    } finally {
      setSpeichern(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Monatszuteilung</h3>
            <p className="text-xs text-gray-400 mt-0.5">{mitarbeiter.name} · {monat}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {mitarbeiter.rayon_nummer && (
            <div className="text-sm text-gray-600">
              Aktuell: <span className="font-semibold text-gray-900">{formatRayon(mitarbeiter.rayon_nummer)}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neuer Rayon</label>
            {laden ? (
              <div className="text-sm text-gray-400">Laden...</div>
            ) : (
              <SearchableSelect
                options={rayone.map(r => ({ id: r.id, label: `${String(r.nummer).padStart(4,'0')} – ${r.bezeichnung}` }))}
                value={neuerRayonId}
                onChange={setNeuerRayonId}
                emptyLabel="– Rayon auswählen –"
                searchPlaceholder="Rayon suchen..."
              />
            )}
          </div>
          <div className="flex gap-2 pt-1">
            {mitarbeiter.rayon_id && (
              <button
                onClick={handleEntfernen}
                disabled={speichern}
                className="btn-danger text-sm py-1.5 px-3"
              >
                Entfernen
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-3">Abbrechen</button>
            <button
              onClick={handleSpeichern}
              disabled={!neuerRayonId || speichern}
              className="btn-primary text-sm py-1.5 px-3"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DienstplanGrid() {
  const [monat, setMonat] = useState(() => new Date().toISOString().substring(0, 7));
  const [daten, setDaten] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMitarbeiter, setEditMitarbeiter] = useState(null);
  const feiertage = feiertageFuerMonat(monat);

  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  const ladeDaten = useCallback(async (m) => {
    setLoading(true);
    try {
      const resp = await api.get('/dienstplan/grid?monat=' + m);
      setDaten(resp.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { ladeDaten(monat); }, [monat, ladeDaten]);

  // Sync horizontal scroll: body drives header
  useEffect(() => {
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener('scroll', sync, { passive: true });
    return () => body.removeEventListener('scroll', sync);
  }, [daten]);

  const totalW = daten ? NAME_W + daten.tage.length * DAY_W : NAME_W;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">

      {/* ── Sticky header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">

        {/* Title row */}
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-2 flex items-center gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Grid</h1>
            <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
              <span className="text-gray-400">Codes:</span>
              <span className="text-red-600 font-bold">K</span>
              <span className="text-gray-600">Krank</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-blue-600 font-bold">U</span>
              <span className="text-gray-600">Urlaub</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-teal-600 font-semibold">Kur</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-blue-800 font-semibold">SA1&ndash;SA8</span>
              <span className="mx-1 text-gray-300">&middot;</span>
              <span className="text-purple-600 font-medium">Abweichung</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MonthPicker value={monat} onChange={setMonat} mode="month" />
            <button
              onClick={() => ladeDaten(monat)}
              disabled={loading}
              title="Aktualisieren"
              className="p-2 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-40"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Day column headers */}
        <div className="overflow-x-hidden" ref={headerScrollRef}>
          <div style={{ width: totalW, display: 'flex' }}>
            <div
              className="sticky left-0 z-10 bg-gray-100 border-r border-b border-gray-200 flex items-center px-3 text-xs font-semibold text-gray-600 shrink-0"
              style={{ width: NAME_W, minWidth: NAME_W, height: 44 }}
            >
              Mitarbeiter
            </div>
            {daten?.tage.map(t => {
              const istFeiertag = !!feiertage[t.datum];
              return (
                <div
                  key={t.datum}
                  title={feiertage[t.datum] || undefined}
                  className={`border-b border-r border-gray-200 flex flex-col items-center justify-center text-xs font-semibold shrink-0 ${
                    t.wochentag === 0
                      ? 'text-red-600 bg-red-100 font-bold'
                      : t.wochentag === 6
                      ? 'text-amber-700 bg-amber-100 font-bold'
                      : istFeiertag
                      ? 'text-yellow-700 bg-yellow-100 font-bold'
                      : 'text-gray-600 bg-gray-100'
                  }`}
                  style={{ width: DAY_W, minWidth: DAY_W, height: 44 }}
                >
                  <span>{t.tag}</span>
                  <span className="font-normal text-gray-400">{WOCHENTAG[t.wochentag]}</span>
                  {istFeiertag && <span className="text-yellow-400 text-[8px] leading-none">●</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile scroll hint */}
      <div className="md:hidden px-4 py-1 text-xs text-gray-400 text-center bg-gray-50 border-b border-gray-100">
        ← Nach links/rechts scrollen →
      </div>

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <div className="overflow-x-auto" ref={bodyScrollRef}>
        <div style={{ width: totalW }}>
          {loading && !daten && (
            <div className="text-center py-12 text-gray-400">Laden...</div>
          )}
          {daten?.mitarbeiter.map(m => (
            <div key={m.id} className="flex border-b border-gray-100 hover:bg-yellow-50/40 group">
              <div
                className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 flex flex-col justify-center shrink-0 cursor-pointer hover:bg-yellow-50"
                style={{ width: NAME_W, minWidth: NAME_W, height: 48 }}
                onClick={() => setEditMitarbeiter(m)}
                title="Monatszuteilung bearbeiten"
              >
                <div className="flex items-center gap-1">
                  <div className="text-sm font-medium text-gray-900 truncate flex-1">{m.name}</div>
                  <PencilSquareIcon className="w-3 h-3 text-gray-300 group-hover:text-yellow-500 shrink-0" />
                </div>
                <div className="text-xs text-gray-400">{m.personalnummer}</div>
              </div>
              {daten.tage.map(t => {
                const abw = m.abwesenheiten[t.datum];
                // Tagesplan hat Vorrang vor Monatszuteilung
                const tpRayon = m.tagesplan?.[t.datum];
                const wert = abw
                  ? STATUS_KUERZEL[abw] || abw
                  : tpRayon != null
                  ? formatRayon(tpRayon)
                  : m.rayon_nummer && t.wochentag !== 0 && t.wochentag !== 6
                  ? formatRayon(m.rayon_nummer)
                  : null;
                const klasse = abw
                  ? (STATUS_KLASSE[abw] || 'text-gray-500')
                  : tpRayon != null && tpRayon !== m.rayon_nummer
                  ? 'text-purple-600 font-medium'
                  : 'text-gray-700';

                const istFeiertag = !!feiertage[t.datum];
                return (
                  <div
                    key={t.datum}
                    className={`flex items-center justify-center text-xs shrink-0 border-r border-gray-100 ${
                      t.wochentag === 0 ? 'bg-red-100/60' : t.wochentag === 6 ? 'bg-amber-50/60' : istFeiertag ? 'bg-yellow-50/70' : ''
                    }`}
                    style={{ width: DAY_W, minWidth: DAY_W, height: 48 }}
                  >
                    {wert && <span className={klasse}>{wert}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editMitarbeiter && (
        <ZuteilungModal
          mitarbeiter={editMitarbeiter}
          monat={monat}
          onClose={() => setEditMitarbeiter(null)}
          onSaved={() => { setEditMitarbeiter(null); ladeDaten(monat); }}
        />
      )}
    </div>
  );
}
