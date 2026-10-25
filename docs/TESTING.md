# Testing

## Stage A scope

`npm test`: Vitest tests public health shape, unavailable future routes, invalid environment configuration and accessible shell rendering using React Testing Library and jsdom.

`npm run test:e2e`: Playwright Chromium tests shell visibility and horizontal fit at 320, 390, 430 and 1280 pixels, plus a reduced-motion smoke test. Playwright starts Vite automatically. Install Chromium first with `npx playwright install chromium`.

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` verify types, lint, formatting and production compilation. Run build before standalone type checking on a fresh checkout so package declarations exist.

## Planned

Engine rules in B; four-client WebSocket and concurrency tests in C; interactive mobile UI in D; auth/uploads in E; voice in F; social synchronization in G; PWA and actual Android/iOS behavior in H; security regression, load tests and deployment checks in J.

Chromium emulation does not establish real iOS or Android compatibility. See STAGE_A_REPORT.md for actual executed results.
