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

CATALOG = json.loads(r'''__CATALOG_JSON__''')
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
