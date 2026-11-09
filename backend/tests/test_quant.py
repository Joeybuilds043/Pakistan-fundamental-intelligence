from types import SimpleNamespace

import pytest

from app.quant import run_fundamental_scenario


def request():
    return SimpleNamespace(
        ticker="DEMO",
        history=[
            SimpleNamespace(fiscal_year=2021, revenue=1000, operating_cash_flow=130, capex=40),
            SimpleNamespace(fiscal_year=2022, revenue=1100, operating_cash_flow=150, capex=45),
            SimpleNamespace(fiscal_year=2023, revenue=1210, operating_cash_flow=160, capex=50),
            SimpleNamespace(fiscal_year=2024, revenue=1331, operating_cash_flow=180, capex=55),
        ],
        forecast_years=3,
        simulations=2000,
        growth_hurdle=0.05,
        sector_growth_prior_mean=0.08,
        sector_growth_prior_std=0.12,
        stress_growth_delta=-0.10,
        stress_fcf_margin_delta=-0.05,
    )


def test_quant_scenario_is_reproducible_and_bounded():
    first = run_fundamental_scenario(request())
    second = run_fundamental_scenario(request())
    assert first == second
    assert first["status"] == "scenario_estimate_not_forecast"
    for value in first["base_case_probabilities"].values():
        assert 0 <= value <= 1
    assert first["terminal_revenue"]["p10"] <= first["terminal_revenue"]["median"]
    assert first["terminal_revenue"]["median"] <= first["terminal_revenue"]["p90"]
    assert len(first["distribution_histograms"]["terminal_revenue"]) == 14
    assert len(first["distribution_histograms"]["cumulative_fcf"]) == 14
    assert sum(item["count"] for item in first["distribution_histograms"]["terminal_revenue"]) == 2000
    assert first["risk_statistics"]["cumulative_fcf_lower_decile_mean"] <= first["risk_statistics"]["cumulative_fcf_mean"]


def test_quant_requires_four_annual_observations():
    payload = request()
    payload.history = payload.history[:3]
    with pytest.raises(ValueError, match="four annual observations"):
        run_fundamental_scenario(payload)
