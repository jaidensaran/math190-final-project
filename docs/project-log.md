# Quant Lab project log

This is a curated record of decisions and completed work from our project conversations. It is meant for collaborators and does not reproduce the private chat transcript. New entries should be added alongside future source changes; there is currently no unattended chat-to-GitHub sync.

## Vision and structure

- Build a quantitative finance learning game with a company selector, user-weighted market and company scenarios, live-changing Monte Carlo output, contextual explanations, and a forecast journal.
- Organize the site into Game, Learning, Market, Algorithm, Math, Source Code, and Data & Connections sections.
- Teach Brownian motion, SDEs, Itô calculus, Markov processes, Monte Carlo simulation, and Black–Scholes while distinguishing an equity forecast from an option price.
- Make the app educational and transparent enough to support research, without presenting a simulation as a reliable trading signal or executing trades.

## Modeling decisions

- The game forecasts **stock returns and prices** under explicit assumptions. Black–Scholes appears in a separate hypothetical European-options sandbox. It prices under a risk-neutral measure and is not used as a direct stock-price predictor.
- Scenarios affect drift and volatility through illustrative, capped coefficients. Sliders begin at a neutral midpoint. The model uses exact GBM steps, antithetic common random numbers, and 252 trading days per year.
- For available historical series, volatility comes from up to 252 pre-origin log returns. Drift combines a raw historical estimate with a conservative prior and is capped. These choices are documented in the Math section and source.
- A forecast can be frozen before a historical replay. The journal then compares its distribution with subsequently revealed data using proper scoring and interval coverage. A single result is not evidence that a model is calibrated.

## Data and product behavior

- Company selection automatically requests the latest completed daily Yahoo Finance chart bars through the server adapter. Yahoo's public chart endpoint is unofficial and may be unavailable or rate-limited; the site displays source and error states.
- An optional server-only Alpha Vantage key supports another price adapter and news. CSV import remains available. Keys are never placed in browser code or this repository.
- Historical replay separates information available at the selected origin from later prices. The future close must not leak into the forecast before the reveal.
- The site includes bundled archived teaching series and clearly labels illustrative inputs where live history is unavailable.
- The Forecast journal saves rounds across reloads in the same browser. Users can export a JSON backup and import it later, including on another device. There is no account-based sync; browser storage may be cleared.
- Evaluated rounds appear in an overall leaderboard and per-stock summary using CRPS improvement over each round's unchanged baseline. The journal shows how selected slider assumptions affected that run's score in a one-factor neutralization check. These are model sensitivity results, not causal explanations of the market move.

## Repository and collaboration

- `math190-final-project` is the shared public source repository for the website, algorithms, tests, and this log.
- Future project decisions and substantive implementation changes can be summarized here when code is updated. Automatic verbatim archiving of chat messages is not configured.

## Version checkpoints

- **V1** is the deployed website before position sizing. Its Site version and source commit are recorded in [versions.md](versions.md).
- **V2** adds an interactive practice-budget position-sizing lab: a dollar allocation and whole-share estimate, modeled 5th-percentile loss constraint, CRRA utility across stock/cash weights, lower-drift sensitivity band, and dollar outcomes after a historical reveal. The game keeps prediction quality and allocation outcome separate.
- A user can enter the proposed stock purchase directly (for example, $1 million in AAPL) and choose a one-month or one-year horizon. The simulation reports expected, median, and central 80% dollar outcomes; the entered amount updates the practice budget if necessary. Historical Yahoo requests cover enough time after a replay origin for a one-year outcome when observations are available.
- The V2 sizing calculation is conditional on an estimated single-stock distribution and does not include other holdings, liabilities, taxes, live execution, or a complete suitability assessment.

## Open research questions

- Decide whether the primary score should emphasize predictive distribution quality, decisions after costs, or both.
- Validate data licensing, corporate-action treatment, point-in-time availability, and out-of-sample performance before using outputs for personal investment decisions.
- Consider richer return models only after measuring whether they improve replay scores over the current GBM baseline.
