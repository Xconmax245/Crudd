const { PrismaClient } = require('./packages/database/node_modules/@prisma/client/index.js');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Checking Banks API ---');
  const banksRes = await fetch('http://localhost:3001/api/banks');
  const banks = await banksRes.json();
  console.log('Banks:', banks.map(b => b.title + ' (' + b.questionCount + ')'));

  console.log('\n--- Creating Challenge via API ---');
  const bankId = banks[0].id;
  const createRes = await fetch('http://localhost:3001/api/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bankId,
      questionCount: 5,
      timerSeconds: 10,
      maxPlayers: 4,
      hostSessionId: 'f0000000-0000-0000-0000-000000000000'
    })
  });
  if (!createRes.ok) {
    console.error('Failed to create:', await createRes.text());
    return;
  }
  const challenge = await createRes.json();
  console.log('Created Challenge Slug:', challenge.shareSlug);

  console.log('\n--- Verifying DB Persistence ---');
  const dbChallenge = await prisma.challenge.findUnique({
    where: { shareSlug: challenge.shareSlug },
    include: {
      questions: { orderBy: { position: 'asc' } },
      participants: true
    }
  });

  console.log('Challenge status:', dbChallenge.status);
  console.log('Host participant:', dbChallenge.participants.find(p => p.role === 'HOST')?.sessionId);
  console.log('Questions persisted:', dbChallenge.questions.length);
  const q = dbChallenge.questions[0];
  console.log('Sample question position:', q.position);
  console.log('Shuffled correct index:', q.shuffledCorrectIndex);
  console.log('Shuffled options array length:', q.shuffledOptions.length);
}

run().catch(console.error).finally(() => prisma.$disconnect());
