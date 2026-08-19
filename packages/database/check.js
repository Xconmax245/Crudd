const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const banks = await prisma.questionBank.findMany({ include: { questions: true } });
  for (const b of banks) {
    const pubQ = b.questions.filter(q => q.status === 'PUBLISHED').length;
    console.log(b.title + ' -> count: ' + b.questionCount + ', actual published: ' + pubQ + ', total actual: ' + b.questions.length);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
