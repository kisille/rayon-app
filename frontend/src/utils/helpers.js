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
