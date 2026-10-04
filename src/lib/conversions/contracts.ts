import { z } from 'zod';
import type { LibraryEntry, LibraryUnit } from './catalog';

export const libraryQuerySchema = z.object({
  query: z.string().max(200).optional(),
  system: z.enum(['metric', 'us']).optional(),
  dimension: z.enum(['mass', 'volume']).optional(),
});
export const importSelectionSchema = z.object({
  entryIds: z.array(z.string().min(1).max(80)).min(1).max(32),
  target: z.enum(['both', 'grocy']).default('both'),
  createMissingUnits: z.boolean().default(false),
  bindings: z.record(z.string().max(80), z.object({
    mealieUnitId: z.string().min(1).max(80).optional(),
    grocyUnitId: z.number().int().positive().optional(),
    createMealie: z.boolean().optional(),
    createGrocy: z.boolean().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    pluralName: z.string().trim().min(1).max(100).optional(),
  }).strict()).default({}),
}).strict();
export const libraryImportSchema = importSelectionSchema.extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
export type ImportSelection = z.infer<typeof importSelectionSchema>;
export type LibraryImportInput = z.infer<typeof libraryImportSchema>;
export type PlanStatus = 'ready' | 'already_available' | 'needs_unit_selection' | 'conflict';
export interface UnitPlan {
  unit: LibraryUnit;
  mealie: { id: string; name: string; abbreviation?: string } | null;
  grocy: { id: number; name: string } | null;
  mealieCandidates: Array<{ id: string; name: string }>;
  grocyCandidates: Array<{ id: number; name: string }>;
  createMealie: boolean;
  createGrocy: boolean;
  standardizeMealie: boolean;
  createMapping: boolean;
  name: string;
  pluralName: string;
  problems: string[];
}
export interface EntryPlan {
  entry: LibraryEntry;
  status: PlanStatus;
  message: string;
  existingFactor?: number;
}
export interface ImportPreview {
  version: string;
  selection: ImportSelection;
  fingerprint: string;
  units: UnitPlan[];
  entries: EntryPlan[];
  canImport: boolean;
  counts: { units: number; standardizations: number; mappings: number; conversions: number; available: number; blocked: number };
}
export interface ImportStep {
  system: 'Mealie' | 'Grocy' | 'App';
  kind: 'unit' | 'standardization' | 'mapping' | 'conversion';
  unitId: string;
  name: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  id?: string | number;
  message: string;
}
export interface ImportResult {
  status: 'success' | 'partial' | 'failure' | 'skipped';
  steps: ImportStep[];
  created: number;
  failed: number;
}
