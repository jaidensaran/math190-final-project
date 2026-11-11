"""Quant Lab v0.2 — inspectable educational model, standard library only.

Run: python3 quant_model.py
     python3 quant_model.py --company AAPL --csv prices.csv --date 2015-08-03
     python3 quant_model.py --weights '{"rates":80,"growth":65}' --days 63

Coefficients are illustrative, not estimated causal effects. A scenario is not
an investment recommendation. Dates after the origin are excluded from fitting.
Archived/vendor adjustments and data revisions need independent verification.
No account access, brokerage connection, or live execution is included.
Third-party data retains its original rights. This reference mirrors the JS
engine, including its random generator, antithetic paths, and calibration caps.
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import statistics
from datetime import date

CATALOG = json.loads(r'''{"companies":[{"symbol":"AAPL","name":"Apple","sector":"Technology","profile":"Established","about":"Devices, services, ecosystem economics.","watch":"Demand, China exposure, product cycles, services margins.","mu":0.09,"sigma":0.26},{"symbol":"MSFT","name":"Microsoft","sector":"Technology","profile":"Established","about":"Enterprise software and cloud infrastructure.","watch":"Cloud demand, AI capital spending, enterprise budgets.","mu":0.09,"sigma":0.24},{"symbol":"NVDA","name":"NVIDIA","sector":"Technology","profile":"Established","about":"Accelerated computing and semiconductor platforms.","watch":"Export restrictions, chip supply, customer concentration.","mu":0.12,"sigma":0.48},{"symbol":"AMD","name":"AMD","sector":"Technology","profile":"Established","about":"Processors and accelerated computing.","watch":"Product execution, foundry capacity, competition.","mu":0.1,"sigma":0.45},{"symbol":"IBM","name":"IBM","sector":"Technology","profile":"Established","about":"Enterprise technology, consulting, and hybrid cloud.","watch":"Recurring revenue, services demand, execution.","mu":0.06,"sigma":0.22},{"symbol":"NET","name":"Cloudflare","sector":"Technology","profile":"Growth-oriented","about":"Internet infrastructure and security software.","watch":"Enterprise adoption, competition, operating leverage.","mu":0.1,"sigma":0.5},{"symbol":"IOT","name":"Samsara","sector":"Technology","profile":"Growth-oriented","about":"Connected operations software.","watch":"Customer growth, retention, path to profitability.","mu":0.1,"sigma":0.48},{"symbol":"AMZN","name":"Amazon","sector":"Consumer discretionary","profile":"Established","about":"Commerce, logistics, cloud, and advertising.","watch":"Consumer demand, cloud growth, fulfillment costs.","mu":0.09,"sigma":0.32},{"symbol":"TSLA","name":"Tesla","sector":"Consumer discretionary","profile":"Growth-oriented","about":"Electric vehicles, energy storage, and related technology.","watch":"Pricing, deliveries, competition, execution.","mu":0.1,"sigma":0.55},{"symbol":"SBUX","name":"Starbucks","sector":"Consumer discretionary","profile":"Established","about":"Global coffee retail and licensed stores.","watch":"Traffic, wage costs, input prices, brand execution.","mu":0.06,"sigma":0.27},{"symbol":"NKE","name":"Nike","sector":"Consumer discretionary","profile":"Established","about":"Athletic footwear and apparel.","watch":"Inventory, consumer demand, distribution, competition.","mu":0.07,"sigma":0.3},{"symbol":"ETSY","name":"Etsy","sector":"Consumer discretionary","profile":"Specialist","about":"Marketplace for creative and distinctive goods.","watch":"Discretionary demand, seller economics, acquisition costs.","mu":0.08,"sigma":0.48},{"symbol":"DUOL","name":"Duolingo","sector":"Consumer discretionary","profile":"Specialist","about":"Digital language learning and subscriptions.","watch":"Paid conversion, engagement, product investment.","mu":0.1,"sigma":0.5},{"symbol":"GOOGL","name":"Alphabet","sector":"Communication services","profile":"Established","about":"Search, advertising, video, and cloud services.","watch":"Advertising budgets, regulation, AI competition.","mu":0.09,"sigma":0.28},{"symbol":"META","name":"Meta","sector":"Communication services","profile":"Established","about":"Social platforms and digital advertising.","watch":"Ad demand, privacy rules, capital expenditure.","mu":0.09,"sigma":0.35},{"symbol":"NFLX","name":"Netflix","sector":"Communication services","profile":"Established","about":"Subscription and advertising-supported entertainment.","watch":"Retention, content spend, pricing, ad monetization.","mu":0.09,"sigma":0.36},{"symbol":"DIS","name":"Disney","sector":"Communication services","profile":"Established","about":"Entertainment, streaming, and experiences.","watch":"Parks demand, media economics, content execution.","mu":0.07,"sigma":0.29},{"symbol":"JPM","name":"JPMorgan Chase","sector":"Financials","profile":"Established","about":"Diversified banking and financial services.","watch":"Credit losses, deposit costs, rates, capital rules.","mu":0.07,"sigma":0.24},{"symbol":"BAC","name":"Bank of America","sector":"Financials","profile":"Established","about":"Consumer and institutional banking.","watch":"Yield curve, funding, securities book, credit quality.","mu":0.07,"sigma":0.28},{"symbol":"V","name":"Visa","sector":"Financials","profile":"Established","about":"Global payments network.","watch":"Spending, cross-border volumes, regulation.","mu":0.08,"sigma":0.23},{"symbol":"SOFI","name":"SoFi","sector":"Financials","profile":"Growth-oriented","about":"Digital financial services and lending.","watch":"Funding costs, credit performance, member growth.","mu":0.09,"sigma":0.52},{"symbol":"COIN","name":"Coinbase","sector":"Financials","profile":"Specialist","about":"Crypto asset trading and related services.","watch":"Trading activity, regulation, digital asset cycles.","mu":0.1,"sigma":0.7},{"symbol":"JNJ","name":"Johnson & Johnson","sector":"Healthcare","profile":"Established","about":"Pharmaceuticals and medical technology.","watch":"Clinical outcomes, litigation, pricing, innovation.","mu":0.05,"sigma":0.2},{"symbol":"LLY","name":"Eli Lilly","sector":"Healthcare","profile":"Established","about":"Research-based pharmaceutical products.","watch":"Trials, approvals, manufacturing capacity, pricing.","mu":0.08,"sigma":0.31},{"symbol":"UNH","name":"UnitedHealth","sector":"Healthcare","profile":"Established","about":"Health insurance and healthcare services.","watch":"Medical costs, reimbursement, regulation.","mu":0.06,"sigma":0.27},{"symbol":"RXRX","name":"Recursion","sector":"Healthcare","profile":"Specialist","about":"Technology-enabled drug discovery.","watch":"Clinical evidence, cash runway, partnerships.","mu":0.08,"sigma":0.65},{"symbol":"XOM","name":"Exxon Mobil","sector":"Energy","profile":"Established","about":"Integrated energy production and refining.","watch":"Oil and gas prices, refining margins, capital discipline.","mu":0.06,"sigma":0.29},{"symbol":"CVX","name":"Chevron","sector":"Energy","profile":"Established","about":"Integrated oil and gas operations.","watch":"Commodity prices, project execution, geopolitics.","mu":0.06,"sigma":0.28},{"symbol":"FSLR","name":"First Solar","sector":"Technology","profile":"Specialist","about":"Solar module manufacturing.","watch":"Trade policy, incentives, bookings, manufacturing costs.","mu":0.08,"sigma":0.43},{"symbol":"CAT","name":"Caterpillar","sector":"Industrials","profile":"Established","about":"Construction and mining equipment.","watch":"Capital investment, commodities, dealer inventories.","mu":0.07,"sigma":0.29},{"symbol":"GE","name":"GE Aerospace","sector":"Industrials","profile":"Established","about":"Aircraft engines and related services.","watch":"Air travel, engine deliveries, service margins.","mu":0.07,"sigma":0.3},{"symbol":"LMT","name":"Lockheed Martin","sector":"Industrials","profile":"Established","about":"Defense and aerospace systems.","watch":"Government budgets, contracts, execution.","mu":0.05,"sigma":0.23},{"symbol":"RKLB","name":"Rocket Lab","sector":"Industrials","profile":"Specialist","about":"Launch services and space systems.","watch":"Launch reliability, backlog, development funding.","mu":0.1,"sigma":0.65},{"symbol":"PG","name":"Procter & Gamble","sector":"Consumer staples","profile":"Established","about":"Household and personal care brands.","watch":"Pricing power, volumes, input costs, currencies.","mu":0.05,"sigma":0.18},{"symbol":"KO","name":"Coca-Cola","sector":"Consumer staples","profile":"Established","about":"Global beverage brands and distribution.","watch":"Volumes, pricing, currency, commodity costs.","mu":0.05,"sigma":0.19},{"symbol":"WMT","name":"Walmart","sector":"Consumer staples","profile":"Established","about":"Retail, grocery, and related services.","watch":"Consumer mix, wages, inventory, digital margins.","mu":0.06,"sigma":0.22},{"symbol":"NEE","name":"NextEra Energy","sector":"Utilities","profile":"Established","about":"Electric utility and energy infrastructure.","watch":"Rates, regulation, capital costs, weather.","mu":0.05,"sigma":0.25},{"symbol":"DUK","name":"Duke Energy","sector":"Utilities","profile":"Established","about":"Regulated electric and gas utilities.","watch":"Allowed returns, demand, capital spending.","mu":0.05,"sigma":0.2},{"symbol":"PLD","name":"Prologis","sector":"Real estate","profile":"Established","about":"Logistics real estate.","watch":"Occupancy, rents, financing costs, supply.","mu":0.06,"sigma":0.27},{"symbol":"O","name":"Realty Income","sector":"Real estate","profile":"Established","about":"Net lease commercial real estate.","watch":"Tenant credit, lease growth, debt costs.","mu":0.05,"sigma":0.24},{"symbol":"LIN","name":"Linde","sector":"Materials","profile":"Established","about":"Industrial gases and engineering.","watch":"Industrial demand, energy costs, contract structure.","mu":0.06,"sigma":0.23},{"symbol":"NUE","name":"Nucor","sector":"Materials","profile":"Established","about":"Steel and related products.","watch":"Steel prices, construction, tariffs, input costs.","mu":0.07,"sigma":0.35}],"events":[{"id":"rates","group":"Macro & policy","name":"Higher interest rates","description":"Discount rates rise and borrowing becomes more expensive.","drift":-0.035,"vol":0.14,"sectors":["Real estate","Utilities","Technology"]},{"id":"inflation","group":"Macro & policy","name":"Persistent inflation","description":"Input costs and purchasing power affect margins and demand.","drift":-0.025,"vol":0.12,"sectors":["Consumer discretionary","Consumer staples","Industrials"]},{"id":"growth","group":"Macro & policy","name":"Economic expansion","description":"Stronger demand can improve revenues and operating leverage.","drift":0.04,"vol":-0.06,"sectors":["Industrials","Consumer discretionary","Financials"]},{"id":"jobs","group":"Macro & policy","name":"Labor market strength","description":"Income supports spending, while labor costs can pressure margins.","drift":0.015,"vol":0.04,"sectors":["Consumer discretionary","Consumer staples"]},{"id":"dollar","group":"Macro & policy","name":"Stronger US dollar","description":"Foreign earnings translate into fewer dollars; imports may cost less.","drift":-0.018,"vol":0.06,"sectors":["Technology","Consumer staples","Materials"]},{"id":"credit","group":"Macro & policy","name":"Tighter credit conditions","description":"Refinancing and access to capital become more difficult.","drift":-0.035,"vol":0.2,"sectors":["Financials","Real estate","Industrials"]},{"id":"war","group":"Geopolitics","name":"Geopolitical escalation","description":"Trade disruptions and risk aversion can outweigh stronger defense demand.","drift":-0.03,"vol":0.22,"sectors":["Energy","Industrials"]},{"id":"trade","group":"Geopolitics","name":"Trade restrictions & tariffs","description":"Supply chains and export access face additional friction.","drift":-0.03,"vol":0.14,"sectors":["Technology","Materials","Industrials"]},{"id":"energy","group":"Geopolitics","name":"Higher energy prices","description":"Benefits energy producers but increases costs for many other businesses.","drift":-0.02,"vol":0.14,"sectors":["Energy","Industrials","Consumer discretionary"]},{"id":"election","group":"Geopolitics","name":"Policy uncertainty","description":"Uncertain rules can delay investment and widen the range of outcomes.","drift":-0.01,"vol":0.18,"sectors":["Financials","Healthcare","Energy"]},{"id":"regulation","group":"Geopolitics","name":"Tighter regulation","description":"Compliance costs, market access, and competitive structure can change.","drift":-0.025,"vol":0.12,"sectors":["Financials","Healthcare","Communication services"]},{"id":"fiscal","group":"Geopolitics","name":"Public investment","description":"Infrastructure and public procurement may support exposed businesses.","drift":0.02,"vol":0.03,"sectors":["Industrials","Materials","Utilities"]},{"id":"sentiment","group":"Social & demand","name":"Consumer confidence","description":"Confidence can alter discretionary spending and purchase timing.","drift":0.025,"vol":0.04,"sectors":["Consumer discretionary","Consumer staples"]},{"id":"boycott","group":"Social & demand","name":"Brand backlash","description":"Reputational damage can reduce demand and increase recovery costs.","drift":-0.025,"vol":0.14,"sectors":["Consumer discretionary","Consumer staples","Communication services"]},{"id":"labor","group":"Social & demand","name":"Labor disruption","description":"Strikes and disputes can interrupt output and raise costs.","drift":-0.022,"vol":0.12,"sectors":["Industrials","Consumer discretionary"]},{"id":"climate","group":"Social & demand","name":"Physical climate stress","description":"Weather damage and outages can disrupt assets and supply.","drift":-0.02,"vol":0.18,"sectors":["Utilities","Energy","Consumer staples"]},{"id":"adoption","group":"Social & demand","name":"Technology adoption","description":"Demand for new technology can create growth and competitive pressure.","drift":0.035,"vol":0.08,"sectors":["Technology","Communication services"]},{"id":"competition","group":"Company & execution","name":"Competitive pressure","description":"Rivals may lower prices, take market share, or force more spending.","drift":-0.035,"vol":0.1,"sectors":[]},{"id":"earnings","group":"Company & execution","name":"Earnings outperformance","description":"Performance above expectations may improve the outlook.","drift":0.04,"vol":0.08,"sectors":[]},{"id":"management","group":"Company & execution","name":"Leadership disruption","description":"A transition can weaken execution and increase uncertainty.","drift":-0.02,"vol":0.14,"sectors":[]},{"id":"product","group":"Company & execution","name":"Successful product launch","description":"Product acceptance can improve revenue and pricing power.","drift":0.035,"vol":0.06,"sectors":["Technology","Healthcare","Consumer discretionary"]},{"id":"supply","group":"Company & execution","name":"Supply chain disruption","description":"Component shortages and logistics delays can constrain production.","drift":-0.03,"vol":0.15,"sectors":["Technology","Industrials","Consumer discretionary"]},{"id":"leverage","group":"Company & execution","name":"Balance sheet strain","description":"Debt service and refinancing risks can constrain investment.","drift":-0.035,"vol":0.22,"sectors":[]},{"id":"buyback","group":"Company & execution","name":"Capital return discipline","description":"Capital allocation can improve per-share economics, depending on price.","drift":0.012,"vol":0.01,"sectors":[]},{"id":"liquidity","group":"Market structure","name":"Liquidity deterioration","description":"Wider spreads and thinner depth may amplify moves and trading costs.","drift":-0.015,"vol":0.22,"sectors":[]},{"id":"crowding","group":"Market structure","name":"Crowded positioning","description":"Similar investor positions can produce disorderly exits.","drift":-0.015,"vol":0.18,"sectors":["Technology","Financials"]},{"id":"risk","group":"Market structure","name":"Broad risk appetite","description":"A lower demanded risk premium can support prices without better cash flows.","drift":0.025,"vol":-0.1,"sectors":[]},{"id":"uncertainty","group":"Market structure","name":"Unmodeled uncertainty","description":"Adds dispersion without assuming a directional return advantage.","drift":0,"vol":0.3,"sectors":[]}]}''')
COMPANIES = {c['symbol']: c for c in CATALOG['companies']}
EVENTS = CATALOG['events']
MASK = 0xFFFFFFFF


def clip(x, lo, hi):
    return max(lo, min(hi, x))


def random_stream(seed=731):
    """Mulberry32: unsigned operations match the browser implementation."""
    a = seed & MASK
    while True:
        a = (a + 0x6D2B79F5) & MASK
        t = ((a ^ (a >> 15)) * (a | 1)) & MASK
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & MASK)) & MASK)) & MASK
        yield ((t ^ (t >> 14)) & MASK) / 4294967296


def normal(random):
    u, v = max(next(random), 1e-12), next(random)
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


def quantile(sorted_values, p):
    i = (len(sorted_values) - 1) * p
    a, b = math.floor(i), math.ceil(i)
    return sorted_values[a] + (sorted_values[b] - sorted_values[a]) * (i % 1)


def calibrate(rows):
    """Up to 252 returns; 25% raw drift plus 75% illustrative 5% prior."""
    if len(rows) < 41:
        raise ValueError('At least 41 observations are required.')
    prices = [r['close'] for r in rows[-253:]]
    returns = [math.log(b / a) for a, b in zip(prices, prices[1:])]
    sigma_raw = statistics.stdev(returns) * math.sqrt(252)
    mu_raw = statistics.mean(returns) * 252 + 0.5 * sigma_raw ** 2
    return {'mu': clip(.25 * mu_raw + .75 * .05, -.20, .25),
            'sigma': clip(sigma_raw, .05, 1.20),
            'observations': len(returns), 'rawMu': mu_raw}


def parameters(company, weights, baseline):
    """Grouped illustrative shifts; 50 is baseline, not event probability."""
    contributions = {}
    for e in EVENTS:
        x = (weights.get(e['id'], 50) - 50) / 50
        exposure = (1.3 if company['sector'] in e['sectors'] else .55) if e['sectors'] else 1
        if company['profile'] != 'Established' and e['id'] in ['rates', 'credit', 'leverage', 'liquidity']:
            exposure *= 1.25
        direction = -.9 if e['id'] == 'energy' and company['sector'] == 'Energy' else 1
        contributions.setdefault(e['group'], []).append((x * e['drift'] * exposure * direction,
                                                        x * e['vol'] * exposure))
    drift = sum(statistics.mean(a for a, _ in g) for g in contributions.values())
    logvol = sum(statistics.mean(b for _, b in g) for g in contributions.values())
    return {'mu': clip(baseline['mu'] + drift, -.35, .45),
            'sigma': clip(baseline['sigma'] * math.exp(logvol), .05, 1.20)}


def simulate(s0=100, mu=.05, sigma=.25, days=21, n=1200, seed=731):
    """Exact GBM under physical P, paired Z/-Z; no jumps or stochastic vol."""
    if s0 <= 0 or sigma <= 0 or days <= 0 or n < 2 or n % 2:
        raise ValueError('Positive model inputs and an even sample count are required.')
    random = random_stream(seed)
    columns = [[] for _ in range(days + 1)]
    paths = []
    for _ in range(n // 2):
        a = b = s0
        pa, pb = [a], [b]
        columns[0].extend((a, b))
        for t in range(1, days + 1):
            z = normal(random)
            drift, diffusion = (mu - .5 * sigma ** 2) / 252, sigma / math.sqrt(252) * z
            a, b = a * math.exp(drift + diffusion), b * math.exp(drift - diffusion)
            pa.append(a)
            pb.append(b)
            columns[t].extend((a, b))
        paths.extend((pa, pb))
    for column in columns:
        column.sort()
    terminal = columns[-1]
    bands = [{'lo': quantile(c, .1), 'mid': quantile(c, .5), 'hi': quantile(c, .9)} for c in columns]
    return {'paths': paths[:36], 'bands': bands, 'terminal': terminal,
            'median': quantile(terminal, .5), 'mean': statistics.mean(terminal),
            'loss': sum(x < s0 for x in terminal) / len(terminal),
            'p05': quantile(terminal, .05), 'lo': quantile(terminal, .1), 'hi': quantile(terminal, .9),
            'mu': mu, 'sigma': sigma, 's0': s0, 'days': days}


def crps(sorted_values, observation):
    """Exact empirical-distribution CRPS, O(N) after sorting; lower is better."""
    n = len(sorted_values)
    return sum(abs(x - observation) / n - (2 * i - n + 1) * x / n ** 2
               for i, x in enumerate(sorted_values))


def norm_cdf(x):
    # Same polynomial approximation as the browser, for reproducible parity.
    t = 1 / (1 + .2316419 * abs(x))
    d = .3989422804014327 * math.exp(-x * x / 2)
    p = 1 - d * t * (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    return p if x >= 0 else 1 - p


def black_scholes(S, K, T, r, q, sigma):
    """European options under Q. T in years; vega per 1 vol percentage point."""
    d1 = (math.log(S / K) + (r - q + .5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    ds, dk = S * math.exp(-q * T), K * math.exp(-r * T)
    return {'call': ds * norm_cdf(d1) - dk * norm_cdf(d2),
            'put': dk * norm_cdf(-d2) - ds * norm_cdf(-d1),
            'delta': math.exp(-q * T) * norm_cdf(d1),
            'vega': ds * math.exp(-d1 * d1 / 2) / math.sqrt(2 * math.pi) * math.sqrt(T) / 100}


def read_prices(filename):
    with open(filename, newline='') as f:
        rows = [{'date': row['Date'], 'close': float(row['Close'])} for row in csv.DictReader(f)]
    rows.sort(key=lambda x: x['date'])
    if len({r['date'] for r in rows}) != len(rows):
        raise ValueError('Duplicate dates.')
    for row in rows:
        if date.fromisoformat(row['date']) > date.today() or not math.isfinite(row['close']) or row['close'] <= 0:
            raise ValueError('Invalid date or close.')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--company', choices=COMPANIES, default='AAPL')
    parser.add_argument('--csv', help='Daily CSV with Date,Close columns')
    parser.add_argument('--date', help='Origin YYYY-MM-DD; exclude subsequent prices from fitting')
    parser.add_argument('--days', type=int, choices=[21, 63], default=21)
    parser.add_argument('--weights', default='{}', help='JSON object of event IDs to slider values 0–100')
    parser.add_argument('--output', help='Optional JSON file with complete simulation output')
    args = parser.parse_args()
    c = COMPANIES[args.company]
    weights = json.loads(args.weights)
    if not isinstance(weights, dict) or any(k not in {e['id'] for e in EVENTS} or not isinstance(v, (float, int)) or not math.isfinite(v) or not 0 <= v <= 100 for k, v in weights.items()):
        parser.error('Weights must map known event IDs to numbers in [0,100].')
    rows = read_prices(args.csv) if args.csv else []
    history = [r for r in rows if not args.date or r['date'] <= args.date]
    baseline = calibrate(history) if rows else {'mu': c['mu'], 'sigma': c['sigma']}
    p = parameters(c, weights, baseline)
    result = simulate(mu=p['mu'], sigma=p['sigma'], days=args.days)
    summary = {k: result[k] for k in ['median', 'mean', 'loss', 'p05', 'lo', 'hi', 'mu', 'sigma']}
    summary['data'] = 'CSV calibrated' if rows else 'Illustrative company baseline; no market observations'
    if args.date and rows:
        origin = history[-1]
        future = [r for r in rows if r['date'] > origin['date']][:args.days]
        if len(future) == args.days:
            actual = future[-1]['close'] / origin['close'] * 100
            summary['actual_index'] = actual
            summary['crps'] = crps(result['terminal'], actual)
    print(json.dumps(summary, indent=2))
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f)


if __name__ == '__main__':
    main()
