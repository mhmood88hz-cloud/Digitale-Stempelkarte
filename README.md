# Stampcard SaaS

Digitale Stempelkarte für Friseursalons als Multi-Tenant-SaaS. Kunden erhalten
einen Apple-Wallet-/Google-Wallet-Pass; Salon-Personal vergibt bei jedem
Besuch einen Stempel durch Scannen des Passes; bei einer konfigurierbaren
Schwelle (Standard: 10 Stempel) wird ein Rabatt (Standard: 10 €) freigeschaltet.

**Status:** frühes Scaffold, noch kein produktiver Betrieb.

## Architektur

- Backend: Node.js + TypeScript + Fastify
- DB: PostgreSQL + Prisma ORM
- Apple Wallet: `.pkpass`-Erzeugung + PassKit-Web-Service + APNs-Updates
- Google Wallet: Loyalty Class/Object über die Google Wallet API
- Multi-Tenancy: jeder Salon ist ein eigener Tenant (`salon_id` auf allen
  Geschäftstabellen)

Details zu Datenmodell und Kernflüssen: siehe Projektplan (intern).

## Lokales Setup

```bash
npm install
docker compose up -d          # startet lokale Postgres-Instanz
cp .env.example .env          # DATABASE_URL passt bereits zu docker-compose.yml
npm run prisma:migrate
npm test
npm run dev                   # startet den Server auf PORT (Default 3000)
```

Health-Check: `curl http://localhost:3000/health`

## Externe Voraussetzungen

Die Wallet-Integrationen brauchen echte Anbieter-Accounts, bevor sie
funktionieren — beides muss der Salon-/SaaS-Betreiber selbst einrichten:

- **Apple Wallet**: Apple Developer Program Mitgliedschaft (99 USD/Jahr),
  daraus ein Pass-Type-ID-Zertifikat, das WWDR-Zwischenzertifikat und ein
  APNs-Key für Push-Updates an bereits installierte Passes. Siehe
  `.env.example` für die benötigten Pfade/Variablen.
- **Google Wallet**: Google-Wallet-Issuer-Account (Google Business Console)
  mit Service-Account-Credential.

Ohne diese Credentials laufen Backend, DB und Personal-/Admin-Dashboards
normal — nur die tatsächliche Pass-Ausstellung schlägt an der jeweiligen
Stelle fehl, bis echte Zertifikate/Keys hinterlegt sind.

## Delegation über Fleetgate

Ein Teil der Implementierung (klar abgegrenzte, gut testbare Einheiten wie
CRUD-Routen oder Dashboard-Komponenten) wird über
[Fleetgate](../Fleetgate) an kostenlose LLM-CLIs delegiert, um Aufwand zu
sparen. Architektonisch zentrale und sicherheitsrelevante Teile (DB-Schema,
Auth, Pass-Signierung, Multi-Tenant-Guards) werden nicht delegiert. Jeder
delegierte Diff wird vor dem Commit manuell geprüft
(`git status` / `git diff` in diesem Ordner).

## Tests

```bash
npm test
```
