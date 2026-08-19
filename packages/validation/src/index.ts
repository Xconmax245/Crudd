import { z } from 'zod';

// Content-domain validation: bank health, question validation, CSV/JSON import.
export * from './content';

// Admin API boundary schemas (banks, questions, bulk, import, settings).
export * from './admin';


export const createChallengeSchema = z.object({
  bankId: z.string().uuid(),

  questionCount: z.number().int().min(1),
  timerSeconds: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
  ]),
  maxPlayers: z.number().int().min(2).max(10),
  hostSessionId: z.string().uuid(),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const joinChallengeSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores, and hyphens allowed'),
});

export type JoinChallengeInput = z.infer<typeof joinChallengeSchema>;
