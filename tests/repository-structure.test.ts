import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requiredPaths = [
  'docs/requirements-matrix.md',
  'docs/source-traceability.md',
  'docs/architecture.md',
  'docs/threat-model.md',
  'migrations/0001_initial.sql',
  'scripts/seed-demo.sql',
  'packages/authorization/src/index.ts',
  'packages/underwriting/src/index.ts',
  'packages/schemas/src/index.ts',
];

describe('repository bootstrap', () => {
  it('contains the expected bootstrap artifacts', () => {
    for (const requiredPath of requiredPaths) {
      expect(existsSync(requiredPath), requiredPath).toBe(true);
    }
  });
});
