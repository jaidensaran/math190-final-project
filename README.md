# Quant Lab research game

Educational stock-return simulation and historical replay. No brokerage or trade execution.

**Live site:** https://quant-lab-jaiden-731.korporatemonkee3.chatgpt.site/  
**Project log:** [docs/project-log.md](docs/project-log.md)

The website, JavaScript simulation model, Python reference model, Yahoo Finance adapter, build scripts, and tests live together in this repository. `web/` contains the game and the readable Python reference; `worker/` contains the server and price adapters; `scripts/` contains the build and verification tools. `web/data/history.json` is an archived teaching dataset. The generated `dist/` directory is omitted from version control.

Run `npm run build`, `npm test`, then `npm run dev`. The build embeds web assets into a Cloudflare Worker ES module at `dist/server/index.js`. Keep the Site project ID and audience unchanged.

## Data

Four bundled company histories (AAPL, MSFT, IBM, SBUX) and the archived index series come from https://github.com/plotly/datasets/blob/master/stockdata.csv, subset 2013–2016. Corporate-action adjustment methodology is not verified. All game prices are rebased to 100; these are not current quotes. Other company inputs are explicitly illustrative until CSV or provider data is supplied.

Yahoo Finance is now the default price adapter through its unofficial public chart endpoint, with no account, cookie, crumb or key. `/api/prices?symbol=AAPL&provider=yahoo` requests two years of completed daily bars; optional `origin=YYYY-MM-DD` requests a bounded historical window (400 days before / 180 days after). Rows use adjusted closes when provided, exchange-local dates, USD currency validation, and exclude unfinished current-session daily bars. Vendor adjustments may be revised and can include dividend effects; they are not a point-in-time fundamental dataset.

Stock selection and the initial game view load daily prices automatically. Forward lab is the initial mode. A cancellable, deduplicating loader ensures late responses cannot replace a newer company selection. Successful requests are cached for up to 15 minutes. Errors never silently replace existing data; HTTP 429/401/403 produce explicit messages and cooldowns. There is no credential scraping, alternate-host rotation, or automatic retry. Yahoo's upstream availability must be checked from the actual hosting environment; a no-key adapter being configured is not proof it can retrieve data.

Server-only `ALPHA_VANTAGE_API_KEY` retains optional Alpha Vantage prices (`provider=alpha`) and news. `ALPHA_VANTAGE_ADJUSTED=true` selects adjusted closes when the plan permits. No secret is needed for Yahoo. Browser price checks occur every 15 minutes only while Forward lab is open and unlocked. There is no unattended background schedule or chat access.

CSV imports and forecast journals use local browser storage. Forecasts are frozen before replay reveal; this is an educational browser simulation, not a tamper-proof competition. Generic event descriptions are not reconstructed dated news. Historical vendor revisions, adjustment basis, survivorship, and source consistency require independent review for production research.

## Model

Exact physical-measure GBM with antithetic common random numbers; annualization 252. Up to 252 pre-origin log returns calibrate volatility. Drift is 25% raw sample estimate + 75% illustrative 5% prior, capped at -20%/+25%. Slider coefficients are illustrative and averaged within groups before summing. Sensitivity caps are explicit in Math and Python. No jumps or stochastic volatility implemented.

Black–Scholes sandbox uses hypothetical S=100, scenario volatility (not option-chain IV), and user-entered European pricing inputs under Q. Forecast scoring uses empirical CRPS and interval coverage; one round cannot establish calibration. Allocation scoring assumes zero cash yield and a 10bps round-trip cost, without taxes/dividends/execution.

Python is a reproducible standard-library reference, generated from `scripts/quant_model.template.py` with the same company/factor catalog. Tests verify JavaScript/Python parity, GBM moments, CRPS, pricing identities, data validation, unconfigured Alpha behavior, Yahoo parsing/session completeness, cache reuse, and explicit upstream errors.
