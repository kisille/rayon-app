import os

BASE = os.path.dirname(os.path.abspath(__file__))

# ─── 1. backend/server.js ────────────────────────────────────────────────────

GRID_ENDPOINT = '''// ─── Dienstplan-Grid ──────────────────────────────────────────────────────────
app.get('/api/dienstplan/grid', authMiddleware, (req, res) => {
  const { monat } = req.query;
  if (!monat || !/^\\d{4}-\\d{2}$/.test(monat)) {
    return res.status(400).json({ fehler: 'Gültiger Monat erforderlich (YYYY-MM)' });
  }
  const db = getDb();
  const mitarbeiter = db.prepare(
    'SELECT id, name, personalnummer FROM mitarbeiter WHERE aktiv = 1 ORDER BY name'
  ).all();
  const zuteilungen = db.prepare(`
    SELECT mz.mitarbeiter_id, r.nummer as rayon_nummer
    FROM monatszuteilungen mz
    JOIN rayone r ON mz.rayon_id = r.id
    WHERE mz.monat = ? AND mz.ist_teilzuteilung = 0
  `).all(monat);
  const zuteilungMap = {};
  for (const z of zuteilungen) zuteilungMap[z.mitarbeiter_id] = z.rayon_nummer;
  const abwesenheiten = db.prepare(
    'SELECT mitarbeiter_id, datum, status FROM abwesenheiten WHERE datum LIKE ?'
  ).all(`${monat}%`);
  const abwesenheitMap = {};
  for (const a of abwesenheiten) {
    if (!abwesenheitMap[a.mitarbeiter_id]) abwesenheitMap[a.mitarbeiter_id] = {};
    abwesenheitMap[a.mitarbeiter_id][a.datum] = a.status;
  }
  const [jahr, mon] = monat.split('-').map(Number);
  const tageImMonat = new Date(jahr, mon, 0).getDate();
  const tage = [];
  for (let d = 1; d <= tageImMonat; d++) {
    const datum = `${monat}-${String(d).padStart(2, '0')}`;
    tage.push({ datum, tag: d, wochentag: new Date(datum + 'T00:00:00').getDay() });
  }
  res.json({
    monat, tage,
    mitarbeiter: mitarbeiter.map(m => ({
      id: m.id, name: m.name, personalnummer: m.personalnummer,
      rayon_nummer: zuteilungMap[m.id] || null,
      abwesenheiten: abwesenheitMap[m.id] || {},
    })),
  });
});

'''

server_path = os.path.join(BASE, 'backend', 'server.js')
with open(server_path, 'r', encoding='utf-8') as f:
    content = f.read()

MARKER = '// ─── Dienstplan-Import'
if '/api/dienstplan/grid' in content:
    print('✓ backend/server.js: Grid-Endpoint bereits vorhanden, übersprungen.')
else:
    content = content.replace(MARKER, GRID_ENDPOINT + MARKER, 1)
    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✓ backend/server.js: Grid-Endpoint eingefügt.')

# ─── 2. frontend/src/pages/DienstplanGrid.jsx ────────────────────────────────

DIENSTPLAN_GRID_JSX = r'''import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const STATUS_KUERZEL = {
  krank: 'K',
  urlaub: 'U',
  frei: 'Fr',
  sonstige: 'So',
};

const STATUS_KLASSE = {
  krank: 'text-red-600 font-bold',
  urlaub: 'text-blue-600 font-bold',
  frei: 'text-gray-500 font-medium',
  sonstige: 'text-orange-600 font-medium',
};

function formatRayon(nummer) {
  if (nummer == null) return '';
  return String(nummer).padStart(4, '0');
}

export default function DienstplanGrid() {
  const [monat, setMonat] = useState(() => new Date().toISOString().substring(0, 7));
  const [daten, setDaten] = useState(null);
  const [loading, setLoading] = useState(false);

  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  const ladeDaten = useCallback(async (m) => {
    setLoading(true);
    try {
      const resp = await api.get(`/dienstplan/grid?monat=${m}`);
      setDaten(resp.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { ladeDaten(monat); }, [monat, ladeDaten]);

  useEffect(() => {
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener('scroll', sync, { passive: true });
    return () => body.removeEventListener('scroll', sync);
  }, [daten]);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-2 flex items-center gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Grid</h1>
            <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
              <span className="text-gray-400">Codes:</span>
              <span className="text-red-600 font-bold">K</span>
              <span className="text-gray-600">Krank</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-blue-600 font-bold">U</span>
              <span className="text-gray-600">Urlaub</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-teal-600 font-semibold">Kur</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-blue-800 font-semibold">SA1-SA8</span>
            </div>
          </div>
          <div className="ml-auto">
            <input
              type="month"
              value={monat}
              onChange={e => setMonat(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white"
            />
          </div>
        </div>
        <div className="overflow-x-hidden" ref={headerScrollRef}>
          <table className="border-collapse w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-100 border-r border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600 w-48 min-w-[12rem]">
                  Mitarbeiter
                </th>
                {daten?.tage.map(t => (
                  <th
                    key={t.datum}
                    className={`border-b border-r border-gray-200 px-1 py-1.5 text-center text-xs font-semibold w-14 min-w-[3.5rem] ${
                      t.wochentag === 0
                        ? 'text-red-500 bg-red-50'
                        : t.wochentag === 6
                        ? 'text-orange-500 bg-orange-50'
                        : 'text-gray-600 bg-gray-100'
                    }`}
                  >
                    <div>{t.tag}</div>
                    <div className="font-normal text-gray-400">{WOCHENTAG[t.wochentag]}</div>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>
      <div className="overflow-x-auto" ref={bodyScrollRef}>
        <table className="border-collapse w-max">
          <colgroup>
            <col style={{ width: '12rem', minWidth: '12rem' }} />
            {daten?.tage.map(t => (
              <col key={t.datum} style={{ width: '3.5rem', minWidth: '3.5rem' }} />
            ))}
          </colgroup>
          <tbody>
            {loading && !daten && (
              <tr>
                <td colSpan={32} className="text-center py-12 text-gray-400">Laden...</td>
              </tr>
            )}
            {daten?.mitarbeiter.map(m => (
              <tr key={m.id} className="hover:bg-yellow-50/40 border-b border-gray-100">
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5">
                  <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                  <div className="text-xs text-gray-400">{m.personalnummer}</div>
                </td>
                {daten.tage.map(t => {
                  const abw = m.abwesenheiten[t.datum];
                  const wert = abw
                    ? STATUS_KUERZEL[abw] || abw
                    : m.rayon_nummer && t.wochentag !== 0
                    ? formatRayon(m.rayon_nummer)
                    : null;
                  const klasse = abw ? (STATUS_KLASSE[abw] || 'text-gray-500') : 'text-gray-700';
                  return (
                    <td
                      key={t.datum}
                      className={`border-r border-gray-100 px-1 py-1.5 text-center text-xs ${
                        t.wochentag === 0 ? 'bg-red-50/40' : t.wochentag === 6 ? 'bg-orange-50/30' : ''
                      }`}
                    >
                      {wert && <span className={klasse}>{wert}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
'''

