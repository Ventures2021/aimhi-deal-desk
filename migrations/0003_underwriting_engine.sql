PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS model_packages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_package_versions (
  id TEXT PRIMARY KEY,
  model_package_id TEXT NOT NULL REFERENCES model_packages(id),
  semantic_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  source_r2_key TEXT,
  source_filename TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'retired', 'rejected')),
  limitations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(limitations_json)),
  configuration_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuration_json)),
  predecessor_id TEXT REFERENCES model_package_versions(id),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (model_package_id, semantic_version)
);
CREATE INDEX IF NOT EXISTS idx_model_versions_package_status
  ON model_package_versions(model_package_id, status, created_at);

CREATE TABLE IF NOT EXISTS asset_type_configs (
  id TEXT PRIMARY KEY,
  model_version_id TEXT NOT NULL REFERENCES model_package_versions(id),
  asset_type TEXT NOT NULL,
  revenue_basis_code TEXT NOT NULL,
  minimum_dscr REAL NOT NULL CHECK (minimum_dscr > 0),
  maximum_senior_ltv REAL NOT NULL CHECK (maximum_senior_ltv > 0 AND maximum_senior_ltv <= 1),
  maximum_all_in_ltc REAL NOT NULL CHECK (maximum_all_in_ltc > 0 AND maximum_all_in_ltc <= 1.5),
  minimum_exit_cap_spread_bps INTEGER NOT NULL DEFAULT 0,
  configuration_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuration_json)),
  UNIQUE (model_version_id, asset_type)
);

CREATE TABLE IF NOT EXISTS deal_evidence_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  field_id TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  unit TEXT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('document', 'public_record', 'market', 'assumption')),
  source_locator_json TEXT NOT NULL CHECK (json_valid(source_locator_json)),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'accepted', 'corrected', 'rejected', 'superseded')),
  effective_at TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deal_evidence_field
  ON deal_evidence_records(deal_id, field_id, review_status);

CREATE TABLE IF NOT EXISTS debt_tranches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  tranche_type TEXT NOT NULL
    CHECK (tranche_type IN ('senior', 'junior', 'mezzanine', 'seller_carry', 'line_of_credit')),
  lender_name TEXT,
  principal REAL NOT NULL CHECK (principal >= 0),
  interest_rate REAL NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 1),
  amortization_months INTEGER NOT NULL DEFAULT 0 CHECK (amortization_months >= 0),
  interest_only_months INTEGER NOT NULL DEFAULT 0 CHECK (interest_only_months >= 0),
  maturity_month INTEGER CHECK (maturity_month IS NULL OR maturity_month > 0),
  source_evidence_id TEXT REFERENCES deal_evidence_records(id),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'quoted', 'approved', 'funded', 'retired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_debt_tranches_deal
  ON debt_tranches(deal_id, tranche_type, status);

CREATE TABLE IF NOT EXISTS underwriting_scenarios (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  name TEXT NOT NULL,
  model_version_id TEXT NOT NULL REFERENCES model_package_versions(id),
  inputs_json TEXT NOT NULL CHECK (json_valid(inputs_json)),
  evidence_snapshot_json TEXT NOT NULL CHECK (json_valid(evidence_snapshot_json)),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'superseded', 'archived')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_underwriting_scenarios_deal
  ON underwriting_scenarios(deal_id, status, created_at);

CREATE TABLE IF NOT EXISTS underwriting_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  scenario_id TEXT REFERENCES underwriting_scenarios(id),
  model_version_id TEXT NOT NULL REFERENCES model_package_versions(id),
  idempotency_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  inputs_json TEXT NOT NULL CHECK (json_valid(inputs_json)),
  output_json TEXT NOT NULL CHECK (json_valid(output_json)),
  evidence_snapshot_json TEXT NOT NULL CHECK (json_valid(evidence_snapshot_json)),
  release_status TEXT NOT NULL DEFAULT 'computed'
    CHECK (release_status IN ('computed', 'blocked', 'in_review', 'approved', 'superseded')),
  calculation_started_at TEXT NOT NULL,
  calculation_completed_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_underwriting_runs_deal
  ON underwriting_runs(deal_id, created_at);

