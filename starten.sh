#!/bin/bash
# Rayon-App – Starter für macOS / Linux

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo "  =========================================="
echo "    Rayon-App - wird gestartet..."
echo "  =========================================="
echo ""

# Node.js prüfen
if ! command -v node &> /dev/null; then
    echo "  FEHLER: Node.js ist nicht installiert!"
    echo ""
    echo "  Bitte Node.js 22+ installieren von: https://nodejs.org"
    echo ""
    exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]))" 2>/dev/null; echo $?)
if [ "$NODE_VER" -lt 22 ] 2>/dev/null; then
    echo "  WARNUNG: Node.js 22+ empfohlen (aktuell: $(node --version))"
fi

# Backend-Abhängigkeiten installieren (einmalig)
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "  Backend-Pakete werden installiert (einmalig)..."
    cd "$BACKEND_DIR" && npm install
    echo ""
fi

# Frontend bauen falls kein dist vorhanden
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo "  Frontend wird gebaut (einmalig, ca. 30 Sekunden)..."
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        cd "$FRONTEND_DIR" && npm install
    fi
    cd "$FRONTEND_DIR" && npm run build
    echo ""
fi

# Lokale IP ermitteln
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unbekannt")

echo "  =========================================="
echo "    Rayon-App läuft!"
echo "  =========================================="
echo ""
echo "    Auf DIESEM Mac öffnen:"
echo "    http://localhost:3001"
echo ""
if [ "$LOCAL_IP" != "unbekannt" ]; then
echo "    Von anderen Geräten im Netzwerk:"
echo "    http://$LOCAL_IP:3001"
echo ""
fi
echo "    Login: admin / admin123"
echo ""
echo "    DIESES FENSTER NICHT SCHLIESSEN!"
echo "    (Ctrl+C zum Beenden)"
echo "  =========================================="
echo ""

# Browser nach kurzer Verzögerung öffnen
(sleep 2 && open "http://localhost:3001") &

cd "$BACKEND_DIR"
FRONTEND_DIST="$FRONTEND_DIR/dist" node --no-warnings server.js
