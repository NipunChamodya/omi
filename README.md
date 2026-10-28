<div align="center">

# 🃏 OMI

### Sri Lanka's classic card game. Reimagined for friends, wherever they are.

**A lightweight, mobile-first, four-player multiplayer Omi experience.**

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active%20Development-f59e0b)

**[Get started](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [Testing](#-quality--verification) · [Security](#-security--privacy) · [License](#-license)**

</div>

---

> [!IMPORTANT]
> **Development and remote testing project — not a production-ready service.** Stage J hardening and local verification have been implemented. Production acceptance still requires deployment configuration, external verification, and resolution of outstanding game-rule decisions. Use **Node.js 22.23.4 or a newer patched Node 22 release**. See [Operations](docs/OPERATIONS.md), [Security Review](docs/SECURITY_REVIEW.md), and [Stage J Report](docs/STAGE_J_REPORT.md).

## ✨ The experience

OMI brings the familiar four-friend Sri Lankan card-table experience into the browser. Create or join a room, take your seat, and play through a responsive interface designed for phones as well as desktops.

The project combines a **server-authoritative rules engine**, real-time multiplayer, account security, and a modular frontend. It is built for experimentation, testing, and careful incremental development—not for claiming completed gameplay or production capabilities before they have been verified.

## 🎮 Features

| Area | What's included | Notes |
| --- | --- | --- |
| **Four-player tables** | Private rooms, joining, lobby, seat-aware game presentation | Four independent authenticated sessions are required |
| **Real-time multiplayer** | WebSockets, serialized server actions, state versioning, bounded reconnect and resynchronization | Server controls authoritative state |
| **Game engine** | Dependency-free deterministic transitions, card conservation checks, trick/round logic and confirmed round scoring | Subsequent-round dealer rotation requires owner clarification |
| **Mobile-first UI** | Responsive home, lobby, table and result views | Designed for small screens |
| **Accounts** | Google sign-in, server-managed sessions, profile metadata | Requires private OAuth configuration |
| **Social features** | Chat, reactions, shared-music controls and reporting workflows | Respect music rights and moderation obligations |
| **Voice** | Separately authorized voice signaling | Internet reliability depends on correct ICE/TURN setup and testing |
| **Presentation** | Card themes, interactions and game audio | See theme and interaction documentation |
| **Installable web experience** | PWA configuration and offline-related checks | Validate production service-worker behavior before release |
| **Security controls** | Origin/session checks, private projections, guarded remote-testing flow | See security and operations reports |

> [!NOTE]
> **Known gameplay limitations:** Rooms and scores currently live in memory and are lost when the server restarts. One round can complete with confirmed scoring, but continuation into another round awaits a dealer-rotation decision. Accusations and no-trump reporting remain unresolved by default. Returning home preserves the reserved seat; a dedicated server-side leave/forfeit action is not implemented.

## 🧭 How OMI works

```text
┌───────────────────────────────────────────────┐
│          Players on mobile / desktop          │
│            React + Vite frontend              │
└──────────────────────┬────────────────────────┘
                       │ HTTPS / WebSocket
                       ▼
┌───────────────────────────────────────────────┐
│           Fastify multiplayer server          │
│  Authentication • Rooms • Events • Voice      │
│  Validation • Private player projections      │
└──────────────┬───────────────────┬────────────┘
               │                   │
               ▼                   ▼
┌───────────────────────┐  ┌────────────────────┐
│  Private game engine  │  │ SQLite / optional  │
│  Rules & transitions  │  │ external storage   │
└───────────────────────┘  └────────────────────┘
```

The **server is the source of truth**: clients submit actions, the server validates and applies them, then sends each player only the information they are authorized to see. Game-engine internals and private hands are not part of the public wire contract.

## 🏗 Architecture

```text
OMI/
├── apps/
│   ├── web/                 # React, Vite, responsive game UI, PWA
│   └── server/              # Fastify, accounts, rooms, WebSockets, voice
├── packages/
│   ├── shared/              # Public contracts and wire types
│   └── game-engine/         # Private, deterministic game rules
├── infra/                   # NGINX, remote-testing and diagnostics
├── docs/                    # Setup, design, security and stage reports
├── .nvmrc                   # Supported Node major version
├── README.md
└── LICENSE
```

**Core stack:** TypeScript · React · Vite · Zustand · Fastify · WebSockets · SQLite · Vitest · Playwright · NGINX · Cloudflare Quick Tunnel (for gated remote testing).

## 🚀 Quick start

### Prerequisites

- **Node.js 22.23.4+ within the Node 22 release line** (use `.nvmrc` as a guide).
- npm.
- Google OAuth credentials for account sign-in, or an **explicitly enabled local-development guest mode**.

### 1. Install and build

```bash
# Clone your own repository
 git clone https://github.com/NipunChamodya/omi.git
 cd omi

# Activate a supported Node 22 runtime before continuing
 node --version

 npm ci
 npm run build
 cp .env.example apps/server/.env
```

> [!CAUTION]
> The example environment file is a starting point, **not** a working OAuth configuration. Edit `apps/server/.env` locally. Never commit it or place secrets in frontend `VITE_*` variables.

### 2. Configure authentication

Follow [Accounts Setup](docs/ACCOUNTS.md) to configure Google sign-in. Set `APP_ORIGIN` to the exact browser origin (local default: `http://127.0.0.1:5173`). The server loads `.env` from `apps/server/`.

For **local development only**, you may explicitly configure `ALLOW_GUESTS=true`. Guest access must remain disabled in production and public remote testing.

### 3. Start both development processes

**Terminal A — API server**

```bash
npm run dev:server
```

**Terminal B — web client**

```bash
npm run dev:web
```

Open **`http://127.0.0.1:5173`**. The health endpoint is **`http://127.0.0.1:3000/health`**. The Vite proxy forwards `/api` requests to the local backend.

### 4. Test with four players

Use **four isolated browser profiles/contexts** or separately authenticated devices. Four tabs sharing the same cookie are **one account**, not four players; opening the same table in another tab can replace the earlier connection.

For browser automation, Playwright can create four isolated mobile contexts.

## 🧪 Quality & verification

Run the checks relevant to your changes before opening a pull request:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test

npx playwright install chromium
npm run test:e2e

npm run build
npm run test:pwa
npm run check:build
npm run test:infra

# Private loopback load test: 8 clients, 30-second run
npm run test:load -- 8 30
```

**Targeted multiplayer tests:**

```bash
npm test -- apps/server/src/multiplayer/multiplayer.test.ts
```

The integration suite binds ephemeral loopback ports and exercises real four-client behavior. The test environment must permit local network listening; this requirement is not skipped. Passing automated tests does **not** certify public login, external connectivity, end-to-end match completion, or production readiness.

## 🌐 Remote multiplayer testing

OMI includes a guarded remote-testing path using a **compiled frontend**, standalone loopback **NGINX**, and a **Cloudflare Quick Tunnel**. The workflow initially exposes a maintenance gate rather than the game.

Follow [Cloudflare Multiplayer Setup](docs/CLOUDFLARE_MULTIPLAYER_SETUP.md) and [Remote Testing Troubleshooting](docs/REMOTE_TESTING_TROUBLESHOOTING.md) for current scripts and prerequisites.

**Important safeguards:**

1. Configure Google OAuth privately and register the **exact callback URL generated for the current tunnel**.
2. Confirm the maintenance gate is functioning before enabling access.
3. Explicitly activate application access only after callback registration.
4. Verify real sign-in, four external clients, reconnection, and network voice separately.
5. Shut down the managed testing services when finished.

A Quick Tunnel URL can change between runs. **A reachable HTTPS URL is not proof of a production-ready deployment.**

## 🔐 Security & privacy

OMI is designed around defense in depth:

- **Authoritative gameplay:** the server validates player actions and room membership.
- **Information isolation:** each player receives a recipient-specific projection, not hidden engine state.
- **Session and Origin enforcement:** multiplayer HTTP/WebSocket requests require an authorized account session and the expected Origin.
- **Account controls:** Google OIDC and durable server-side sessions; guest mode is development-only.
- **Voice separation:** voice signaling is separately authorized; voice audio is not routed through gameplay WebSockets or recorded by the application.
- **Restricted deployment:** private environment files, development endpoints and sensitive resources must not be exposed publicly.

For limitations, test coverage and release gates, read [Security Review](docs/SECURITY_REVIEW.md), [Production Security Readiness](docs/PRODUCTION_SECURITY_READINESS.md), and [Operations](docs/OPERATIONS.md).

**Found a vulnerability?** Please avoid publishing exploit details in a public issue. Contact the repository maintainer privately through an appropriate channel before disclosure.

## 📦 Data & persistence

| Data | Storage / behavior |
| --- | --- |
| Accounts, sessions, profile metadata | SQLite |
| Avatars | External object storage (requires configuration) |
| Rooms and scores | In memory; lost on restart |
| Social moderation reports | Database migration required for the additive report table |

For social report-review features, run:

```bash
npm run db:migrate -w @omi/server
```

Consult [Social Guide](docs/SOCIAL.md) for moderation and licensing responsibilities.

## 📚 Documentation

| Topic | Guide |
| --- | --- |
| Architecture and operations | [Operations](docs/OPERATIONS.md) · [UI Guide](docs/UI.md) |
| Authentication | [Accounts Setup](docs/ACCOUNTS.md) |
| Multiplayer protocol | [Multiplayer](docs/MULTIPLAYER.md) |
| Rules and engine | [Engine API](docs/ENGINE.md) · [Owner Rules](docs/OWNER_RULES.md) |
| Themes and card interactions | [Themes](docs/THEMES.md) · [Card Interactions](docs/CARD_INTERACTIONS.md) |
| Installable web app | [PWA](docs/PWA.md) |
| Voice and social | [Voice](docs/VOICE.md) · [Social](docs/SOCIAL.md) |
| Remote testing | [Cloudflare Setup](docs/CLOUDFLARE_MULTIPLAYER_SETUP.md) · [Troubleshooting](docs/REMOTE_TESTING_TROUBLESHOOTING.md) |
| Security and release gates | [Security Review](docs/SECURITY_REVIEW.md) · [Stage J Report](docs/STAGE_J_REPORT.md) |
| Investigation history | [CSP Fix Report](docs/CSP_FIX_REPORT.md) |
| Stage reports | [D](docs/STAGE_D_REPORT.md) · [E](docs/STAGE_E_REPORT.md) · [F](docs/STAGE_F_REPORT.md) · [G](docs/STAGE_G_REPORT.md) · [H](docs/STAGE_H_REPORT.md) · [I](docs/STAGE_I_REPORT.md) · [J](docs/STAGE_J_REPORT.md) |

## 🛣 Roadmap & open decisions

- [x] Server-authoritative four-player architecture and local integration tests
- [x] Google account/session architecture and local security checks
- [x] Responsive table, themes, card interactions and audio foundations
- [x] Gated Cloudflare remote-testing workflow
- [ ] Confirm dealer rotation and multi-round match progression
- [ ] Resolve accusations and no-trump reporting rules
- [ ] Define and implement explicit leave/forfeit behavior
- [ ] Complete real-world four-device multiplayer acceptance testing
- [ ] Verify remote voice with appropriate TURN configuration
- [ ] Complete avatar storage and production operations configuration
- [ ] Close outstanding production security and release gates

The checklist describes development scope, **not a promise of release dates**. Owner decisions and documented verification govern progression.

## 🤝 Contributing

Ideas, bug reports and improvements are welcome. Before contributing:

1. Check the existing documentation and open issues.
2. Describe the change and its effect on gameplay, privacy or security.
3. Keep server-authoritative boundaries intact and add relevant tests.
4. Run formatting, type checking, linting and appropriate test suites.
5. Never include secrets, local databases, private recordings or unlicensed assets.

Security-sensitive findings should be reported privately rather than disclosed in public issues.

## 📄 License

OMI is distributed under the **MIT License**. See [LICENSE](LICENSE) for the full text.

**Copyright © 2026 Nipun Chamodya Karunarathna.**

> [!IMPORTANT]
> The MIT License covers material the copyright holder has the right to license. Third-party fonts, card artwork, audio, music, trademarks and other assets may have separate licenses or usage restrictions. Review those assets before distributing the repository under MIT.

---

<div align="center">

**Made for the joy of playing Omi together. 🇱🇰**

Built and maintained by **Nipun Chamodya Karunarathna**.

</div>