CREATE TABLE IF NOT EXISTS underwriting_metrics (
  underwriting_run_id TEXT NOT NULL REFERENCES underwriting_runs(id),
  metric_id TEXT NOT NULL,
  value REAL,
  text_value TEXT,
  unit TEXT NOT NULL,
  period_label TEXT,
  PRIMARY KEY (underwriting_run_id, metric_id)
);

CREATE TABLE IF NOT EXISTS underwriting_checks (
  underwriting_run_id TEXT NOT NULL REFERENCES underwriting_runs(id),
  check_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'blocker')),
  status TEXT NOT NULL CHECK (status IN ('PASS', 'REVIEW', 'BLOCK')),
  actual_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(actual_json)),
  threshold_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(threshold_json)),
  message TEXT NOT NULL,
  PRIMARY KEY (underwriting_run_id, check_id)
);
CREATE INDEX IF NOT EXISTS idx_underwriting_checks_status
  ON underwriting_checks(underwriting_run_id, status, severity);

CREATE TABLE IF NOT EXISTS underwriting_cash_flows (
  underwriting_run_id TEXT NOT NULL REFERENCES underwriting_runs(id),
  cash_flow_type TEXT NOT NULL
    CHECK (cash_flow_type IN ('unlevered', 'senior_levered', 'sponsor', 'partner')),
  period_month INTEGER NOT NULL CHECK (period_month >= 0),
  occurred_at TEXT NOT NULL,
  amount REAL NOT NULL,
  components_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(components_json)),
  PRIMARY KEY (underwriting_run_id, cash_flow_type, period_month)
);

CREATE TABLE IF NOT EXISTS model_validation_cases (
  id TEXT PRIMARY KEY,
  model_version_id TEXT NOT NULL REFERENCES model_package_versions(id),
  case_name TEXT NOT NULL,
  inputs_json TEXT NOT NULL CHECK (json_valid(inputs_json)),
  expected_json TEXT NOT NULL CHECK (json_valid(expected_json)),
  tolerance_json TEXT NOT NULL CHECK (json_valid(tolerance_json)),
  source_locator TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (model_version_id, case_name)
);

INSERT OR IGNORE INTO model_packages
  (id, slug, name, description)
VALUES
  (
    'model-package-aimhi-underwriting',
    'aimhi-underwriting',
    'AiMhi Deterministic Underwriting',
    'Monthly property, debt, refinance, sponsor, partner, scenario, and release-check engine.'
  );

INSERT OR IGNORE INTO model_package_versions
  (
    id, model_package_id, semantic_version, engine_version, source_sha256,
    source_r2_key, source_filename, status, limitations_json, configuration_json
  )
VALUES
  (
    'model-version-2026-07-25',
    'model-package-aimhi-underwriting',
    '1.0.0',
    '2026.07.25',
    'd70e0be2c157c7e7efc629d122e3343128d0b0b6a0770f54ce3025ff94933105',
    'model-packages/aimhi-underwriting/1.0.0/source/aimhi-sample-underwriting-model.xlsm',
    'aimhi-sample-underwriting-model.xlsm',
    'in_review',
    '["Workbook Debt Stack references were rejected as non-canonical.","Worker calculations use monthly periods and do not execute VBA.","Decision release requires accepted evidence and human approval."]',
    '{"timing":"monthly","irr":"annualized_monthly","metrics":["unlevered","senior_levered","sponsor","partner","all_in_debt"],"release_gate":"all_material_checks"}'
  );

INSERT OR IGNORE INTO asset_type_configs
  (
    id, model_version_id, asset_type, revenue_basis_code, minimum_dscr,
    maximum_senior_ltv, maximum_all_in_ltc, minimum_exit_cap_spread_bps,
    configuration_json
  )
VALUES
  (
    'asset-config-multifamily-2026-07-25',
    'model-version-2026-07-25',
    'multifamily',
    'UNIT_MONTH',
    1.25,
    0.75,
    0.90,
    50,
    '{"minimum_debt_yield":0.09,"maximum_initial_vacancy":0.35,"required_evidence":["rent_roll","trailing_operations","debt_terms","property_tax","insurance","legal_use"]}'
  );
