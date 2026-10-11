# Quant Lab persistence

This module uses the existing PostgreSQL connection and the existing `tokenChecker` guard in `index.ts`.

```sh
bun scripts/verify-quant-db.ts  # Transactional integration check; rolls back all fixtures.
bun run migrate:quant          # Add the three Quant tables; safe to repeat.
bun run test:quant
bun run dev
```

Set `TWELVEDATA_API_KEY` in the backend environment to provide a server-side market-data key.
The UI may instead supply an individual key in a request body; neither option stores the key in the database.
Use HTTPS between the frontend and API in production.

## Tables

- `quant_market_snapshots`: per-user, versioned market-data metadata and SHA-256 fingerprint.
- `quant_daily_prices`: normalized daily open/close prices, uniquely keyed by snapshot and date.
- `quant_backtest_runs`: immutable snapshot references, settings, engine version, summary, and the full computed report.

`POST /quant/market-data` first looks up the owner's stored ticker history with at least the requested number of days.
Stored history remains reusable across calendar days without a provider call. A missing ticker, longer requested history, or explicit refresh fetches Twelve Data and persists metadata and rows in one transaction.
The UI displays when a stored snapshot was fetched; refresh is an explicit, quota-consuming action.
Unchanged prices reuse the existing snapshot; revised prices create a new snapshot. No historical run's prices are overwritten.

`GET /quant/market-data` lists the latest stored snapshot per ticker without loading price bars.
`GET /quant/market-data/:id` loads one owner-scoped snapshot without calling Twelve Data; pairing two stored tickers uses this endpoint twice.
`POST /quant/runs` accepts `snapshotA`, `snapshotB`, `settings`, and optional `name`; it recomputes the result on the server.
`GET /quant/runs` returns the user's 50 most recent summaries. `GET /quant/runs/:id` includes the saved report and its original inputs.
Queries filter by owner; composite foreign keys additionally prevent a run from referring to another user's snapshot.

## Migration and engine maintenance

The additive SQL lives in `migrations/quant/001_quant_persistence.sql`, outside the repository's ignored `drizzle` directory.
The dedicated migration runner uses a transaction and advisory lock and does not execute pending legacy migrations.
Do not substitute the legacy migration queue without reviewing its existing pending changes.

The files under `services/quant/core/` are committed deployment artifacts generated from the frontend repository's tested TypeScript.
After changing the source engine/provider, bump `QUANT_ENGINE_VERSION` as appropriate, run `npm run sync:quant-backend` in `x-webapp`,
run tests in both repositories, and deploy both. The backend has no runtime dependency on the frontend checkout.
Never hand-edit the generated files. Existing saved reports retain their engine version and results.

`verify-quant-db.ts` exercises real database cache reuse, duplicate prevention, immutable snapshots, saved-report reopening,
cross-user isolation, and positive-price constraints. It creates no persistent fixture records.
