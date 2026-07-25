INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('ws_demo', 'Aimhi Demo Workspace', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO deals (id, workspace_id, name, status, created_at, updated_at)
VALUES ('deal_demo', 'ws_demo', 'Synthetic Multifamily Acquisition', 'intake', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
