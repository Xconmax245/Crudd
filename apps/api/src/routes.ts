import { FastifyInstance } from 'fastify';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, Question } from '@crudd/database';
import { createChallengeSchema } from '@crudd/validation';
import { nanoid } from 'nanoid';

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const routes: FastifyPluginAsyncZod = async (fastify) => {
  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok' };
  });

  // List all banks (public: PUBLISHED only — directive #38)
  fastify.get('/api/banks', async () => {
    const banks = await db.questionBank.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        subject: true,
        questionCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return banks;
  });


  // Get single bank detail
  fastify.get(
    '/api/banks/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const bank = await db.questionBank.findFirst({
        where: { id, status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          subject: true,
          questionCount: true,
          createdAt: true,
        },
      });

      if (!bank) {
        return reply.status(404).send({ error: 'Bank not found' });
      }

      return bank;

    }
  );

  // Create Challenge
  fastify.post(
    '/api/challenges',
    {
      schema: {
        body: createChallengeSchema,
      },
    },
    async (request, reply) => {
      const { bankId, questionCount, timerSeconds, maxPlayers, hostSessionId } = request.body as any;

      // 1. Fetch bank and verify (public play requires a PUBLISHED bank — directive #38)
      const bank = await db.questionBank.findFirst({
        where: { id: bankId, status: 'PUBLISHED' },
        include: { questions: { where: { status: 'PUBLISHED' } } },
      });

      if (!bank) {
        return reply.status(404).send({ error: 'Bank not found' });
      }

      // Only PUBLISHED questions are eligible for gameplay.
      const eligibleQuestions = bank.questions;
      if (questionCount > eligibleQuestions.length) {
        return reply.status(400).send({ error: 'Requested question count exceeds bank size' });
      }

      // 2. Shuffle and select questions
      const shuffledQuestions = shuffle(eligibleQuestions);

      const selectedQuestions = shuffledQuestions.slice(0, questionCount);

      // 3. Prepare challenge questions
      const challengeQuestionsData = selectedQuestions.map((q: any, index: number) => {
        // Options from database are assumed to be an array of strings
        const options = q.options as string[];
        
        // We need to shuffle options but keep track of the correct index
        const optionsWithIndex = options.map((opt, i) => ({ text: opt, originalIndex: i }));
        const shuffledOpts = shuffle(optionsWithIndex);
        
        const newCorrectIndex = shuffledOpts.findIndex(opt => opt.originalIndex === q.correctIndex);
        
        return {
          questionId: q.id,
          position: index,
          shuffledOptions: shuffledOpts.map(opt => opt.text),
          shuffledCorrectIndex: newCorrectIndex,
        };
      });

      // 4. Generate unique slug
      const shareSlug = nanoid(8);

      // 5. Transaction
      try {
        const challenge = await db.$transaction(async (tx: any) => {
          const newChallenge = await tx.challenge.create({
            data: {
              bankId,
              createdBy: hostSessionId,
              questionCount,
              timerSeconds,
              maxPlayers,
              shareSlug,
              status: 'LOBBY',
              questions: {
                create: challengeQuestionsData,
              },
              participants: {
                create: {
                  sessionId: hostSessionId,
                  role: 'HOST',
                  username: null, // Host will provide this later on the canonical URL
                  score: 0,
                },
              },
            },
          });
          return newChallenge;
        });

        const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/challenge/${challenge.shareSlug}`;
        
        return { shareSlug: challenge.shareSlug, shareUrl };
      } catch (error) {
        // Simple retry logic for unique slug collision could go here, but omitted for brevity
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to create challenge' });
      }
    }
  );

  // Get Challenge by Slug (Public DTO)
  fastify.get(
    '/api/challenges/:slug',
    {
      schema: {
        params: z.object({ slug: z.string() }),
      },
    },
    async (request, reply) => {
      const { slug } = request.params as any;
      const challenge = await db.challenge.findUnique({
        where: { shareSlug: slug },
        include: { bank: true },
      });

      if (!challenge) {
        return reply.status(404).send({ error: 'Challenge not found' });
      }

      // Public DTO
      return {
        id: challenge.id,
        bankTitle: challenge.bank.title,
        questionCount: challenge.questionCount,
        timerSeconds: challenge.timerSeconds,
        maxPlayers: challenge.maxPlayers,
        status: challenge.status,
        shareSlug: challenge.shareSlug,
      };
    }
  );
}
