#!/usr/bin/env python3
"""patch4.py – Rayon-App: Toast, ConfirmDialog, Feiertage, Kur-Status, DienstplanGrid, Fahrzeug-Kennzeichen, Paginierung"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def write_file(rel_path, content):
    path = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK   {rel_path}")

def patch_file(rel_path, old, new):
    path = os.path.join(BASE, rel_path)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if old not in content:
        if new in content:
            print(f"  SKIP {rel_path} (bereits aktuell)")
            return True
        print(f"  FAIL {rel_path} (Zielstring nicht gefunden)")
        return False
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK   {rel_path}")
    return True

print("=== patch4.py – Rayon-App Verbesserungen ===")
print()
# ── Neue / komplett erneuerte Dateien schreiben ──────────────────────────────
write_file('frontend/src/components/Toast.jsx', '''\
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />,
  error:   <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 shrink-0" />,
  info:    <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0" />,
};

const BORDER = {
  success: 'border-green-200',
  error:   'border-red-200',
  warning: 'border-yellow-200',
  info:    'border-blue-200',
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-3 bg-white border ${BORDER[t.type]} rounded-xl shadow-lg px-4 py-3 min-w-72 max-w-sm pointer-events-auto animate-[fadeInUp_0.2s_ease]`}
          >
            {ICONS[t.type]}
            <span className="text-sm text-gray-800 flex-1 leading-snug">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-gray-500 shrink-0 -mr-1">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

''')

write_file('frontend/src/components/ConfirmDialog.jsx', '''\
import React, { createContext, useContext, useState, useCallback } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { message, resolve }

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setDialog({ message, resolve });
    });
  }, []);

  const handleClose = (result) => {
    if (dialog) dialog.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-gray-800 leading-relaxed pt-1.5">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => handleClose(false)}
              >
                Abbrechen
              </button>
              <button
                className="btn-danger"
                onClick={() => handleClose(true)}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

''')

write_file('frontend/src/utils/feiertage.js', '''\
// Österreichische gesetzliche Feiertage
// Basiert auf dem Gregorianischen Kalender + Gaußsche Osterformel

function ostersonntag(jahr) {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d) {
  return d.toISOString().split('T')[0];
}

export function feiertageFuerJahr(jahr) {
  const oster = ostersonntag(jahr);
  const feiertage = {
    [fmt(new Date(jahr, 0, 1))]:   'Neujahr',
    [fmt(new Date(jahr, 0, 6))]:   'Heilige Drei Könige',
    [fmt(addDays(oster, -2))]:     'Karfreitag',
    [fmt(oster)]:                  'Ostersonntag',
    [fmt(addDays(oster, 1))]:      'Ostermontag',
    [fmt(new Date(jahr, 4, 1))]:   'Staatsfeiertag',
    [fmt(addDays(oster, 39))]:     'Christi Himmelfahrt',
    [fmt(addDays(oster, 49))]:     'Pfingstsonntag',
    [fmt(addDays(oster, 50))]:     'Pfingstmontag',
    [fmt(addDays(oster, 60))]:     'Fronleichnam',
    [fmt(new Date(jahr, 7, 15))]:  'Maria Himmelfahrt',
    [fmt(new Date(jahr, 9, 26))]:  'Nationalfeiertag',
    [fmt(new Date(jahr, 10, 1))]:  'Allerheiligen',
    [fmt(new Date(jahr, 11, 8))]:  'Maria Empfängnis',
    [fmt(new Date(jahr, 11, 25))]: 'Weihnachten',
    [fmt(new Date(jahr, 11, 26))]: 'Stephanitag',
  };
  return feiertage;
}

export function feiertageFuerMonat(monat) {
  const jahr = parseInt(monat.split('-')[0]);
  return feiertageFuerJahr(jahr);
}

''')

write_file('frontend/src/utils/helpers.js', '''\
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function formatDatum(datum) {
  if (!datum) return '';
  try {
    return format(parseISO(datum), 'dd.MM.yyyy', { locale: de });
  } catch {
    return datum;
  }
}

export function formatDatumLang(datum) {
  if (!datum) return '';
  try {
    return format(parseISO(datum), 'EEEE, dd. MMMM yyyy', { locale: de });
  } catch {
    return datum;
  }
}

export function heuteDatum() {
  return new Date().toISOString().split('T')[0];
}

export function statusLabel(status) {
  const labels = {
    anwesend: 'Anwesend',
    krank: 'Krank',
    urlaub: 'Urlaub',
    frei: 'Frei',
    kur: 'Kur',
    sonstige: 'Sonstige Abwesenheit',
  };
  return labels[status] || status;
}

export function statusBadgeClass(status) {
  const classes = {
    anwesend: 'badge-stamm',
    krank: 'badge-krank',
    urlaub: 'badge-urlaub',
    frei: 'badge-frei',
    kur: 'badge-kur',
    sonstige: 'bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded-full',
  };
  return classes[status] || 'bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full';
}

export function kompetenzLabel(level) {
  const labels = {
    1: 'Stamm',
    2: 'Sehr gut',
    3: 'Geht so',
  };
  return labels[level] || `Level ${level}`;
}

export function kompetenzBadgeClass(level) {
  const classes = {
    1: 'bg-green-100 text-green-800',
    2: 'bg-blue-100 text-blue-800',
    3: 'bg-orange-100 text-orange-800',
  };
  return `text-xs font-semibold px-2.5 py-0.5 rounded-full ${classes[level] || 'bg-gray-100 text-gray-800'}`;
}

''')

write_file('frontend/src/index.css', '''\
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 font-sans;
  }
}

@layer components {
  .btn-primary {
    @apply bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg transition-colors duration-150 shadow-sm;
  }
  .btn-secondary {
    @apply bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors duration-150 shadow-sm;
  }
  .btn-danger {
    @apply bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-150 shadow-sm;
  }
  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-100 p-6;
  }
  .input {
    @apply w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-150;
    color-scheme: light;
  }
  .label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }
  .badge-stamm {
    @apply bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full;
  }
  .badge-vertretung {
    @apply bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full;
  }
  .badge-krank {
    @apply bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded-full;
  }
  .badge-urlaub {
    @apply bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full;
  }
  .badge-frei {
    @apply bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full;
  }
  .badge-kur {
    @apply bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-0.5 rounded-full;
  }
}

/* Touch-friendly tap targets – minimum 44px for interactive elements on mobile */
@media (max-width: 768px) {
  .btn-primary, .btn-secondary, .btn-danger {
    @apply min-h-[44px];
  }
  button, a[role="button"] {
    min-height: 36px;
  }
}

/* Force light color scheme for text inputs – prevents dark OS autocomplete/dropdown UI */
input[type="text"], input[type="search"], input[type="number"], input[type="email"], input[type="tel"], select, textarea {
  color-scheme: light;
}

/* Disable browser contact picker icons and autofill highlights globally */
input::-webkit-contacts-auto-fill-button,
input::-webkit-credentials-auto-fill-button,
input::-webkit-inner-spin-button,
input::-webkit-list-button {
  visibility: hidden;
  display: none !important;
  pointer-events: none;
  height: 0;
  width: 0;
  margin: 0;
}

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 30px white inset !important;
  box-shadow: 0 0 0 30px white inset !important;
  -webkit-text-fill-color: inherit !important;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }

  /* Sidebar und Navigation verstecken */
  nav, aside, header { display: none !important; }

  /* Seitenlayout für Druck */
  body { background: white !important; font-size: 11pt; }
  .card { box-shadow: none !important; border: 1px solid #ccc !important; border-radius: 4px !important; }

  /* Tabellen für Druck */
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; font-size: 10pt; }
  th { background: #f5f5f5 !important; font-weight: bold; }

  /* Seitenumbruch vermeiden */
  tr { page-break-inside: avoid; }

  /* Farben für Badges im Druck */
  .badge-stamm { background: #d1fae5 !important; color: #065f46 !important; }
  .badge-vertretung { background: #fef3c7 !important; color: #92400e !important; }
  .badge-krank { background: #fee2e2 !important; color: #991b1b !important; }
  .badge-urlaub { background: #dbeafe !important; color: #1e40af !important; }
  .badge-frei { background: #ede9fe !important; color: #5b21b6 !important; }
  .badge-kur { background: #ccfbf1 !important; color: #115e59 !important; }
}

''')

write_file('frontend/src/App.jsx', '''\
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Mitarbeiter from './pages/Mitarbeiter.jsx';
import MitarbeiterDetail from './pages/MitarbeiterDetail.jsx';
import Rayone from './pages/Rayone.jsx';
import RayonDetail from './pages/RayonDetail.jsx';
import Tagesplan from './pages/Tagesplan.jsx';
import Mitnahmeplanung from './pages/Mitnahmeplanung.jsx';
import Statistik from './pages/Statistik.jsx';
import Fahrzeuge from './pages/Fahrzeuge.jsx';
import DienstplanImport from './pages/DienstplanImport.jsx';
import DienstplanGrid from './pages/DienstplanGrid.jsx';
import Benutzer from './pages/Benutzer.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Jahreskalender from './pages/Jahreskalender.jsx';

// Auth-Kontext
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    const benutzer = localStorage.getItem('benutzer');
    return token ? { token, benutzer: JSON.parse(benutzer) } : null;
  });

  useEffect(() => {
    const disableAutocomplete = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.setAttribute('autocomplete', 'off');
        e.target.setAttribute('data-lpignore', 'true');
        e.target.setAttribute('data-form-type', 'other');
        e.target.setAttribute('data-1p-ignore', 'true');
        e.target.setAttribute('autocorrect', 'off');
        e.target.setAttribute('autocapitalize', 'off');
        // Safari iCloud-Kontaktvorschläge unterdrücken
        if (e.target.type === 'text') {
          e.target.setAttribute('role', 'combobox');
        }
      }
    };
    document.addEventListener('focus', disableAutocomplete, true);
    return () => document.removeEventListener('focus', disableAutocomplete, true);
  }, []);

  const login = (token, benutzer) => {
    localStorage.setItem('token', token);
    localStorage.setItem('benutzer', JSON.stringify(benutzer));
    setAuth({ token, benutzer });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('benutzer');
    setAuth(null);
  };

  return (
    <ToastProvider>
    <ConfirmProvider>
    <AuthContext.Provider value={{ auth, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!auth ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={auth ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="tagesplan" element={<Tagesplan />} />
            <Route path="mitnahme" element={<Mitnahmeplanung />} />
            <Route path="mitarbeiter" element={<Mitarbeiter />} />
            <Route path="mitarbeiter/:id" element={<MitarbeiterDetail />} />
            <Route path="rayone" element={<Rayone />} />
            <Route path="rayone/:id" element={<RayonDetail />} />
            <Route path="statistik" element={<Statistik />} />
            <Route path="fahrzeuge" element={<Fahrzeuge />} />
            <Route path="dienstplan-import" element={<DienstplanImport />} />
            <Route path="dienstplan-grid" element={<DienstplanGrid />} />
            <Route path="jahreskalender" element={<Jahreskalender />} />
            {/* Admin-only Seiten */}
            <Route path="benutzer" element={auth?.benutzer?.rolle === 'admin' ? <Benutzer /> : <Navigate to="/" />} />
            <Route path="audit-log" element={auth?.benutzer?.rolle === 'admin' ? <AuditLog /> : <Navigate to="/" />} />
            {/* Legacy-Redirect */}
            <Route path="vertretung" element={<Navigate to="/mitnahme" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
    </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;

''')

write_file('frontend/src/pages/DienstplanImport.jsx', '''\
import React, { useState } from 'react';
import api from '../utils/api';

function parseCSV(text) {
  const entries = [];
  const parseErrors = [];
  const lines = text.split('\\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/[;,\\t]/);
    if (parts.length < 2) { parseErrors.push(`Ungültige Zeile: "${line}"`); continue; }
    const pnr = parts[0].trim();
    const rawNum = parts[1].trim().replace(/^0+/, '') || '0';
    const num = parseInt(rawNum);
    if (isNaN(num)) { parseErrors.push(`Ungültige Rayon-Nummer in: "${line}"`); continue; }
    // Auf 10er runden
    const rayon_nummer = Math.round(num / 10) * 10;
    entries.push({ pnr, rayon_nummer });
  }
  return { entries, parseErrors };
}

export default function DienstplanImport() {
  const monat = new Date().toISOString().substring(0, 7);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [editableEntries, setEditableEntries] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [ersetzen, setErsetzen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePreview = () => {
    const { entries, parseErrors: errors } = parseCSV(csvText);
    setPreview(true);
    setEditableEntries(entries.map(e => ({ ...e })));
    setParseErrors(errors);
    setResult(null);
  };

  const handleEntryChange = (i, field, value) => {
    setEditableEntries(prev => prev.map((e, idx) =>
      idx === i ? { ...e, [field]: field === 'rayon_nummer' ? (parseInt(value) || 0) : value } : e
    ));
  };

  const handleEntryRemove = (i) => {
    setEditableEntries(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleImport = async () => {
    if (!preview) return;
    setLoading(true);
    setResult(null);
    try {
      const resp = await api.post('/dienstplan/import', {
        monat,
        eintraege: editableEntries,
        ersetzen,
      });
      setResult({ success: true, ...resp.data });
    } catch (e) {
      setResult({ success: false, fehler: e.response?.data?.fehler || e.message });
    }
    setLoading(false);
  };

  const monatLabel = new Date().toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dienstplan-Import</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Monatliche Rayon-Zuteilungen aus dem Dienstplan importieren.<br />
          Format pro Zeile: <code className="bg-gray-100 px-1 rounded">PNR;Rayonnummer</code>
        </p>
      </div>

      {/* Monat + Optionen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <div className="flex flex-wrap gap-6 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monat</label>
            <span className="inline-block bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">
              {monatLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="ersetzen"
              checked={ersetzen}
              onChange={e => setErsetzen(e.target.checked)}
              className="w-4 h-4 text-yellow-500"
            />
            <label htmlFor="ersetzen" className="text-sm text-gray-700">
              Bestehende Zuteilungen ersetzen
            </label>
          </div>
        </div>
      </div>

      {/* CSV-Editor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Zuteilungen (PNR;Rayon je Zeile)
        </label>
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          rows={6}
          className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          placeholder="418649;9050&#10;342962;0010&#10;401363;0040"
          autoComplete="new-password"
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={handlePreview}
            disabled={!csvText.trim()}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Vorschau prüfen
          </button>
        </div>
      </div>

      {/* Vorschau – editierbar */}
      {preview && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Vorschau – {editableEntries.length} Einträge
              <span className="ml-2 text-xs font-normal text-gray-400">(bearbeitbar vor Import)</span>
            </h2>
            <button
              onClick={handleImport}
              disabled={loading || editableEntries.length === 0}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? 'Importiere…' : `${editableEntries.length} Einträge importieren`}
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {parseErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">PNR</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Rayon</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editableEntries.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={e.pnr}
                        onChange={ev => handleEntryChange(i, 'pnr', ev.target.value)}
                        autoComplete="new-password"
                        className="font-mono text-gray-700 border border-transparent hover:border-gray-300 focus:border-yellow-400 focus:outline-none rounded px-1 py-0.5 w-28 bg-transparent"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={e.rayon_nummer}
                        onChange={ev => handleEntryChange(i, 'rayon_nummer', ev.target.value)}
                        autoComplete="new-password"
                        className="font-mono text-yellow-800 bg-yellow-50 border border-transparent hover:border-yellow-300 focus:border-yellow-400 focus:outline-none rounded px-2 py-0.5 w-20"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => handleEntryRemove(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                        title="Eintrag entfernen"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ergebnis */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {result.success ? (
            <>
              <div className="text-green-800 font-semibold">
                {result.importiert} Zuteilungen erfolgreich importiert für {monatLabel}
              </div>
              {result.fehler?.length > 0 && (
                <div className="mt-2 text-sm text-orange-700">
                  <div className="font-medium">Warnungen:</div>
                  {result.fehler.map((f, i) => <div key={i} className="text-xs mt-0.5">{f}</div>)}
                </div>
              )}
            </>
          ) : (
            <div className="text-red-800">{result.fehler}</div>
          )}
        </div>
      )}
    </div>
  );
}

''')

write_file('frontend/src/pages/DienstplanGrid.jsx', '''\
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

''')

write_file('frontend/src/pages/Dashboard.jsx', '''\
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
import { useConfirm } from '../components/ConfirmDialog.jsx';

export default function Dashboard() {
  const confirm = useConfirm();
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
    if (!await confirm(`Abwesenheit von ${a.mitarbeiter_name} wirklich löschen?`)) return;
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
              <option value="kur">Kur</option>
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

''')

write_file('frontend/src/pages/MitarbeiterDetail.jsx', '''\
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { kompetenzLabel, kompetenzBadgeClass } from '../utils/helpers.js';
import { Modal } from './Mitarbeiter.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

export default function MitarbeiterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
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
    if (!await confirm(`${mitarbeiter.name} wirklich löschen?`)) return;
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
            {mitarbeiter.stamm_rayon_bezeichnung && (
              <Detail
                label="Stamm-Rayon"
                wert={mitarbeiter.stamm_rayon_bezeichnung}
              />
            )}
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
              <input className="input" required value={formDaten.name}
                autoComplete="off" name="x-name" data-form-type="other" data-lpignore="true"
                readOnly onFocus={e => { e.target.readOnly = false; }}
                onChange={(e) => setFormDaten({ ...formDaten, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Personalnummer *</label>
              <input className="input" required value={formDaten.personalnummer}
                autoComplete="off" name="x-pnr" data-form-type="other" data-lpignore="true"
                readOnly onFocus={e => { e.target.readOnly = false; }}
                onChange={(e) => setFormDaten({ ...formDaten, personalnummer: e.target.value })} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={formDaten.telefon} type="text" inputMode="numeric"
                autoComplete="off" name="x-tel" data-form-type="other" data-lpignore="true"
                readOnly onFocus={e => { e.target.readOnly = false; }}
                onChange={(e) => setFormDaten({ ...formDaten, telefon: e.target.value })} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input type="text" className="input" value={formDaten.email}
                autoComplete="off" name="x-mail" data-form-type="other" data-lpignore="true"
                readOnly onFocus={e => { e.target.readOnly = false; }}
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

''')

write_file('frontend/src/pages/Mitarbeiter.jsx', '''\
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, UserCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { SearchableSelect } from '../components/SearchableSelect.jsx';

const PAGE_SIZE = 24;

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
  const [seite, setSeite] = useState(1);
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
  const seitenAnzahl = Math.ceil(gefilterte.length / PAGE_SIZE);
  const aktuelleSeite = Math.min(seite, seitenAnzahl || 1);
  const sichtbar = gefilterte.slice((aktuelleSeite - 1) * PAGE_SIZE, aktuelleSeite * PAGE_SIZE);

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
          onChange={(e) => { setSuche(e.target.value); setSeite(1); }}
          autoComplete="new-password"
        />
      </div>

      {/* Mitarbeiter-Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sichtbar.map((m) => {
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

      {seitenAnzahl > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setSeite(s => Math.max(1, s - 1))}
            disabled={aktuelleSeite === 1}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          {Array.from({ length: seitenAnzahl }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setSeite(n)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${aktuelleSeite === n ? 'bg-yellow-400 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setSeite(s => Math.min(seitenAnzahl, s + 1))}
            disabled={aktuelleSeite === seitenAnzahl}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

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
          <form autoComplete="off" onSubmit={handleSpeichern} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Name *</label>
                <input className="input" required value={formDaten.name}
                  autoComplete="off" name="x-name" data-form-type="other" data-lpignore="true"
                  readOnly onFocus={e => { e.target.readOnly = false; }}
                  onChange={(e) => setFormDaten({ ...formDaten, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Personalnummer *</label>
                <input className="input" required value={formDaten.personalnummer}
                  autoComplete="off" name="x-pnr" data-form-type="other" data-lpignore="true"
                  readOnly onFocus={e => { e.target.readOnly = false; }}
                  onChange={(e) => setFormDaten({ ...formDaten, personalnummer: e.target.value })} />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="input" value={formDaten.telefon} type="text" inputMode="numeric"
                  autoComplete="off" name="x-tel" data-form-type="other" data-lpignore="true"
                  readOnly onFocus={e => { e.target.readOnly = false; }}
                  onChange={(e) => setFormDaten({ ...formDaten, telefon: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">E-Mail</label>
                <input type="text" className="input" value={formDaten.email}
                  autoComplete="off" name="x-mail" data-form-type="other" data-lpignore="true"
                  readOnly onFocus={e => { e.target.readOnly = false; }}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

''')

write_file('frontend/src/pages/Rayone.jsx', '''\
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, MapIcon, PlusIcon, TrashIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { useConfirm } from '../components/ConfirmDialog.jsx';

const PRIORITÄT_BADGE = {
  hoch:   'bg-red-100 text-red-700',
  normal: 'bg-yellow-100 text-yellow-700',
  wenig:  'bg-gray-100 text-gray-500',
};
const PRIORITÄT_LABEL = { hoch: 'Hoch', normal: 'Normal', wenig: 'Wenig' };

function formatRayonNr(nummer) {
  return String(nummer).padStart(4, '0');
}

const PAGE_SIZE = 24;

export default function Rayone() {
  const confirm = useConfirm();
  const [rayone, setRayone] = useState([]);
  const [suche, setSuche] = useState('');
  const [seite, setSeite] = useState(1);
  const [laden, setLaden] = useState(true);
  const [modalOffen, setModalOffen] = useState(false);
  const [formular, setFormular] = useState({ nummer: '', bezeichnung: '', gebiet: '', priorität: 'normal' });
  const [fehler, setFehler] = useState('');

  const monat = new Date().toISOString().substring(0, 7);

  const ladeData = useCallback(() => {
    api.get('/rayone', { params: { monat } }).then(({ data }) => {
      setRayone(data);
      setLaden(false);
    });
  }, []);

  useEffect(() => {
    ladeData();
    const onVisible = () => { if (document.visibilityState === 'visible') ladeData(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ladeData);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ladeData);
    };
  }, [ladeData]);

  const gefilterte = rayone.filter(r =>
    formatRayonNr(r.nummer).includes(suche) ||
    r.bezeichnung.toLowerCase().includes(suche.toLowerCase()) ||
    (r.gebiet || '').toLowerCase().includes(suche.toLowerCase())
  );
  const seitenAnzahl = Math.ceil(gefilterte.length / PAGE_SIZE);
  const aktuelleSeite = Math.min(seite, seitenAnzahl || 1);
  const sichtbar = gefilterte.slice((aktuelleSeite - 1) * PAGE_SIZE, aktuelleSeite * PAGE_SIZE);

  const öffneNeu = () => {
    setFormular({ nummer: '', bezeichnung: '', gebiet: '', priorität: 'normal' });
    setFehler('');
    setModalOffen(true);
  };

  const erstellen = async (e) => {
    e.preventDefault();
    setFehler('');
    try {
      await api.post('/rayone', {
        nummer: Number(formular.nummer),
        bezeichnung: formular.bezeichnung || `Rayon ${String(formular.nummer).padStart(4, '0')}`,
        gebiet: formular.gebiet || null,
        priorität: formular.priorität,
      });
      setModalOffen(false);
      ladeData();
    } catch (err) {
      setFehler(err.response?.data?.fehler || 'Fehler beim Erstellen');
    }
  };

  const löschen = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!await confirm('Rayon wirklich deaktivieren?')) return;
    await api.delete(`/rayone/${id}`);
    ladeData();
  };

  if (laden) return <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rayone</h1>
          <p className="text-gray-500 mt-1">Alle {rayone.length} Zustellbezirke</p>
        </div>
        <button onClick={öffneNeu} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Neuer Rayon
        </button>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Nummer, Bezeichnung oder Gebiet suchen..."
          value={suche}
          onChange={(e) => { setSuche(e.target.value); setSeite(1); }}
          autoComplete="new-password"
          readOnly
          onFocus={e => { e.target.readOnly = false; }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {sichtbar.map((r) => {
          const prio = r.priorität || 'normal';
          return (
            <Link
              key={r.id}
              to={`/rayone/${r.id}`}
              className="card hover:shadow-md transition-shadow group p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapIcon className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-gray-900 group-hover:text-yellow-700">
                      {r.bezeichnung}
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">{formatRayonNr(r.nummer)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITÄT_BADGE[prio] || PRIORITÄT_BADGE.normal}`}>
                        {PRIORITÄT_LABEL[prio] || prio}
                      </span>
                      <button
                        onClick={(e) => löschen(e, r.id)}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Rayon entfernen"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {r.gebiet && <div className="text-xs text-gray-500 mt-0.5">{r.gebiet}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.hat_tagesplan_heute && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Heute</span>
                    )}
                    {r.aktuelle_besetzung && r.aktuelle_besetzung.length > 0 ? (
                      r.aktuelle_besetzung.map(b => (
                        <span key={b.mitarbeiter_id} className={`badge-stamm ${b.ist_teilzuteilung ? 'opacity-75' : ''}`}>
                          {b.mitarbeiter_name}
                          {b.ist_teilzuteilung ? (
                            <span className="ml-1 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">Teil</span>
                          ) : null}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">Nicht besetzt</span>
                    )}
                    {r.anzahl_mitarbeiter > 0 && (
                      <span className="text-xs text-gray-400">{r.anzahl_mitarbeiter} kennen diesen Rayon</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {gefilterte.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <MapIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Keine Rayone gefunden</p>
          </div>
        )}
      </div>

      {seitenAnzahl > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setSeite(s => Math.max(1, s - 1))}
            disabled={aktuelleSeite === 1}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          {Array.from({ length: seitenAnzahl }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setSeite(n)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${aktuelleSeite === n ? 'bg-yellow-400 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setSeite(s => Math.min(seitenAnzahl, s + 1))}
            disabled={aktuelleSeite === seitenAnzahl}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal: Neuer Rayon */}
      {modalOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOffen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Neuer Rayon</h2>
              <button onClick={() => setModalOffen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form autoComplete="off" onSubmit={erstellen} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zustellbezirk-Nummer *</label>
                <input
                  type="number"
                  required
                  value={formular.nummer}
                  onChange={e => setFormular(f => ({ ...f, nummer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. 9010"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-400 mt-1">Vierstellige Bezirksnummer (z.B. 0010 → 10, 9010 → 9010)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
                <input
                  type="text"
                  value={formular.bezeichnung}
                  onChange={e => setFormular(f => ({ ...f, bezeichnung: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder={formular.nummer ? `Rayon ${String(formular.nummer).padStart(4, '0')}` : 'Automatisch aus Nummer'}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gebiet / Beschreibung</label>
                <input
                  type="text"
                  value={formular.gebiet}
                  onChange={e => setFormular(f => ({ ...f, gebiet: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="z.B. Stadtmitte, Außenbezirk..."
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
                <select
                  value={formular.priorität}
                  onChange={e => setFormular(f => ({ ...f, priorität: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                >
                  <option value="hoch">Hoch</option>
                  <option value="normal">Normal</option>
                  <option value="wenig">Wenig</option>
                </select>
              </div>

              {fehler && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{fehler}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOffen(false)} className="btn-secondary flex-1">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

''')

write_file('frontend/src/pages/Tagesplan.jsx', '''\
import React, { useState, useEffect } from 'react';
import {
  PrinterIcon, Cog6ToothIcon, CheckIcon, XMarkIcon,
  MagnifyingGlassIcon, PencilSquareIcon, UserIcon, CalendarIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api.js';
import { formatDatumLang, heuteDatum, statusLabel, statusBadgeClass } from '../utils/helpers.js';
import { SearchableSelect } from '../components/SearchableSelect.jsx';
import MonthPicker from '../components/MonthPicker.jsx';

// ─── Hilfsfunktion: Wochen eines Monats berechnen ─────────────────────────────
function getWeeksOfMonth(monat) {
  const [year, month] = monat.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  let cur = new Date(firstDay);
  while (cur <= lastDay) {
    const start = new Date(cur);
    const end = new Date(cur);
    end.setDate(end.getDate() + 6);
    if (end > lastDay) end.setTime(lastDay.getTime());
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(month).padStart(2, '0')}.`;
    weeks.push({
      von: start.toISOString().split('T')[0],
      bis: end.toISOString().split('T')[0],
      label: `${fmt(start)} – ${fmt(end)}${year}`,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Tagesplan() {
  const [datum, setDatum] = useState(heuteDatum());
  const [plan, setPlan] = useState(null);
  const [laden, setLaden] = useState(true);
  const [monatModalOffen, setMonatModalOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const [auswahlRayon, setAuswahlRayon] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);

  const monat = datum.substring(0, 7);

  const laden_ = async () => {
    setLaden(true);
    const { data } = await api.get(`/tagesplan/${datum}`);
    setPlan(data);
    setLaden(false);
  };

  useEffect(() => {
    laden_();
    const onVisible = () => { if (document.visibilityState === 'visible') laden_(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', laden_);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', laden_);
    };
  }, [datum]);
  useEffect(() => { api.get('/mitarbeiter').then(({ data }) => setMitarbeiter(data)); }, []);

  const gefiltertePlan = plan?.plan?.filter(eintrag => {
    if (!suche) return true;
    const q = suche.toLowerCase();
    return (
      eintrag.aktueller_mitarbeiter?.name?.toLowerCase().includes(q) ||
      eintrag.stamm_mitarbeiter?.name?.toLowerCase().includes(q) ||
      eintrag.rayon?.bezeichnung?.toLowerCase().includes(q) ||
      String(eintrag.rayon?.nummer).includes(q)
    );
  });

  const besetzt = plan?.plan?.filter(p => p.aktueller_mitarbeiter && !p.ist_teilbesetzung).length || 0;
  const teilbesetzt = plan?.plan?.filter(p => p.ist_teilbesetzung || (!p.aktueller_mitarbeiter && p.teilmitnahmen?.length > 0)).length || 0;
  const unbesetzt = plan?.plan?.filter(p => !p.aktueller_mitarbeiter && !(p.teilmitnahmen?.length > 0)).length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tagesplan</h1>
          <p className="text-gray-500 mt-1">Übersicht aller Rayone</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker value={datum} onChange={setDatum} mode="date" />
          <button
            onClick={() => setMonatModalOffen(true)}
            className="btn-secondary flex items-center gap-2"
            title="Monatliche Rayon-Zuteilungen konfigurieren"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            Monat einrichten
          </button>
          <a
            href={`/api/tagesplan/${monat}/ical`}
            download={`tagesplan-${monat}.ics`}
            className="btn-secondary flex items-center gap-2"
            title="Monatsplan als iCal-Datei herunterladen (Outlook / Google Calendar)"
          >
            <CalendarIcon className="w-4 h-4" />
            iCal Export
          </a>
          <button
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-2"
          >
            <PrinterIcon className="w-4 h-4" />
            Drucken / PDF
          </button>
        </div>
      </div>

      {/* Druckheader */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
        <h1 className="text-2xl font-bold">Post – Tagesplan</h1>
        <p className="text-lg">{formatDatumLang(datum)}</p>
      </div>

      {/* Statistik-Zeile */}
      {!laden && (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-4 no-print">
          <div className="card text-center p-4">
            <div className="text-2xl font-bold text-green-600">{besetzt}</div>
            <div className="text-sm text-gray-500">Besetzt</div>
          </div>
          <div className="card text-center p-4">
            <div className="text-2xl font-bold text-yellow-600">{teilbesetzt}</div>
            <div className="text-sm text-gray-500">Teilbesetzt</div>
          </div>
          <div className="card text-center p-4">
            <div className={`text-2xl font-bold ${unbesetzt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {unbesetzt}
            </div>
            <div className="text-sm text-gray-500">Unbesetzt</div>
          </div>
        </div>
      )}

      {/* Suchfeld */}
      {!laden && (
        <div className="relative mb-4 no-print">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Nach Mitarbeiter oder Rayon suchen..."
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      )}

      {laden ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 print:grid-cols-3">
            {gefiltertePlan?.map((eintrag) => (
              <RayonKarte
                key={eintrag.rayon.id}
                eintrag={eintrag}
                onClick={() => setAuswahlRayon(eintrag)}
              />
            ))}
            {gefiltertePlan?.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-400">
                Keine Rayone gefunden
              </div>
            )}
          </div>
        </>
      )}

      {/* Abwesenheiten – im Druck als eigener Abschnitt */}
      {!laden && plan?.abwesenheiten?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Abwesende Mitarbeiter</h2>
          <div className="flex flex-wrap gap-2">
            {plan.abwesenheiten.map(a => (
              <span
                key={`${a.mitarbeiter_id}-${a.datum}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(a.status)}`}
              >
                {a.mitarbeiter_name} · {statusLabel(a.status)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-100 text-sm text-gray-600 no-print">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          Besetzt
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          Teilbesetzt
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-300"></div>
          Unbesetzt
        </div>
        {!laden && (
          <span className="ml-auto text-xs text-gray-400 italic">
            Rayon anklicken, um direkt zuzuweisen
          </span>
        )}
      </div>

      {/* Monatszuteilung Modal */}
      {monatModalOffen && (
        <MonatsZuteilungModal
          monat={monat}
          onClose={() => { setMonatModalOffen(false); laden_(); }}
        />
      )}

      {/* Rayon-Zuweisung Modal (Klick auf Karte) */}
      {auswahlRayon && (
        <RayonZuweisungModal
          eintrag={auswahlRayon}
          datum={datum}
          mitarbeiter={mitarbeiter}
          plan={plan}
          onClose={() => setAuswahlRayon(null)}
          onSaved={() => { setAuswahlRayon(null); laden_(); }}
        />
      )}
    </div>
  );
}

// ─── RayonKarte ───────────────────────────────────────────────────────────────
function RayonKarte({ eintrag, onClick }) {
  const { rayon, aktueller_mitarbeiter, ist_mitnahme, ist_teilbesetzung, stamm_mitarbeiter, stamm_status, vertritt_name, teilmitnahmen = [] } = eintrag;

  const hatTeilmitnahmen = teilmitnahmen.length > 0;

  let hintergrund = 'bg-green-50 border-green-200';
  let statusPunkt = 'bg-green-400';
  let badge = null;

  if (!aktueller_mitarbeiter && !hatTeilmitnahmen) {
    hintergrund = 'bg-red-50 border-red-200';
    statusPunkt = 'bg-red-400';
  } else if (!aktueller_mitarbeiter && hatTeilmitnahmen) {
    hintergrund = 'bg-yellow-50 border-yellow-200';
    statusPunkt = 'bg-yellow-400';
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">Teilbesetzt</span>;
  } else if (ist_teilbesetzung) {
    hintergrund = 'bg-yellow-50 border-yellow-200';
    statusPunkt = 'bg-yellow-400';
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">Teilbesetzt</span>;
  } else if (ist_mitnahme) {
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">Mitnahme</span>;
  }

  return (
    <div
      className={`rounded-lg border-2 ${hintergrund} p-3 cursor-pointer hover:shadow-md transition-shadow group`}
      onClick={onClick}
      title="Klicken zum Bearbeiten"
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusPunkt} flex-shrink-0 mt-0.5`}></div>
          <span className="font-bold text-gray-800 text-sm">
            {rayon.bezeichnung}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {badge}
          <PencilSquareIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 no-print" />
        </div>
      </div>

      {aktueller_mitarbeiter ? (
        <div className="pl-4">
          <div className="flex items-baseline gap-2">
            <div className="font-semibold text-sm text-gray-900">{aktueller_mitarbeiter.name}</div>
            {aktueller_mitarbeiter.fahrzeug_kennzeichen && (
              <span className="text-xs text-gray-400 font-normal">{aktueller_mitarbeiter.fahrzeug_kennzeichen}</span>
            )}
          </div>
          {ist_mitnahme && vertritt_name && (
            <div className="text-xs text-gray-500 mt-0.5">Mitnahme von: {vertritt_name}</div>
          )}
          {ist_teilbesetzung && vertritt_name && (
            <div className="text-xs text-gray-500 mt-0.5">Teilmitnahme von: {vertritt_name}</div>
          )}
          {stamm_status && stamm_status !== 'anwesend' && stamm_status !== 'stamm' && stamm_mitarbeiter && (
            <div className="text-xs text-red-500 mt-0.5">
              {stamm_mitarbeiter.name}: {statusLabel(stamm_status)}
            </div>
          )}
        </div>
      ) : (
        <div className="pl-4 text-red-500 text-sm font-medium italic">Nicht besetzt!</div>
      )}

      {/* Mehrere Teilmitnahmen anzeigen */}
      {hatTeilmitnahmen && (
        <div className="pl-4 mt-1 space-y-0.5">
          {teilmitnahmen.map(t => (
            <div key={t.id} className="text-xs text-yellow-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 inline-block"></span>
              {t.name} <span className="text-yellow-500">(Teilmitnahme)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RayonZuweisungModal (Direkte Zuweisung per Klick) ───────────────────────
function RayonZuweisungModal({ eintrag, datum, mitarbeiter, plan, onClose, onSaved }) {
  const { rayon, aktueller_mitarbeiter, ist_teilbesetzung, teilmitnahmen: vorhandeneTeilmitnahmen = [] } = eintrag;

  // Vollzustellung: aktueller MA, aber nur wenn er NICHT als alter Teilmitnahme-Stil markiert ist
  const initialVoll = (!ist_teilbesetzung && aktueller_mitarbeiter) ? aktueller_mitarbeiter.id : '';
  const [vollId, setVollId] = useState(initialVoll);
  const [vollSuche, setVollSuche] = useState('');

  // Teilmitnahmen: neue Tabelle
  const [teilIds, setTeilIds] = useState(vorhandeneTeilmitnahmen.map(t => t.id));
  const [teilSuche, setTeilSuche] = useState('');
  const [teilAuswahl, setTeilAuswahl] = useState('');

  // Konflikt-Hinweis: dieser MA war zuvor auf einem anderen Rayon als Vollzustellung
  const [konfliktInfo, setKonfliktInfo] = useState(null);
  const [konfliktRayonId, setKonfliktRayonId] = useState(null);

  const [speichernLaeuft, setSpeichernLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');

  // Vollzustellung-Konflikt prüfen wenn sich vollId ändert
  useEffect(() => {
    if (!vollId || !plan?.plan) {
      setKonfliktInfo(null);
      setKonfliktRayonId(null);
      return;
    }
    const konflikt = plan.plan.find(p =>
      p.rayon.id !== rayon.id &&
      p.aktueller_mitarbeiter?.id === parseInt(vollId) &&
      !p.ist_teilbesetzung
    );
    if (konflikt) {
      const ma = mitarbeiter.find(m => m.id === parseInt(vollId));
      setKonfliktInfo(`${ma?.name || 'Dieser Mitarbeiter'} war zuvor auf Rayon ${konflikt.rayon.nummer} (${konflikt.rayon.bezeichnung}) als Vollzustellung – dieser Rayon wird nun leer gesetzt.`);
      setKonfliktRayonId(konflikt.rayon.id);
    } else {
      setKonfliktInfo(null);
      setKonfliktRayonId(null);
    }
  }, [vollId]);

  const gefilterteVoll = mitarbeiter.filter(m => {
    if (!vollSuche) return true;
    const q = vollSuche.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.personalnummer.includes(q);
  });

  const gefilterteTeil = mitarbeiter.filter(m => {
    if (m.id === parseInt(vollId)) return false; // Vollzustellung nicht auch als Teilmitnahme
    if (teilIds.includes(m.id)) return false;    // bereits hinzugefügt
    if (!teilSuche) return true;
    const q = teilSuche.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.personalnummer.includes(q);
  });

  const teilmitnahmeHinzufuegen = (id) => {
    if (id && !teilIds.includes(parseInt(id))) {
      setTeilIds(prev => [...prev, parseInt(id)]);
    }
    setTeilAuswahl('');
    setTeilSuche('');
  };

  const teilmitnahmeEntfernen = (id) => {
    setTeilIds(prev => prev.filter(t => t !== id));
  };

  const handleSpeichern = async () => {
    setSpeichernLaeuft(true);
    setFehler('');
    try {
      const eintraege = [{
        rayon_id: rayon.id,
        mitarbeiter_id: vollId || null,
        ist_vertretung: false,
        ist_teilbesetzung: false,
        vertritt_mitarbeiter_id: null,
        teilmitnahmen: teilIds,
      }];

      // Konflikt-Rayon leeren
      if (konfliktRayonId) {
        eintraege.push({
          rayon_id: konfliktRayonId,
          mitarbeiter_id: null,
          ist_vertretung: false,
          ist_teilbesetzung: false,
          vertritt_mitarbeiter_id: null,
          teilmitnahmen: [],
        });
      }

      await api.post(`/tagesplan/${datum}/speichern`, { eintraege });
      onSaved();
    } catch {
      setFehler('Speichern fehlgeschlagen.');
      setSpeichernLaeuft(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{rayon.bezeichnung}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{datum} – Mitarbeiter zuweisen</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── Sektion 1: Vollzustellung ── */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Vollzustellung <span className="font-normal text-gray-400">(max. 1 Person)</span>
            </div>

            {/* Konflikt-Hinweis */}
            {konfliktInfo && (
              <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <span className="mt-0.5 text-amber-500 flex-shrink-0">⚠</span>
                {konfliktInfo}
              </div>
            )}

            <div className="relative mb-2">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="input pl-9 text-sm"
                placeholder="Vollzustellung suchen..."
                value={vollSuche}
                onChange={(e) => setVollSuche(e.target.value)}
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
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
              <div
                onClick={() => { setVollId(''); setVollSuche(''); }}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-b border-gray-100 ${
                  vollId === '' ? 'bg-red-50 text-red-700' : 'hover:bg-gray-50 text-gray-500 italic'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  vollId === '' ? 'bg-red-500 border-red-500' : 'border-gray-300'
                }`}>
                  {vollId === '' && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                – Unbesetzt –
              </div>
              {gefilterteVoll.map(m => (
                <div
                  key={m.id}
                  onClick={() => { setVollId(m.id); setVollSuche(''); }}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${
                    vollId === m.id ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    vollId === m.id ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}>
                    {vollId === m.id && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-400">Nr. {m.personalnummer}</div>
                  </div>
                </div>
              ))}
              {gefilterteVoll.length === 0 && (
                <div className="text-center py-3 text-gray-400 text-sm">Keine Mitarbeiter gefunden</div>
              )}
            </div>
          </div>

          {/* ── Sektion 2: Teilmitnahmen ── */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Teilmitnahmen <span className="font-normal text-gray-400">(mehrere möglich)</span>
            </div>

            {/* Aktuelle Teilmitnahmen-Liste */}
            {teilIds.length > 0 && (
              <div className="mb-2 space-y-1">
                {teilIds.map(id => {
                  const ma = mitarbeiter.find(m => m.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>
                        <span className="text-sm font-medium text-yellow-900">{ma?.name || `MA #${id}`}</span>
                      </div>
                      <button
                        onClick={() => teilmitnahmeEntfernen(id)}
                        className="text-yellow-500 hover:text-red-600 transition-colors"
                        title="Entfernen"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Teilmitnahme hinzufügen */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9 text-sm"
                  placeholder="Teilmitnahme hinzufügen..."
                  value={teilSuche}
                  onChange={(e) => { setTeilSuche(e.target.value); setTeilAuswahl(''); }}
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
            </div>
            {teilSuche && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mt-1 max-h-36 overflow-y-auto">
                {gefilterteTeil.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 text-sm">Keine weiteren Mitarbeiter</div>
                ) : (
                  gefilterteTeil.map(m => (
                    <div
                      key={m.id}
                      onClick={() => teilmitnahmeHinzufuegen(m.id)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-yellow-50 border-b border-gray-50 last:border-0"
                    >
                      <UserIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-400">Nr. {m.personalnummer}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {fehler && <div className="text-red-600 text-sm">{fehler}</div>}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={handleSpeichern} disabled={speichernLaeuft} className="btn-primary disabled:opacity-50">
            {speichernLaeuft ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Monatszuteilung Modal ────────────────────────────────────────────────────
function MonatsZuteilungModal({ monat, onClose }) {
  const [rayone, setRayone] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [zuteilungen, setZuteilungen] = useState({});
  const [laden, setLaden] = useState(true);
  const [gespeichert, setGespeichert] = useState(false);
  const [bearbeiteRayonId, setBearbeiteRayonId] = useState(null);
  const [validierungsFehler, setValidierungsFehler] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/rayone'),
      api.get('/mitarbeiter'),
      api.get('/monatszuteilungen', { params: { monat } }),
    ]).then(([rRes, mRes, zRes]) => {
      setRayone(rRes.data);
      setMitarbeiter(mRes.data);
      const bestehend = {};
      for (const z of zRes.data) {
        bestehend[z.rayon_id] = { mitarbeiter_id: z.mitarbeiter_id, ist_teilzuteilung: z.ist_teilzuteilung };
      }
      for (const m of mRes.data) {
        if (m.stamm_rayon_id) {
          const bereitsZugeteilt = Object.values(bestehend).some(z => z.mitarbeiter_id === m.id);
          if (!bereitsZugeteilt && !bestehend[m.stamm_rayon_id]) {
            bestehend[m.stamm_rayon_id] = { mitarbeiter_id: m.id, ist_teilzuteilung: 0 };
          }
        }
      }
      setZuteilungen(bestehend);
      setLaden(false);
    });
  }, [monat]);

  const handleSpeichern = async () => {
    setValidierungsFehler([]);

    // R2/R3: Clientseitige Validierung – max. 1 Ganzmitnahme, max. 2 Teilmitnahmen pro Mitarbeiter
    const perMitarbeiter = {};
    for (const [, z] of Object.entries(zuteilungen)) {
      if (!z.mitarbeiter_id) continue;
      const id = z.mitarbeiter_id;
      if (!perMitarbeiter[id]) perMitarbeiter[id] = { ganz: 0, teil: 0 };
      if (z.ist_teilzuteilung) perMitarbeiter[id].teil++;
      else perMitarbeiter[id].ganz++;
    }
    const fehler = [];
    for (const [id, counts] of Object.entries(perMitarbeiter)) {
      if (counts.ganz > 1) {
        const ma = mitarbeiter.find(m => m.id === parseInt(id));
        fehler.push(`${ma?.name || 'Mitarbeiter ' + id}: Maximal 1 Ganzmitnahme erlaubt (${counts.ganz} zugewiesen)`);
      }
      if (counts.teil > 2) {
        const ma = mitarbeiter.find(m => m.id === parseInt(id));
        fehler.push(`${ma?.name || 'Mitarbeiter ' + id}: Maximal 2 Teilmitnahmen erlaubt (${counts.teil} zugewiesen)`);
      }
    }
    if (fehler.length > 0) {
      setValidierungsFehler(fehler);
      return;
    }

    const eintraege = Object.entries(zuteilungen)
      .filter(([, z]) => z.mitarbeiter_id)
      .map(([rayon_id, z]) => ({
        rayon_id: parseInt(rayon_id),
        mitarbeiter_id: z.mitarbeiter_id,
        ist_teilzuteilung: z.ist_teilzuteilung ? 1 : 0,
      }));
    try {
      await api.post('/monatszuteilungen', { monat, eintraege });
      setGespeichert(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      const msg = err?.response?.data?.fehler || 'Speichern fehlgeschlagen';
      setValidierungsFehler([msg]);
    }
  };

  const monatAnzeige = new Date(monat + '-01').toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

  if (laden) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-8 text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Monatszuteilung</h2>
            <p className="text-sm text-gray-500">{monatAnzeige} – Welcher Mitarbeiter besetzt welchen Rayon?</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="space-y-1">
            {rayone.map(rayon => {
              const zuteilung = zuteilungen[rayon.id] || { mitarbeiter_id: '', ist_teilzuteilung: 0 };
              const istOffen = bearbeiteRayonId === rayon.id;
              return (
                <div key={rayon.id}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-yellow-700 font-bold text-sm">{rayon.nummer}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{rayon.bezeichnung}</div>
                      {rayon.gebiet && rayon.gebiet !== rayon.bezeichnung && (
                        <div className="text-xs text-gray-400">{rayon.gebiet}</div>
                      )}
                    </div>
                    <div className="w-48">
                      <SearchableSelect
                        options={mitarbeiter.map(m => ({ id: m.id, label: m.name, sublabel: `Nr. ${m.personalnummer}` }))}
                        value={zuteilung.mitarbeiter_id || ''}
                        onChange={id => setZuteilungen(prev => ({
                          ...prev,
                          [rayon.id]: { ...prev[rayon.id], mitarbeiter_id: id ? parseInt(id) : '', ist_teilzuteilung: prev[rayon.id]?.ist_teilzuteilung || 0 }
                        }))}
                        emptyLabel="– Unbesetzt –"
                        searchPlaceholder="Name oder Personalnummer..."
                      />
                    </div>
                    {/* Ganz/Teil-Toggle – nur sichtbar wenn Mitarbeiter ausgewählt */}
                    {zuteilung.mitarbeiter_id ? (
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 whitespace-nowrap"
                        value={zuteilung.ist_teilzuteilung ? '1' : '0'}
                        onChange={e => setZuteilungen(prev => ({
                          ...prev,
                          [rayon.id]: { ...prev[rayon.id], ist_teilzuteilung: e.target.value === '1' ? 1 : 0 }
                        }))}
                        title="Art der Zuteilung"
                      >
                        <option value="0">Ganzmitnahme</option>
                        <option value="1">Teilmitnahme</option>
                      </select>
                    ) : (
                      <div className="w-24" />
                    )}
                    <button
                      onClick={() => setBearbeiteRayonId(istOffen ? null : rayon.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                        istOffen
                          ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                      title="Einzelne Wochen oder Tage manuell besetzen"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      Bearbeiten
                    </button>
                  </div>

                  {/* Wochen-Editor (inline, wenn Bearbeiten aktiv) */}
                  {istOffen && (
                    <WochenEditor
                      rayon={rayon}
                      monat={monat}
                      mitarbeiter={mitarbeiter}
                      standardMitarbeiterId={zuteilung.mitarbeiter_id || ''}
                      onClose={() => setBearbeiteRayonId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pt-2 pb-0">
          {validierungsFehler.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-2">
              <div className="text-sm font-semibold text-red-700 mb-1">Zuteilung nicht möglich:</div>
              {validierungsFehler.map((f, i) => (
                <div key={i} className="text-sm text-red-600">• {f}</div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
          {gespeichert ? (
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckIcon className="w-5 h-5" />
              Gespeichert!
            </div>
          ) : (
            <div className="text-sm text-gray-500 space-y-0.5">
              <div>{Object.values(zuteilungen).filter(z => z.mitarbeiter_id && !z.ist_teilzuteilung).length} Ganzmitnahmen</div>
              <div>{Object.values(zuteilungen).filter(z => z.mitarbeiter_id && z.ist_teilzuteilung).length} Teilmitnahmen</div>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button onClick={handleSpeichern} className="btn-primary">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wochen-Editor (inline in MonatsZuteilungsModal) ─────────────────────────
function WochenEditor({ rayon, monat, mitarbeiter, standardMitarbeiterId, onClose }) {
  const wochen = getWeeksOfMonth(monat).slice(0, 4);
  const [wochenZuteilungen, setWochenZuteilungen] = useState({});
  const [laden, setLaden] = useState(true);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api.get('/tagesplan/wochenbesetzung', { params: { rayon_id: rayon.id, monat } })
      .then(({ data }) => {
        // Bestehende Tagespläne auf Wochen mappen
        const map = {};
        for (const eintrag of data) {
          const datum = eintrag.datum;
          // Woche finden, in die dieses Datum fällt
          const woche = wochen.find(w => datum >= w.von && datum <= w.bis);
          if (woche && !map[woche.von]) {
            map[woche.von] = eintrag.mitarbeiter_id || '';
          }
        }
        setWochenZuteilungen(map);
        setLaden(false);
      })
      .catch(() => setLaden(false));
  }, [rayon.id, monat]);

  const handleSpeichern = async () => {
    setFehler('');
    try {
      const wocheneintraege = wochen.map(w => ({
        von: w.von,
        bis: w.bis,
        mitarbeiter_id: wochenZuteilungen[w.von] !== undefined
          ? (wochenZuteilungen[w.von] || null)
          : null,
      })).filter(w => w.mitarbeiter_id !== null);

      await api.post('/tagesplan/wochenbesetzung', { rayon_id: rayon.id, wocheneintraege });
      setGespeichert(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      setFehler('Speichern fehlgeschlagen.');
    }
  };

  return (
    <div className="ml-14 mr-2 mb-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
        Wochenweise Besetzung – {rayon.bezeichnung}
      </div>
      {laden ? (
        <div className="text-xs text-gray-400">Lade...</div>
      ) : (
        <div className="space-y-2">
          {wochen.map(woche => {
            const val = wochenZuteilungen[woche.von] !== undefined
              ? wochenZuteilungen[woche.von]
              : ''; // leer = kein Override
            return (
              <div key={woche.von} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-40 flex-shrink-0">{woche.label}</span>
                <div className="flex-1">
                  <SearchableSelect
                    options={mitarbeiter.map(m => ({
                      id: m.id,
                      label: m.name + (m.id === standardMitarbeiterId ? ' (Standard)' : ''),
                      sublabel: `Nr. ${m.personalnummer}`,
                    }))}
                    value={val}
                    onChange={id => setWochenZuteilungen(prev => ({
                      ...prev,
                      [woche.von]: id ? parseInt(id) : '',
                    }))}
                    emptyLabel="– Standard (Monatszuteilung) –"
                    searchPlaceholder="Name oder Personalnummer..."
                  />
                </div>
              </div>
            );
          })}
          {fehler && <div className="text-red-600 text-xs">{fehler}</div>}
          {gespeichert && (
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
              <CheckIcon className="w-4 h-4" />
              Wochenbesetzung gespeichert!
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary text-xs py-1 px-3">Schließen</button>
            <button onClick={handleSpeichern} className="btn-primary text-xs py-1 px-3">
              Wochenbesetzung speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

''')

write_file('frontend/src/pages/Fahrzeuge.jsx', '''\
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
import { SearchableSelect } from '../components/SearchableSelect.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';

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
  const confirm = useConfirm();
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
    if (!await confirm('Fahrzeug wirklich entfernen?')) return;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOffen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                <SearchableSelect
                  options={mitarbeiterListe.map(m => ({ id: m.id, label: m.name, sublabel: `Nr. ${m.personalnummer}` }))}
                  value={formular.mitarbeiter_id || ''}
                  onChange={id => setFormular(f => ({ ...f, mitarbeiter_id: id ? parseInt(id) : null }))}
                  searchPlaceholder="Mitarbeiter suchen..."
                  emptyLabel="— Kein Mitarbeiter —"
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

''')

patch_file('backend/database.js',
  '  try { db.exec("ALTER TABLE benutzer ADD COLUMN rolle TEXT NOT NULL DEFAULT \'admin\'"); } catch {}',
  '  try { db.exec("ALTER TABLE benutzer ADD COLUMN rolle TEXT NOT NULL DEFAULT \'admin\'"); } catch {}\n\n  // Migration: abwesenheiten CHECK constraint um \'kur\' erweitern\n  try {\n    const tbl = db.prepare("SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'abwesenheiten\'").get();\n    if (tbl && tbl.sql && !tbl.sql.includes("\'kur\'")) {\n      db.exec(`PRAGMA foreign_keys = OFF`);\n      db.exec(`CREATE TABLE abwesenheiten_mig (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        mitarbeiter_id INTEGER NOT NULL,\n        datum TEXT NOT NULL,\n        status TEXT NOT NULL CHECK(status IN (\'anwesend\', \'krank\', \'urlaub\', \'frei\', \'kur\', \'sonstige\')),\n        bemerkung TEXT,\n        UNIQUE(mitarbeiter_id, datum),\n        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE\n      )`);\n      db.exec(\'INSERT OR IGNORE INTO abwesenheiten_mig SELECT * FROM abwesenheiten\');\n      db.exec(\'DROP TABLE abwesenheiten\');\n      db.exec(\'ALTER TABLE abwesenheiten_mig RENAME TO abwesenheiten\');\n      db.exec(`PRAGMA foreign_keys = ON`);\n    }\n  } catch (e) { console.error(\'Migration abwesenheiten kur:\', e.message); }'
)

patch_file('backend/server.js',
  "  const rayone = db.prepare('SELECT * FROM rayone WHERE aktiv = 1 ORDER BY nummer').all();\n\n  // Abwesenheiten für den Tag",
  "  const rayone = db.prepare('SELECT * FROM rayone WHERE aktiv = 1 ORDER BY nummer').all();\n\n  // Fahrzeuge je Mitarbeiter (zugeteiltes aktives Fahrzeug)\n  const fahrzeugRows = db.prepare(\n    'SELECT mitarbeiter_id, kennzeichen FROM fahrzeuge WHERE aktiv = 1 AND mitarbeiter_id IS NOT NULL'\n  ).all();\n  const fahrzeugMap = {};\n  for (const f of fahrzeugRows) fahrzeugMap[f.mitarbeiter_id] = f.kennzeichen;\n\n  // Abwesenheiten für den Tag"
)

patch_file('backend/server.js',
  '      aktueller_mitarbeiter: mitarbeiter,',
  '      aktueller_mitarbeiter: mitarbeiter ? { ...mitarbeiter, fahrzeug_kennzeichen: fahrzeugMap[mitarbeiter.id] || null } : null,'
)

patch_file('backend/server.js',
  '      rayon_nummer: zuteilungMap[m.id]?.nummer || null,\n      abwesenheiten: abwesenheitMap[m.id] || {},',
  '      rayon_nummer: zuteilungMap[m.id]?.nummer || null,\n      rayon_id: zuteilungMap[m.id]?.id || null,\n      abwesenheiten: abwesenheitMap[m.id] || {},'
)

patch_file('backend/server.js',
  '  for (const z of zuteilungen) zuteilungMap[z.mitarbeiter_id] = z.rayon_nummer;',
  '  for (const z of zuteilungen) zuteilungMap[z.mitarbeiter_id] = { nummer: z.rayon_nummer, id: z.rayon_id };'
)

print()
print("✅ Fertig! Jetzt neu bauen:")
print("  cd ~/rayon-app")
print("  rm -rf frontend/dist")
print("  cd frontend && npm install && npm run build")
print("  cd ..")
print('  FRONTEND_DIST="../frontend/dist" node --no-warnings server.js')
