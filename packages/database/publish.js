const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.question.updateMany({
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  console.log(`Published ${result.count} questions.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
