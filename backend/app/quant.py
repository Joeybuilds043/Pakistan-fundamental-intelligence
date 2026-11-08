"""Interpretable, assumption-driven probabilistic fundamentals scenarios.

This is a scenario engine, not a price-target or return predictor. Inputs must
come from validated annual observations or explicitly labelled analyst inputs.
"""
from __future__ import annotations

import hashlib
import math
import random
import statistics
from typing import Any


def _quantile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * q
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _normal_draw(rng: random.Random, mean: float, std: float) -> float:
    return rng.gauss(mean, max(std, 1e-6))


def run_fundamental_scenario(payload: Any) -> dict[str, Any]:
    history = payload.history
    revenues = [float(row.revenue) for row in history]
    if any(value <= 0 for value in revenues):
        raise ValueError("Annual revenue values must be positive.")
    if len(history) < 4:
        raise ValueError("At least four annual observations are required to estimate three growth periods.")

    growth_rates = [
        revenues[i] / revenues[i - 1] - 1
        for i in range(1, len(revenues))
    ]
    if any(not math.isfinite(value) or value <= -0.95 or value > 3 for value in growth_rates):
        raise ValueError("Historical revenue growth contains an implausible value; review units and periods.")

    fcf_margins = [
        (float(row.operating_cash_flow) - float(row.capex)) / float(row.revenue)
        for row in history
    ]
    if any(not math.isfinite(value) or abs(value) > 2 for value in fcf_margins):
        raise ValueError("Historical free-cash-flow margin is outside the supported review range.")

    observed_mean = statistics.mean(growth_rates)
    observed_var = statistics.variance(growth_rates) if len(growth_rates) > 1 else 0.04
    likelihood_var = max(observed_var / len(growth_rates), 0.0004)
    prior_var = payload.sector_growth_prior_std ** 2
    posterior_var = 1 / ((1 / prior_var) + (1 / likelihood_var))
    posterior_mean = posterior_var * (
        payload.sector_growth_prior_mean / prior_var + observed_mean / likelihood_var
    )
    posterior_std = math.sqrt(posterior_var)

    margin_mean = statistics.mean(fcf_margins[-3:])
    margin_std = statistics.stdev(fcf_margins) if len(fcf_margins) > 1 else 0.03
    margin_std = min(max(margin_std, 0.01), 0.25)

    seed_material = (
        payload.ticker
        + "|"
        + "|".join(f"{row.fiscal_year}:{row.revenue}:{row.operating_cash_flow}:{row.capex}" for row in history)
        + f"|{payload.forecast_years}|{payload.simulations}|{payload.growth_hurdle}"
    )
    seed = int(hashlib.sha256(seed_material.encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)

    terminal_revenues: list[float] = []
    cumulative_fcfs: list[float] = []
    positive_all_years = 0
    negative_any_year = 0
    growth_above_hurdle = 0
    stress_negative_any_year = 0

    current_revenue = revenues[-1]
    for _ in range(payload.simulations):
        growth = _normal_draw(rng, posterior_mean, posterior_std)
        growth = min(max(growth, -0.70), 1.50)
        revenue = current_revenue
        cumulative_fcf = 0.0
        all_positive = True
        any_negative = False
        stress_any_negative = False
        stress_revenue = current_revenue
        stress_margin = margin_mean

        for _year in range(payload.forecast_years):
            growth_shock = rng.gauss(0, posterior_std * 0.35)
            revenue_growth = min(max(growth + growth_shock, -0.70), 1.50)
            revenue *= 1 + revenue_growth

            margin_shock = rng.gauss(0, margin_std)
            margin = min(max(margin_mean + margin_shock, -0.75), 0.60)
            fcf = revenue * margin
            cumulative_fcf += fcf
            if fcf <= 0:
                all_positive = False
                any_negative = True

            stress_revenue *= 1 + min(max(revenue_growth + payload.stress_growth_delta, -0.85), 1.50)
            stress_margin = min(max(margin + payload.stress_fcf_margin_delta, -0.85), 0.60)
            if stress_revenue * stress_margin <= 0:
                stress_any_negative = True

        terminal_revenues.append(revenue)
        cumulative_fcfs.append(cumulative_fcf)
        positive_all_years += int(all_positive)
        negative_any_year += int(any_negative)
        stress_negative_any_year += int(stress_any_negative)
        cagr = (revenue / current_revenue) ** (1 / payload.forecast_years) - 1
        growth_above_hurdle += int(cagr >= payload.growth_hurdle)

    n = payload.simulations
    probability = lambda count: round(count / n, 4)
    return {
        "ticker": payload.ticker,
        "model": "Bayesian-shrunk growth + Monte Carlo cash-flow scenarios",
        "status": "scenario_estimate_not_forecast",
        "horizon_years": payload.forecast_years,
        "simulations": n,
        "data_points": len(history),
        "historical_growth_rates": [round(value, 4) for value in growth_rates],
        "historical_fcf_margins": [round(value, 4) for value in fcf_margins],
        "posterior_revenue_growth": {
            "mean": round(posterior_mean, 4),
            "std_dev": round(posterior_std, 4),
            "prior_mean": payload.sector_growth_prior_mean,
            "prior_std_dev": payload.sector_growth_prior_std,
        },
        "base_case_probabilities": {
            "all_forecast_years_fcf_positive": probability(positive_all_years),
            "at_least_one_forecast_year_fcf_negative": probability(negative_any_year),
            "revenue_cagr_meets_hurdle": probability(growth_above_hurdle),
        },
        "stress_case": {
            "growth_delta_per_year": payload.stress_growth_delta,
            "fcf_margin_delta": payload.stress_fcf_margin_delta,
            "probability_any_year_fcf_negative": probability(stress_negative_any_year),
        },
        "terminal_revenue": {
            "p10": round(_quantile(terminal_revenues, 0.10), 2),
            "median": round(_quantile(terminal_revenues, 0.50), 2),
            "p90": round(_quantile(terminal_revenues, 0.90), 2),
            "currency": "as_supplied",
        },
        "cumulative_fcf": {
            "p10": round(_quantile(cumulative_fcfs, 0.10), 2),
            "median": round(_quantile(cumulative_fcfs, 0.50), 2),
            "p90": round(_quantile(cumulative_fcfs, 0.90), 2),
            "currency": "as_supplied",
        },
        "limitations": [
            "Probabilities are conditional on supplied history and analyst priors, not calibrated market odds.",
            "No share-price, discount-rate, dilution, debt-maturity or valuation-multiple model is included.",
            "Four annual observations are a minimum and may be inadequate after structural business changes.",
            "Validate accounting scope, units, fiscal periods and source documents before interpretation.",
            "Backtesting and probability calibration are required before using these outputs in investment decisions.",
        ],
    }
