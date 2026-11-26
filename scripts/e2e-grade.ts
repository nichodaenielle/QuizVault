// Simulates the gradeEssay server action's DB effects + recomputeAttemptScore,
// then verifies the learner-visible score.
import { prisma } from '../src/lib/prisma';
import { recomputeAttemptScore } from '../src/lib/attempts';

async function main() {
  const attemptId = process.argv[2];
  const graderId = process.argv[3];
  const essay = await prisma.response.findFirstOrThrow({
    where: { attemptId, itemKey: 'i5' },
  });
  await prisma.$transaction(async (tx) => {
    await tx.essayGrade.upsert({
      where: { responseId: essay.id },
      create: {
        responseId: essay.id, attemptId, score: 4, maxScore: 5,
        feedback: 'Good explanation of chlorophyll and energy conversion.',
        gradedById: graderId,
      },
      update: { score: 4, feedback: 'Good explanation.', gradedById: graderId, gradedAt: new Date() },
    });
    await tx.response.update({ where: { id: essay.id }, data: { score: 4, maxScore: 5 } });
  });
  await recomputeAttemptScore(attemptId);
  const a = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  console.log(JSON.stringify({ score: a.score, maxScore: a.maxScore, gradingStatus: a.gradingStatus }));
  await prisma.$disconnect();
}
main();
