import { z } from 'zod';

export const featureStatusSchema = z.enum([
  'implemented',
  'scaffolded',
  'mocked',
  'blocked',
  'future',
]);

export const requirementRecordSchema = z.object({
  id: z.string().min(1),
  capability: z.string().min(1),
  status: featureStatusSchema,
  notes: z.string().min(1),
});

export type FeatureStatus = z.infer<typeof featureStatusSchema>;
export type RequirementRecord = z.infer<typeof requirementRecordSchema>;
