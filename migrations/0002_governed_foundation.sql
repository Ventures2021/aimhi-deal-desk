PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('viewer', 'analyst', 'reviewer', 'approver', 'admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS intake_requests (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  asset_type TEXT NOT NULL,
  deal_size_band TEXT,
  decision_needed TEXT NOT NULL,
  geography TEXT,
  lender_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (lender_opt_in IN (0, 1)),
  privacy_consent INTEGER NOT NULL CHECK (privacy_consent IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'triaged', 'qualified', 'declined', 'converted')),
  source_ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_intake_requests_email ON intake_requests(email);
CREATE INDEX IF NOT EXISTS idx_intake_requests_status_created
  ON intake_requests(status, created_at);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  intake_request_id TEXT REFERENCES intake_requests(id),
  name TEXT NOT NULL,
  asset_type TEXT,
  geography TEXT,
  stage TEXT NOT NULL DEFAULT 'intake'
    CHECK (stage IN ('intake', 'evidence', 'underwriting', 'review', 'decision', 'closed')),
  current_underwriting_version_id TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_stage ON deals(workspace_id, stage);

CREATE TABLE IF NOT EXISTS storage_objects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT REFERENCES deals(id),
  r2_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT,
  malware_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (malware_status IN ('pending', 'clean', 'quarantined', 'failed')),
  retention_class TEXT NOT NULL DEFAULT 'deal_source',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_storage_objects_deal ON storage_objects(deal_id, created_at);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  storage_object_id TEXT NOT NULL REFERENCES storage_objects(id),
  document_type TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  predecessor_id TEXT REFERENCES document_versions(id),
  review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'in_review', 'accepted', 'rejected', 'superseded')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (deal_id, document_type, version_number)
);

CREATE TABLE IF NOT EXISTS extracted_facts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  field_name TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  source_locator_json TEXT NOT NULL CHECK (json_valid(source_locator_json)),
  extraction_method TEXT NOT NULL,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'accepted', 'corrected', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_extracted_facts_deal_field
  ON extracted_facts(deal_id, field_name);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT REFERENCES deals(id),
  workflow_type TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, workflow_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS workflow_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'worker', 'system', 'external')),
  actor_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workflow_events_instance
  ON workflow_events(workflow_instance_id, occurred_at);

CREATE TABLE IF NOT EXISTS approval_receipts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT REFERENCES deals(id),
  approval_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'revoked')),
  conditions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(conditions_json)),
  decided_by TEXT NOT NULL REFERENCES users(id),
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  predecessor_id TEXT REFERENCES approval_receipts(id)
);
CREATE INDEX IF NOT EXISTS idx_approval_subject
  ON approval_receipts(subject_type, subject_id, decided_at);

CREATE TABLE IF NOT EXISTS decision_receipts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  recommendation TEXT NOT NULL,
  rationale_json TEXT NOT NULL CHECK (json_valid(rationale_json)),
  conditions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(conditions_json)),
  underwriting_version_id TEXT NOT NULL,
  evidence_snapshot_json TEXT NOT NULL CHECK (json_valid(evidence_snapshot_json)),
  issued_by TEXT NOT NULL REFERENCES users(id),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  predecessor_id TEXT REFERENCES decision_receipts(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  deal_id TEXT,
  request_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('anonymous', 'user', 'worker', 'system', 'external')),
  actor_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_occurred
  ON audit_events(workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_events(request_id);

CREATE TABLE IF NOT EXISTS document_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  deal_id TEXT,
  storage_object_id TEXT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'quarantined')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_json TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS support_cases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  requester_email TEXT NOT NULL COLLATE NOCASE,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  preference_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(preference_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitoring_configurations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  monitor_type TEXT NOT NULL,
  configuration_json TEXT NOT NULL CHECK (json_valid(configuration_json)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lender_match_reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  deal_id TEXT NOT NULL REFERENCES deals(id),
  lender_id TEXT NOT NULL,
  fit_score REAL,
  rationale_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rationale_json)),
  status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_scheduling_references (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  intake_request_id TEXT REFERENCES intake_requests(id),
  provider TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, external_reference)
);

CREATE TABLE IF NOT EXISTS order_adjustments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  order_reference TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  order_reference TEXT NOT NULL,
  provider_reference TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  summary TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
