CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('intake', 'review', 'underwriting', 'decision', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS deals_workspace_idx ON deals(workspace_id, id);

CREATE TABLE IF NOT EXISTS deal_memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE INDEX IF NOT EXISTS deal_memberships_access_idx ON deal_memberships(workspace_id, deal_id, principal_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  quarantine_status TEXT NOT NULL CHECK (quarantine_status IN ('pending', 'validated', 'rejected')),
  malware_status TEXT NOT NULL CHECK (malware_status IN ('pending', 'clean', 'infected')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE INDEX IF NOT EXISTS documents_workspace_idx ON documents(workspace_id, deal_id, id);

CREATE TABLE IF NOT EXISTS financing_authorizations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE INDEX IF NOT EXISTS financing_authorizations_workspace_idx ON financing_authorizations(workspace_id, deal_id, id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  deal_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE INDEX IF NOT EXISTS audit_events_workspace_idx ON audit_events(workspace_id, deal_id, created_at);