grid_path = os.path.join(BASE, 'frontend', 'src', 'pages', 'DienstplanGrid.jsx')
with open(grid_path, 'w', encoding='utf-8') as f:
    f.write(DIENSTPLAN_GRID_JSX)
print('✓ frontend/src/pages/DienstplanGrid.jsx: erstellt.')

# ─── 3. frontend/src/App.jsx ─────────────────────────────────────────────────

app_path = os.path.join(BASE, 'frontend', 'src', 'App.jsx')
with open(app_path, 'r', encoding='utf-8') as f:
    app = f.read()

if 'DienstplanGrid' not in app:
    app = app.replace(
        "import DienstplanImport from './pages/DienstplanImport.jsx';",
        "import DienstplanImport from './pages/DienstplanImport.jsx';\nimport DienstplanGrid from './pages/DienstplanGrid.jsx';"
    )
    app = app.replace(
        '<Route path="dienstplan-import" element={<DienstplanImport />} />',
        '<Route path="dienstplan-import" element={<DienstplanImport />} />\n            <Route path="dienstplan-grid" element={<DienstplanGrid />} />'
    )
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app)
    print('✓ frontend/src/App.jsx: Route eingefügt.')
else:
    print('✓ frontend/src/App.jsx: bereits aktuell, übersprungen.')

# ─── 4. frontend/src/components/Layout.jsx ───────────────────────────────────

layout_path = os.path.join(BASE, 'frontend', 'src', 'components', 'Layout.jsx')
with open(layout_path, 'r', encoding='utf-8') as f:
    layout = f.read()

if 'TableCellsIcon' not in layout:
    layout = layout.replace(
        '  ClipboardDocumentListIcon,\n} from',
        '  ClipboardDocumentListIcon,\n  TableCellsIcon,\n} from'
    )
    layout = layout.replace(
        "{ name: 'Fahrzeuge', href: '/fahrzeuge', icon: TruckIcon },",
        "{ name: 'Fahrzeuge', href: '/fahrzeuge', icon: TruckIcon },\n  { name: 'Dienstplan-Grid', href: '/dienstplan-grid', icon: TableCellsIcon },"
    )
    with open(layout_path, 'w', encoding='utf-8') as f:
        f.write(layout)
    print('✓ frontend/src/components/Layout.jsx: Navigation eingefügt.')
else:
    print('✓ frontend/src/components/Layout.jsx: bereits aktuell, übersprungen.')

# ─── Fahrzeuge modal fix ──────────────────────────────────────────────────────

fahrzeuge_path = os.path.join(BASE, 'frontend', 'src', 'pages', 'Fahrzeuge.jsx')
with open(fahrzeuge_path, 'r', encoding='utf-8') as f:
    fz = f.read()

OLD = '<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">'
NEW = '<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOffen(false)}>'
OLD_INNER = '<div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">'
NEW_INNER = '<div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>'

changed = False
if OLD in fz:
    fz = fz.replace(OLD, NEW, 1)
    changed = True
if OLD_INNER in fz:
    fz = fz.replace(OLD_INNER, NEW_INNER, 1)
    changed = True

if changed:
    with open(fahrzeuge_path, 'w', encoding='utf-8') as f:
        f.write(fz)
    print('✓ frontend/src/pages/Fahrzeuge.jsx: Modal-Fix angewendet.')
else:
    print('✓ frontend/src/pages/Fahrzeuge.jsx: Modal bereits gefixt, übersprungen.')

print('\nAlle Änderungen angewendet!')
print('Jetzt ausführen: cd frontend && npm run build && cd .. && ./starten.sh')
