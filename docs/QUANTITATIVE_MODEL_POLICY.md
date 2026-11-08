# Quantitative Model Policy

## Purpose
PFI uses quantitative methods to describe conditional business scenarios and uncertainty. It does not claim to predict share prices or guarantee investment outcomes.

## Current model: v1
- Bayesian normal-normal shrinkage: combines the sample mean of annual revenue growth with an explicit sector prior. The posterior standard deviation is retained and sampled rather than hidden.
- Monte Carlo simulation: propagates posterior growth uncertainty and observed free-cash-flow-margin variability through a user-selected forecast horizon.
- Stress scenario: shifts annual revenue growth and free-cash-flow margin by explicit analyst-selected shocks.
- Reported outputs: probability of at least one negative-FCF year, probability terminal revenue falls below the starting level, probability cumulative forecast FCF is negative, probability revenue CAGR meets a stated hurdle, stress-case negative-FCF probability, and P10/P50/P90 ranges for terminal revenue and cumulative FCF.

## Input contract
- At least four annual observations (three growth intervals).
- Revenue, operating cash flow and capital expenditure must use consistent currency, scale, fiscal year and statement scope.
- Revenue must be positive. Missing values must not be replaced with zero.
- Inputs must be sourced from validated observations or labelled analyst assumptions.
- Do not mix consolidated and standalone data.

## What the probability means
A probability is conditional on the supplied data, priors, model structure and stress assumptions. It is not the real-world frequency of an investment outcome until out-of-sample calibration demonstrates that interpretation.

## Known limitations
- Current model does not ingest market prices, estimate equity returns, calculate fair value, or include discount rates, net debt, dilution or sector-specific accounting adjustments.
- Normal assumptions can understate fat tails and structural breaks.
- Sector prior is supplied by the analyst; the engine does not silently infer one.
- Current endpoint does not persist input data or results.
- Four years is a minimum data gate, not a claim of statistical sufficiency.

## Validation roadmap
1. Build a point-in-time PSX dataset with publication dates and delisted-company coverage.
2. Run rolling-origin out-of-sample backtests; prevent look-ahead and survivorship bias.
3. Measure Brier score, log loss, calibration curves and interval coverage.
4. Compare with simple historical-mean and sector-naive baselines.
5. Track model version, input observation IDs, prior assumptions and run timestamp.
6. Add sector-specific models only after sufficient validated samples exist.
