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
            {/* Legacy-Redirect */}
            <Route path="vertretung" element={<Navigate to="/mitnahme" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
