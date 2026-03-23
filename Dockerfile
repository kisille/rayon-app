# ─── Stage 1: Frontend bauen ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Backend + Frontend zusammenführen ───────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Nur Produktions-Abhängigkeiten installieren
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Gebautes Frontend einbinden
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Datenbankverzeichnis als Volume-Mount-Punkt vorbereiten
RUN mkdir -p /data/backups

# Nicht als root laufen
RUN addgroup -S rayon && adduser -S rayon -G rayon
RUN chown -R rayon:rayon /app /data
USER rayon

ENV PORT=3001
ENV DB_PATH=/data/rayon.db
ENV FRONTEND_DIST=/app/frontend-dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "--no-warnings", "server.js"]
