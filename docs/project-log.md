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

## Repository and collaboration

- `math190-final-project` is the shared public source repository for the website, algorithms, tests, and this log.
- Future project decisions and substantive implementation changes can be summarized here when code is updated. Automatic verbatim archiving of chat messages is not configured.

## Open research questions

- Decide whether the primary score should emphasize predictive distribution quality, decisions after costs, or both.
- Validate data licensing, corporate-action treatment, point-in-time availability, and out-of-sample performance before using outputs for personal investment decisions.
- Consider richer return models only after measuring whether they improve replay scores over the current GBM baseline.
