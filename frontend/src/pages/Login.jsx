import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import api from '../utils/api.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ benutzername: '', passwort: '' });
  const [fehler, setFehler] = useState('');
  const [laden, setLaden] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFehler('');
    setLaden(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, { name: data.name, benutzername: form.benutzername });
      navigate('/');
    } catch (err) {
      if (!err.response) {
        setFehler('Keine Verbindung zum Server. Bitte stellen Sie sicher, dass das Backend läuft (node server.js).');
      } else if (err.response.status === 401) {
        setFehler('Ungültige Anmeldedaten. Benutzername: admin, Passwort: admin123');
      } else {
        setFehler(`Fehler: ${err.response.status} – ${err.response.data?.fehler || 'Unbekannter Fehler'}`);
      }
    } finally {
      setLaden(false);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-400 rounded-2xl shadow-lg mb-4">
            <span className="text-4xl font-black text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rayon-Verwaltung</h1>
          <p className="text-gray-500 mt-1">Anmeldung für Standortleiter</p>
        </div>

        {/* Login-Formular */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Benutzername</label>
              <input
                type="text"
                className="input"
                value={form.benutzername}
                onChange={(e) => setForm({ ...form, benutzername: e.target.value })}
                placeholder="admin"
                required
                autoFocus
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Passwort</label>
              <input
                type="password"
                className="input"
                value={form.passwort}
                onChange={(e) => setForm({ ...form, passwort: e.target.value })}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {fehler && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {fehler}
              </div>
            )}

            <button
              type="submit"
              disabled={laden}
              className="btn-primary w-full py-3 text-base"
            >
              {laden ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
            Standard-Login: admin / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
