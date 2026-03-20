import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import api from '../utils/api.js';
import {
  HomeIcon,
  UsersIcon,
  MapIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  TruckIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Tagesplan', href: '/tagesplan', icon: CalendarDaysIcon },
  { name: 'Jahreskalender', href: '/jahreskalender', icon: CalendarIcon },
  { name: 'Mitnahmeplanung', href: '/mitnahme', icon: ArrowsRightLeftIcon },
  { name: 'Mitarbeiter', href: '/mitarbeiter', icon: UsersIcon },
  { name: 'Rayone', href: '/rayone', icon: MapIcon },
  { name: 'Fahrzeuge', href: '/fahrzeuge', icon: TruckIcon },
  { name: 'Statistik', href: '/statistik', icon: ChartBarIcon },
  { name: 'Dienstplan-Import', href: '/dienstplan-import', icon: ArrowUpTrayIcon },
  { name: 'Dienstplan-Grid', href: '/dienstplan-grid', icon: ArrowUpTrayIcon },
];

const adminNavigation = [
  { name: 'Benutzerverwaltung', href: '/benutzer', icon: ShieldCheckIcon },
  { name: 'Audit-Log', href: '/audit-log', icon: ClipboardDocumentListIcon },
];

export default function Layout() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwortModalOffen, setPasswortModalOffen] = useState(false);
  const [passwortForm, setPasswortForm] = useState({ aktuelles_passwort: '', neues_passwort: '', neues_passwort2: '' });
  const [passwortFehler, setPasswortFehler] = useState('');
  const [passwortErfolg, setPasswortErfolg] = useState(false);
  const [passwortLaden, setPasswortLaden] = useState(false);
  const istAdmin = auth?.benutzer?.rolle === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const oeffnePasswortModal = () => {
    setPasswortForm({ aktuelles_passwort: '', neues_passwort: '', neues_passwort2: '' });
    setPasswortFehler('');
    setPasswortErfolg(false);
    setPasswortModalOffen(true);
    setSidebarOpen(false);
  };

  const passwortAendern = async (e) => {
    e.preventDefault();
    setPasswortFehler('');
    if (passwortForm.neues_passwort !== passwortForm.neues_passwort2) {
      setPasswortFehler('Die neuen Passwörter stimmen nicht überein.');
      return;
    }
    if (passwortForm.neues_passwort.length < 8) {
      setPasswortFehler('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setPasswortLaden(true);
    try {
      await api.put('/me/passwort', {
        aktuelles_passwort: passwortForm.aktuelles_passwort,
        neues_passwort: passwortForm.neues_passwort,
      });
      setPasswortErfolg(true);
    } catch (err) {
      setPasswortFehler(err.response?.data?.fehler || 'Fehler beim Ändern des Passworts');
    } finally {
      setPasswortLaden(false);
    }
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-yellow-500">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-bold text-yellow-600 text-lg shadow">
          P
        </div>
        <div>
          <div className="font-bold text-white text-sm">Post</div>
          <div className="text-yellow-200 text-xs">Rayon-Verwaltung</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-yellow-400 text-gray-900'
                  : 'text-yellow-100 hover:bg-yellow-700 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}

        {/* Admin-only Navigation */}
        {istAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <div className="text-yellow-400/60 text-xs font-semibold uppercase tracking-wide">Administration</div>
            </div>
            {adminNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-yellow-400 text-gray-900'
                      : 'text-yellow-100 hover:bg-yellow-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Benutzer-Info */}
      <div className="px-3 py-4 border-t border-yellow-700">
        <div className="flex items-center gap-3 px-3 py-2 text-yellow-100 text-sm">
          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-gray-900 font-bold text-xs">
            {auth?.benutzer?.name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{auth?.benutzer?.name}</div>
            <div className="text-yellow-300 text-xs">
              {auth?.benutzer?.rolle === 'admin' ? 'Administrator' : 'Schichtleiter'}
            </div>
          </div>
        </div>
        <button
          onClick={oeffnePasswortModal}
          className="flex items-center gap-2 w-full px-3 py-2 mt-1 text-yellow-200 hover:text-white hover:bg-yellow-700 rounded-lg text-sm transition-colors"
        >
          <KeyIcon className="w-4 h-4" />
          Passwort ändern
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 mt-1 text-yellow-200 hover:text-white hover:bg-yellow-700 rounded-lg text-sm transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="w-64 bg-yellow-600 flex flex-col">
          <Sidebar />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-yellow-600 shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white hover:text-yellow-200"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Hauptinhalt */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-yellow-600 px-4 py-3 flex items-center gap-3 shadow">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Bars3Icon className="w-6 h-6" />
          </button>
          <span className="text-white font-semibold">Rayon-Verwaltung</span>
        </div>

        {/* Seiten-Inhalt */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Passwort ändern Modal */}
      {passwortModalOffen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <KeyIcon className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Passwort ändern</h2>
            </div>
            {passwortErfolg ? (
              <div className="px-6 py-8 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">Passwort erfolgreich geändert.</p>
                <button onClick={() => setPasswortModalOffen(false)} className="btn-primary mt-4">Schließen</button>
              </div>
            ) : (
              <form onSubmit={passwortAendern} className="px-6 py-4 space-y-4">
                <div>
                  <label className="label">Aktuelles Passwort</label>
                  <input
                    type="password"
                    className="input"
                    value={passwortForm.aktuelles_passwort}
                    onChange={e => setPasswortForm({ ...passwortForm, aktuelles_passwort: e.target.value })}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="label">Neues Passwort <span className="text-gray-400 font-normal">(min. 8 Zeichen)</span></label>
                  <input
                    type="password"
                    className="input"
                    value={passwortForm.neues_passwort}
                    onChange={e => setPasswortForm({ ...passwortForm, neues_passwort: e.target.value })}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  {passwortForm.neues_passwort.length > 0 && (
                    <div className="mt-1">
                      <div className="flex gap-1">
                        {[...Array(4)].map((_, i) => {
                          const stärke = [
                            passwortForm.neues_passwort.length >= 8,
                            /[A-Z]/.test(passwortForm.neues_passwort),
                            /[0-9]/.test(passwortForm.neues_passwort),
                            /[^A-Za-z0-9]/.test(passwortForm.neues_passwort),
                          ];
                          const erfüllt = stärke.filter(Boolean).length;
                          return (
                            <div key={i} className={`h-1 flex-1 rounded-full ${i < erfüllt ? (erfüllt <= 1 ? 'bg-red-400' : erfüllt <= 2 ? 'bg-yellow-400' : erfüllt <= 3 ? 'bg-blue-400' : 'bg-green-500') : 'bg-gray-200'}`} />
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Stärker: Großbuchstaben, Zahlen, Sonderzeichen</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Neues Passwort bestätigen</label>
                  <input
                    type="password"
                    className="input"
                    value={passwortForm.neues_passwort2}
                    onChange={e => setPasswortForm({ ...passwortForm, neues_passwort2: e.target.value })}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {passwortFehler && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{passwortFehler}</div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setPasswortModalOffen(false)} className="btn-secondary">Abbrechen</button>
                  <button type="submit" disabled={passwortLaden} className="btn-primary">
                    {passwortLaden ? 'Speichern...' : 'Passwort ändern'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
