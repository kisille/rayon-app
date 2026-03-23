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
