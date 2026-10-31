import { z } from 'zod';

export const extractedSchema = z.object({
  item: z.string().nullable().catch(null),
  item_key: z.string().nullable().catch(null),
  hard_constraints: z.array(z.string()).catch([]),
  soft_preferences: z.array(z.string()).catch([]),
  max_budget: z.number().nullable().catch(null),
  quantity: z.number().nullable().catch(null),
  needed_by: z.string().nullable().catch(null),
  needed_by_label: z.string().nullable().catch(null),
  urgent: z.boolean().catch(false),
  language: z.string().catch('hi-IN'),
  missing: z.array(z.enum(['item', 'max_budget', 'needed_by'])).catch([]),
  clarifying_question: z.string().nullable().catch(null),
  source_text: z.string().catch(''),
  mode: z.enum(['ai', 'rules_fallback']).catch('rules_fallback'),
});

export const createRequestSchema = z.object({
  shopSlug: z.string().min(1).max(80),
  source_text: z.string().min(1).max(5000),
  input_mode: z.enum(['voice', 'typed']),
  extracted: extractedSchema,
  answers: z
    .object({
      max_budget: z.number().nullable().optional(),
      needed_by: z
        .enum(['today', 'tomorrow', 'day_after', 'this_week', 'this_weekend', 'specific_date', 'none'])
        .optional(),
    })
    .optional(),
  phone: z.string().max(30).optional(),
  consent: z.boolean(),
});

export const extractBodySchema = z.object({
  shopSlug: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(1000),
  mode: z.enum(['rules', 'ai']).optional(),
});

export const stockBodySchema = z.object({
  product_id: z.string().min(1).max(100),
  add_quantity: z.number().int().min(1).max(50),
});

export const notifyBodySchema = z.object({
  cluster_key: z.string().min(1).max(300),
  product_id: z.string().min(1).max(100),
});

export const closeBodySchema = z.object({
  reason: z.enum(['cannot_meet_deadline', 'no_longer_needed', 'not_stockable', 'duplicate']),
});
