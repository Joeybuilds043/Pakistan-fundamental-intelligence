# Financial Data Contract

## Non-negotiable rules
1. Never invent, interpolate, or silently estimate a reported financial figure.
2. Every observation must point to a source document and a page/table/cell reference where available.
3. Store reporting period, currency, unit, statement scope (consolidated or standalone), and accounting standard.
4. Distinguish reported values from calculated metrics and analyst estimates.
5. Preserve the original value and source when correcting or superseding an observation.
6. Missing, not applicable, and zero are different states.

## Minimum observation fields
- company_id
- source_document_id
- metric_code and source_label
- period_start and period_end
- statement_type
- statement_scope
- value, currency, unit
- value_type: reported | calculated | estimated
- source_locator (page, note, table, row, cell)
- validation_status and validation_notes
- supersedes_observation_id, when applicable

## Validation controls
- Balance sheet: assets = liabilities + equity, subject to rounding.
- Cash flow: opening cash + net movement = closing cash, subject to disclosed FX effects.
- Income statement: preserve reported subtotals and distinguish continuing/discontinued operations.
- Ratios: record formula version and underlying observation IDs.
- Comparisons: do not mix consolidated and standalone figures or incompatible fiscal periods.
