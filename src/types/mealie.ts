import { z } from 'zod';

export const ResponseListSchema = <T>(itemsSchema: z.ZodType<T>) =>
  z.object({
    page: z.number(),
    per_page: z.number(),
    total: z.number(),
    total_pages: z.number(),
    items: z.array(itemsSchema),
    next: z.string().nullable(),
    previous: z.string().nullable(),
  });

export type ResponseList<T> = z.infer<ReturnType<typeof ResponseListSchema<T>>>;

export const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  pluralName: z.string().nullable(),
  description: z.string(),
  extras: z.object({}).passthrough(),
  fraction: z.boolean(),
  abbreviation: z.string(),
  pluralAbbreviation: z.string(),
  useAbbreviation: z.boolean(),
  aliases: z.array(z.string()),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type Unit = z.infer<typeof UnitSchema>;
