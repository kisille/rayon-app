import React, { createContext, useContext, useState, useEffect } from 'react';
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
import Benutzer from './pages/Benutzer.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Jahreskalender from './pages/Jahreskalender.jsx';

// Auth-Kontext
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// JWT-Ablaufzeit aus Token dekodieren (ohne Signaturprüfung – nur für UI-Logik)
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    const benutzer = localStorage.getItem('benutzer');
    if (!token) return null;
    // Token bereits abgelaufen? Direkt ausloggen.
    const exp = getTokenExpiry(token);
    if (exp && Date.now() > exp) {
      localStorage.removeItem('token');
      localStorage.removeItem('benutzer');
      return null;
    }
    return { token, benutzer: JSON.parse(benutzer) };
  });

  // Automatischer Logout wenn JWT abläuft
  useEffect(() => {
    if (!auth?.token) return;
    const exp = getTokenExpiry(auth.token);
    if (!exp) return;
    const verbleibend = exp - Date.now();
    if (verbleibend <= 0) {
      localStorage.removeItem('token');
      localStorage.removeItem('benutzer');
      setAuth(null);
      window.location.href = '/login?grund=sitzung-abgelaufen';
      return;
    }
    const timer = setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('benutzer');
      setAuth(null);
      window.location.href = '/login?grund=sitzung-abgelaufen';
    }, verbleibend);
    return () => clearTimeout(timer);
  }, [auth?.token]);

  useEffect(() => {
    const disableAutocomplete = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.setAttribute('autocomplete', 'off');
        e.target.setAttribute('data-lpignore', 'true');
        e.target.setAttribute('data-form-type', 'other');
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
  );
}

export default App;
