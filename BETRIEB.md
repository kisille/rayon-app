# Betriebshandbuch – Post Rayon-Verwaltung

Dieses Dokument richtet sich an die IT-Abteilung der Österreichischen Post AG und beschreibt Installation, Konfiguration und Betrieb der Rayon-Verwaltungsanwendung.

---

## Systemanforderungen

| Komponente | Anforderung |
|---|---|
| Betriebssystem | Linux (empfohlen: Ubuntu 22.04 LTS) |
| Docker | Version 24+ |
| Docker Compose | Version 2.20+ |
| RAM | Min. 512 MB (empfohlen 1 GB) |
| Festplatte | Min. 2 GB für Daten und Backups |
| TLS-Zertifikat | Gültig für die Produktions-Domain |

---

## Erstmalige Installation

### 1. Repository klonen / Dateien übertragen

```bash
# Dateien auf den Server übertragen (z.B. per scp oder git)
git clone <repository-url> /opt/rayon-app
cd /opt/rayon-app
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp backend/.env.example .env
nano .env
```

Pflichtfelder in `.env`:

```env
# Langen zufälligen Schlüssel generieren:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-stelliger-zufälliger-hex-string>

# Produktions-URL der Anwendung
CORS_ORIGIN=https://rayon.post.at

# Optionales initiales Admin-Passwort (nur beim ersten Start)
# ADMIN_PASSWORT=<sicheres-startpasswort>

# Pfad zu den TLS-Zertifikaten
TLS_CERT_DIR=/etc/letsencrypt/live/rayon.post.at
```

### 3. TLS-Zertifikate bereitstellen

**Option A: Let's Encrypt (certbot)**
```bash
apt install certbot
certbot certonly --standalone -d rayon.post.at
# Zertifikate liegen dann unter: /etc/letsencrypt/live/rayon.post.at/
```

**Option B: Unternehmens-PKI / eigenes Zertifikat**
```bash
mkdir -p /opt/rayon-app/certs
cp fullchain.pem /opt/rayon-app/certs/
cp privkey.pem   /opt/rayon-app/certs/
chmod 600 /opt/rayon-app/certs/privkey.pem
# In .env setzen: TLS_CERT_DIR=/opt/rayon-app/certs
```

### 4. Anwendung starten

```bash
cd /opt/rayon-app
docker compose --env-file .env up -d
```

### 5. Erster Login

Beim ersten Start wird ein Admin-Benutzer mit zufälligem Passwort angelegt.
Das Passwort wird **einmalig** in den Container-Logs angezeigt:

```bash
docker compose logs rayon-app | grep "Initiales Passwort"
```

**Sofort nach dem ersten Login das Passwort über "Passwort ändern" in der Sidebar ändern!**

---

## Täglicher Betrieb

### Anwendung starten / stoppen

```bash
# Starten
docker compose --env-file .env up -d

# Stoppen
docker compose down

# Neu starten
docker compose --env-file .env restart
```

### Logs anzeigen

```bash
# Alle Services
docker compose logs -f

# Nur Backend
docker compose logs -f rayon-app

# Nur nginx
docker compose logs -f nginx
```

### Status prüfen

```bash
docker compose ps
curl -k https://localhost/api/health
```

---

## Updates einspielen

```bash
cd /opt/rayon-app

# Neue Version holen
git pull

# Container neu bauen und starten (Daten bleiben erhalten)
docker compose --env-file .env up -d --build
```

---

## Datensicherung

### Automatische Backups

Die Anwendung erstellt **täglich um 02:00 Uhr** automatisch ein Backup der Datenbank.
Backups werden im Docker-Volume unter `/data/backups/` gespeichert und 7 Tage aufbewahrt.

### Manuelles Backup

```bash
# Backup-Verzeichnis auf Host anzeigen
docker run --rm -v rayon-app_rayon-daten:/data alpine ls /data/backups/

# Backup auf Host-Dateisystem kopieren
docker run --rm -v rayon-app_rayon-daten:/data -v $(pwd):/backup alpine \
  cp /data/rayon.db /backup/rayon-$(date +%Y%m%d).db
```

### Datenbank-Wiederherstellung

```bash
# Anwendung stoppen
docker compose down

# Backup einspielen
docker run --rm -v rayon-app_rayon-daten:/data -v $(pwd):/backup alpine \
  cp /backup/rayon-20260101.db /data/rayon.db

# Anwendung neu starten
docker compose --env-file .env up -d
```

---

## Benutzerverwaltung

Die Benutzerverwaltung erfolgt im Frontend unter **Administration → Benutzerverwaltung** (nur für Administratoren).

| Rolle | Berechtigungen |
|---|---|
| **Administrator** | Voller Zugriff, inkl. Benutzerverwaltung und Audit-Log |
| **Schichtleiter** | Tagesplanung, Abwesenheiten, Mitnahmeplanung – keine Benutzerverwaltung |

### Passwort zurücksetzen (Admin)

1. Als Admin einloggen
2. **Administration → Benutzerverwaltung** öffnen
3. Benutzer bearbeiten → neues Passwort eingeben

---

## Sicherheitshinweise

- `JWT_SECRET` **niemals** im Klartext in Versionskontrolle speichern
- `.env`-Datei vor unberechtigtem Zugriff schützen: `chmod 600 .env`
- TLS-Zertifikate regelmäßig erneuern (Let's Encrypt: automatisch via certbot-renew)
- Regelmäßige Updates von Docker-Images: `docker compose pull && docker compose up -d`
- Audit-Log unter **Administration → Audit-Log** regelmäßig prüfen

---

## Firewall-Konfiguration

Nur folgende Ports müssen von außen erreichbar sein:

| Port | Protokoll | Verwendung |
|---|---|---|
| 443 | TCP | HTTPS (Produktivbetrieb) |
| 80 | TCP | HTTP → automatischer Redirect auf HTTPS |

Port 3001 (Backend) darf **nicht** direkt von außen erreichbar sein.

---

## DSGVO / Datenschutz

- **Datenexport** (Art. 15 DSGVO): `GET /api/dsgvo/export/:mitarbeiterId` (Admin-only)
- **Datenlöschung**: Mitarbeiter können über die Mitarbeiterverwaltung deaktiviert werden
- Alle schreibenden Aktionen werden im **Audit-Log** protokolliert

---

## Fehlerbehebung

### "JWT_SECRET muss gesetzt sein" beim Start

→ `.env`-Datei prüfen und `JWT_SECRET` setzen.

### Alle Benutzer werden nach Neustart ausgeloggt

→ `JWT_SECRET` ist bei jedem Start unterschiedlich (kein fester Wert gesetzt). `JWT_SECRET` als festen Wert in `.env` hinterlegen.

### nginx startet nicht (TLS-Fehler)

→ Zertifikatpfad in `.env` (`TLS_CERT_DIR`) prüfen. Dateien `fullchain.pem` und `privkey.pem` müssen vorhanden sein.

### Datenbank beschädigt

→ Backup aus `/data/backups/` einspielen (siehe Abschnitt Wiederherstellung).

### Container stürzt ab

```bash
docker compose logs rayon-app --tail=50
```

---

## Kontakt / Support

Bei technischen Problemen: IT-Helpdesk der Österreichischen Post AG
