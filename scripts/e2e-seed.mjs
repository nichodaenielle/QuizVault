// Seeds a full E2E fixture: instructor, learner, section+code, all 6 question
// types, a question set, and a published assessment assignment (same shape the
// publishAssessment server action produces). Run: node scripts/e2e-seed.mjs
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const INSTRUCTOR_EMAIL = 'instructor@e2e.local';
const LEARNER_EMAIL = 'learner@e2e.local';

const instructor = await prisma.user.upsert({
  where: { googleSub: `dev:${INSTRUCTOR_EMAIL}` },
  update: { role: 'INSTRUCTOR' },
  create: { googleSub: `dev:${INSTRUCTOR_EMAIL}`, email: INSTRUCTOR_EMAIL, name: 'E2E Instructor', role: 'INSTRUCTOR' },
});
const learner = await prisma.user.upsert({
  where: { googleSub: `dev:${LEARNER_EMAIL}` },
  update: {},
  create: { googleSub: `dev:${LEARNER_EMAIL}`, email: LEARNER_EMAIL, name: 'E2E Learner', role: 'LEARNER' },
});

// Clean prior fixture data for idempotency.
await prisma.section.deleteMany({ where: { name: 'E2E Section' } });
await prisma.assessment.deleteMany({ where: { title: 'E2E Mixed Assessment' } });
await prisma.question.deleteMany({ where: { subject: 'E2E' } });
await prisma.questionSet.deleteMany({ where: { title: 'E2E Set' } });

const section = await prisma.section.create({
  data: {
    name: 'E2E Section',
    createdById: instructor.id,
    instructors: { create: { userId: instructor.id, assignedBy: instructor.id } },
    codes: { create: { code: 'E2ECODE1', createdBy: instructor.id } },
    enrollments: { create: { userId: learner.id, enrolledBy: instructor.id } },
  },
});
const code = await prisma.sectionCode.findFirstOrThrow({ where: { sectionId: section.id } });

const mk = (type, prompt, points, payload, extra = {}) =>
  prisma.question.create({
    data: {
      ownerId: instructor.id, type, prompt, points, payload,
      subject: 'E2E', topic: 'General', ...extra,
    },
  });

const qTF = await mk('TRUE_FALSE', 'The sky is blue.', 1, { correct: true });
const qMC = await mk('MULTIPLE_CHOICE', 'Pick the capital of France.', 2, {
  options: [
    { id: 'a', text: 'Paris' },
    { id: 'b', text: 'London' },
    { id: 'c', text: 'Rome' },
  ],
  correctId: 'a',
});
const qMS = await mk('MULTIPLE_SELECT', 'Select all prime numbers.', 2, {
  options: [
    { id: 'a', text: '2' },
    { id: 'b', text: '4' },
    { id: 'c', text: '7' },
    { id: 'd', text: '9' },
  ],
  correctIds: ['a', 'c'],
});
const qSA = await mk('SHORT_ANSWER', 'Type the largest planet.', 1, {
  answers: ['Jupiter', 'jupiter'], caseSensitive: false,
});
const qID = await mk('IDENTIFICATION', 'Name the author of Hamlet.', 2, {
  answers: ['William Shakespeare', 'Shakespeare'], caseSensitive: false,
});
const qES = await mk('ESSAY', 'Explain photosynthesis in 2-3 sentences.', 5, {
  wordLimit: 120,
  rubric: [{ label: 'Accuracy', max: 3 }, { label: 'Clarity', max: 2 }],
});

const questions = [qTF, qMC, qMS, qSA, qID, qES];

const set = await prisma.questionSet.create({
  data: {
    ownerId: instructor.id,
    title: 'E2E Set',
    items: { create: questions.map((q, i) => ({ questionId: q.id, order: i })) },
  },
});

// Build snapshot identical to resolveSnapshot() output.
const items = questions.map((q, i) => ({
  key: `i${i}`,
  refId: q.id,
  type: q.type,
  prompt: q.prompt,
  points: q.points,
  payload: q.payload,
  explanation: q.explanation,
  topic: q.topic,
  subject: q.subject,
}));
const snapshot = {
  mode: 'QUIZ',
  title: 'E2E Mixed Assessment',
  items,
  settings: {
    timeLimitSec: 600,
    attemptLimit: 2,
    shuffleQuestions: false,
    shuffleOptions: false,
    feedbackRelease: {
      showScores: true,
      showCorrectAnswers: false,
      showExplanations: false,
      showFeedback: true,
      releaseAt: null,
    },
  },
};

const assessment = await prisma.assessment.create({
  data: {
    ownerId: instructor.id,
    title: 'E2E Mixed Assessment',
    mode: 'QUIZ',
    status: 'PUBLISHED',
    draft: {
      items: questions.map((q) => ({ kind: 'QUESTION', questionId: q.id })),
      settings: {},
    },
    versions: {
      create: { version: 1, snapshot, publishedBy: instructor.id },
    },
  },
});
const version = await prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: assessment.id } });

await prisma.sectionAssignment.create({
  data: {
    assessmentId: assessment.id,
    sectionId: section.id,
    versionId: version.id,
    timeLimitSec: 600,
    attemptLimit: 2,
    feedbackRelease: snapshot.settings.feedbackRelease,
    createdById: instructor.id,
  },
});
const assignment = await prisma.sectionAssignment.findFirstOrThrow({ where: { assessmentId: assessment.id } });

console.log(JSON.stringify({
  instructorId: instructor.id,
  learnerId: learner.id,
  sectionId: section.id,
  code: code.code,
  assignmentId: assignment.id,
  assessmentId: assessment.id,
  versionId: version.id,
  setId: set.id,
}, null, 2));

await prisma.$disconnect();
