import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
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
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
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
];

const adminNavigation = [
  { name: 'Benutzerverwaltung', href: '/benutzer', icon: ShieldCheckIcon },
  { name: 'Audit-Log', href: '/audit-log', icon: ClipboardDocumentListIcon },
];

export default function Layout() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const istAdmin = auth?.benutzer?.rolle === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
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
    </div>
  );
}
