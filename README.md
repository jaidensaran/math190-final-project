# Quant Lab research game

Educational stock-return simulation and historical replay. No brokerage or trade execution.

**Live site:** https://quant-lab-jaiden-731.korporatemonkee3.chatgpt.site/  
**Project log:** [docs/project-log.md](docs/project-log.md)
**Version checkpoints:** [docs/versions.md](docs/versions.md)

The website, JavaScript simulation model, Python reference model, Yahoo Finance adapter, build scripts, and tests live together in this repository. `web/` contains the game and the readable Python reference; `worker/` contains the server and price adapters; `scripts/` contains the build and verification tools. `web/data/history.json` is an archived teaching dataset. The generated `dist/` directory is omitted from version control.

Run `npm run build`, `npm test`, then `npm run dev`. The build embeds web assets into a Cloudflare Worker ES module at `dist/server/index.js`. Keep the Site project ID and audience unchanged.

## Data

Four bundled company histories (AAPL, MSFT, IBM, SBUX) and the archived index series come from https://github.com/plotly/datasets/blob/master/stockdata.csv, subset 2013–2016. Corporate-action adjustment methodology is not verified. New rounds with real history start price paths at the dated source close, while illustrative rounds without history use an index of 100. Older V1/V2 journal rounds retain their index-100 basis. Other company inputs are explicitly illustrative until CSV or provider data is supplied.

Yahoo Finance is now the default price adapter through its unofficial public chart endpoint, with no account, cookie, crumb or key. `/api/prices?symbol=AAPL&provider=yahoo` requests two years of completed daily bars; optional `origin=YYYY-MM-DD` requests a bounded historical window (400 days before / 400 days after) to support a one-year replay. Rows use adjusted closes when provided, exchange-local dates, USD currency validation, and exclude unfinished current-session daily bars. Vendor adjustments may be revised and can include dividend effects; they are not a point-in-time fundamental dataset.

Stock selection and the initial game view load daily prices automatically. Forward lab is the initial mode. A cancellable, deduplicating loader ensures late responses cannot replace a newer company selection. Successful requests are cached for up to 15 minutes. Errors never silently replace existing data; HTTP 429/401/403 produce explicit messages and cooldowns. There is no credential scraping, alternate-host rotation, or automatic retry. Yahoo's upstream availability must be checked from the actual hosting environment; a no-key adapter being configured is not proof it can retrieve data.

Server-only `ALPHA_VANTAGE_API_KEY` retains optional Alpha Vantage prices (`provider=alpha`) and news. `ALPHA_VANTAGE_ADJUSTED=true` selects adjusted closes when the plan permits. No secret is needed for Yahoo. Browser price checks occur every 15 minutes only while Forward lab is open and unlocked. There is no unattended background schedule or chat access.

CSV imports and forecast journals use local browser storage. The Forecast journal has Export journal JSON and Import journal JSON controls: export a backup before clearing browser data or switching devices, then import it to restore saved rounds. Import validates records, merges by record ID, and recomputes evaluation scores. Reloads retain records in the same browser; there is no account sync. Evaluated forecasts are ranked by CRPS improvement against each run's unchanged baseline, with per-stock summaries and one-factor score sensitivity checks. Repeated runs on one outcome are not independent evidence, and cross-stock ranks mix different prediction tasks. Forecasts are frozen before replay reveal; this is an educational browser simulation, not a tamper-proof competition. Generic event descriptions are not reconstructed dated news. Historical vendor revisions, adjustment basis, survivorship, and source consistency require independent review for production research.

## Model

Exact physical-measure GBM with antithetic common random numbers; annualization 252. Up to 252 pre-origin log returns calibrate volatility. Drift is 25% raw sample estimate + 75% illustrative 5% prior, capped at -20%/+25%. Slider coefficients are illustrative and averaged within groups before summing. Sensitivity caps are explicit in Math and Python. No jumps or stochastic volatility implemented.

Black–Scholes sandbox uses hypothetical S=100, scenario volatility (not option-chain IV), and user-entered European pricing inputs under Q. Forecast scoring uses empirical CRPS and interval coverage; one round cannot establish calibration. Allocation scoring assumes zero cash yield and a 10bps round-trip cost, without taxes/dividends/execution.

V2 adds a direct proposed-investment input and one-month, three-month, or one-year horizons. For example, a $1 million proposed Apple purchase projects a distribution of dollar profit/loss from the current slider-weighted simulation. A practice budget and allocation percentage remain editable. The app shows expected and median net P/L, an 80% simulated P/L range, modeled 5th-percentile P/L, loss frequency, and approximate whole shares using a dated close when available. A model-preferred sizing band maximizes simulated CRRA utility under a user-entered 5th-percentile loss limit, then repeats with lower drift to expose estimation sensitivity. The calculation uses a single stock plus zero-yield cash and is conditional on the current forecast model, not a validated personal investment recommendation. Prior V1 journal records still import and display.

The later V2 teaching update moves assumptions before the price scenarios and money decision, adds keyboard-accessible hover explanations, and starts new real-data price paths at the dated share close. The middle 80% chart band and ending interval are 10th–90th percentile summaries; they are not standard-deviation confidence intervals or real-world guarantees. A separate 1–30 year holding illustration analytically compounds the current constant GBM parameters and is excluded from forecast locking and scoring. Price paths and replay dollar outcomes use source closes, while adjusted returns may have informed calibration; projected dividends, taxes, and changing parameters are not modeled.

Python is a reproducible standard-library reference, generated from `scripts/quant_model.template.py` with the same company/factor catalog. Tests verify JavaScript/Python parity, GBM moments, CRPS, pricing identities, data validation, unconfigured Alpha behavior, Yahoo parsing/session completeness, cache reuse, and explicit upstream errors.
