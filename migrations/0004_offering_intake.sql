ALTER TABLE intake_requests ADD COLUMN interest_area TEXT;

CREATE INDEX IF NOT EXISTS idx_intake_requests_interest_created
  ON intake_requests(interest_area, created_at);
