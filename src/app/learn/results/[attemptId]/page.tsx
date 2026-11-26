import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { orderItems } from '@/lib/attempts';
import { DEFAULT_RELEASE, type AnswerValue, type FeedbackRelease, type Snapshot, type SnapshotItem } from '@/lib/questions';

export const dynamic = 'force-dynamic';

function describeAnswer(item: SnapshotItem, answer: AnswerValue): string {
  if (answer == null) return 'No answer';
  const p = item.payload as Record<string, unknown>;
  switch (item.type) {
    case 'TRUE_FALSE':
      return answer === true ? 'True' : 'False';
    case 'MULTIPLE_CHOICE': {
      const opt = (p.options as { id: string; text: string }[])?.find((o) => o.id === answer);
      return opt?.text ?? String(answer);
    }
    case 'MULTIPLE_SELECT': {
      const opts = (p.options as { id: string; text: string }[]) ?? [];
      const sel = new Set(Array.isArray(answer) ? answer : []);
      return opts.filter((o) => sel.has(o.id)).map((o) => o.text).join('; ') || 'No answer';
    }
    case 'ORDERING': {
      const opts = (p.items as { id: string; text: string }[]) ?? [];
      const byId = new Map(opts.map((o) => [o.id, o.text]));
      const seq = (Array.isArray(answer) ? answer : []).map((id) => byId.get(String(id)) ?? String(id));
      return seq.length ? seq.join(' → ') : 'No answer';
    }
    case 'ESSAY':
      return typeof answer === 'string' ? answer : 'No answer';
    default:
      return typeof answer === 'string' ? answer : String(answer);
  }
}

function correctAnswerText(item: SnapshotItem): string {
  const p = item.payload as Record<string, unknown>;
  switch (item.type) {
    case 'TRUE_FALSE':
      return p.correct ? 'True' : 'False';
    case 'MULTIPLE_CHOICE': {
      const opt = (p.options as { id: string; text: string }[])?.find((o) => o.id === p.correctId);
      return opt?.text ?? '—';
    }
    case 'MULTIPLE_SELECT': {
      const opts = (p.options as { id: string; text: string }[]) ?? [];
      const sel = new Set<string>((p.correctIds as string[] | undefined) ?? []);
      return opts.filter((o) => sel.has(o.id)).map((o) => o.text).join('; ') || '—';
    }
    case 'ORDERING': {
      const opts = (p.items as { id: string; text: string }[]) ?? [];
      const byId = new Map(opts.map((o) => [o.id, o.text]));
      const order = (p.correctOrder as string[] | undefined) ?? [];
      return order.map((id) => byId.get(id) ?? id).join(' → ') || '—';
    }
    case 'SHORT_ANSWER':
    case 'IDENTIFICATION':
      return (p.answers as string[])?.join(' / ') ?? '—';
    case 'ESSAY':
      return 'Manually graded';
    default:
      return '—';
  }
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  const { attemptId } = await params;

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: {
      assessment: { select: { title: true, mode: true } },
      assignment: { select: { sectionId: true, feedbackRelease: true } },
      version: true,
      responses: { include: { grade: true } },
    },
  });
  if (!attempt) notFound();

  const snap = attempt.version?.snapshot as unknown as Snapshot | null;
  const items = snap ? orderItems(snap.items, attempt.itemOrder) : [];
  const release = {
    ...DEFAULT_RELEASE,
    ...((attempt.assignment.feedbackRelease as Partial<FeedbackRelease> | null) ?? {}),
  };
  const isReviewer = attempt.assessment.mode === 'REVIEWER';
  const gradingDone = attempt.gradingStatus === 'GRADED' || attempt.gradingStatus === 'AUTO_GRADED';
  const now = new Date();
  const releaseTimeOk = !release.releaseAt || now >= new Date(release.releaseAt);
  const released = isReviewer || releaseTimeOk;

  const canSeeScores = released && release.showScores && gradingDone;
  const canSeeAnswers = released && release.showCorrectAnswers && gradingDone;
  const canSeeExplanations = released && release.showExplanations;
  const canSeeFeedback = released && release.showFeedback && gradingDone;

  const respByKey = new Map(attempt.responses.map((r) => [r.itemKey, r]));
  const section = await prisma.section.findUnique({
    where: { id: attempt.assignment.sectionId },
    select: { name: true },
  });

  return (
    <AppShell user={user} nav={[{ href: '/learn', label: 'Dashboard' }]}>
      <PageHeader
        title={attempt.assessment.title}
        subtitle={`${section?.name ?? ''} · Attempt ${attempt.attemptNumber} · submitted ${formatDateTime(attempt.submittedAt, user.timezone)}`}
        actions={
          attempt.status === 'IN_PROGRESS' ? (
            <Link href={`/learn/attempts/${attempt.id}`} className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50">
              Resume attempt
            </Link>
          ) : (
            <LinkButton href="/learn" variant="secondary">
              Back to dashboard
            </LinkButton>
          )
        }
      />

      {attempt.status === 'IN_PROGRESS' ? (
        <EmptyState title="Attempt in progress" body="Finish and submit to see results." />
      ) : (
        <>
          <Card className="mb-6 p-5">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-sm text-ink-600">Score</p>
                <p className="text-3xl font-semibold text-ink-900">
                  {canSeeScores ? `${attempt.score ?? 0} / ${attempt.maxScore ?? '—'}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-ink-600">Status</p>
                <Badge tone={gradingDone ? 'green' : 'gold'} className="mt-1">
                  {gradingDone ? 'Graded' : 'Pending grading'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-ink-600">Submitted</p>
                <p className="text-sm font-medium text-ink-900">{formatDateTime(attempt.submittedAt, user.timezone)}</p>
              </div>
            </div>
            {!gradingDone && (
              <p className="mt-3 rounded-lg bg-gold-100 px-3 py-2 text-sm text-ink-900">
                Some responses (essays) are still awaiting instructor grading. Scores will appear once grading is complete.
              </p>
            )}
            {released === false && (
              <p className="mt-3 rounded-lg bg-pine-50 px-3 py-2 text-sm text-ink-900">
                Results for this assessment are released at {formatDateTime(release.releaseAt, user.timezone)}.
              </p>
            )}
          </Card>

          <h2 className="mb-3 text-lg font-semibold text-ink-900">Review</h2>
          <ol className="space-y-4">
            {items.map((item, idx) => {
              const resp = respByKey.get(item.key);
              const answer = (resp?.answer ?? null) as AnswerValue;
              const essay = item.type === 'ESSAY';
              const graded = resp?.score != null;
              return (
                <li key={item.key}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink-400">{idx + 1}.</span>
                      <Badge tone="neutral">{item.type.replace(/_/g, ' ')}</Badge>
                      <Badge tone="green">{item.points} pts</Badge>
                      {canSeeScores && graded && (
                        <Badge tone={resp!.score === item.points ? 'green' : 'red'}>
                          {resp!.score}/{item.points}
                        </Badge>
                      )}
                      {essay && resp?.grade && canSeeFeedback && (
                        <Badge tone="blue">Instructor graded</Badge>
                      )}
                    </div>
                    <p className="mt-2 font-medium text-ink-900">{item.prompt}</p>

                    <div className="mt-3 rounded-lg bg-ivory-50 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">Your answer</p>
                      <p className="mt-1 whitespace-pre-wrap text-ink-900">{describeAnswer(item, answer)}</p>
                    </div>

                    {canSeeAnswers && (
                      <div className="mt-2 rounded-lg border border-pine-800/30 bg-pine-50 p-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-pine-800">Correct answer</p>
                        <p className="mt-1 text-ink-900">{correctAnswerText(item)}</p>
                      </div>
                    )}

                    {canSeeExplanations && item.explanation && (
                      <div className="mt-2 rounded-lg border border-gold-500/40 bg-gold-100/60 p-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Explanation</p>
                        <p className="mt-1 whitespace-pre-wrap text-ink-900">{item.explanation}</p>
                      </div>
                    )}

                    {essay && resp?.grade && canSeeFeedback && (
                      <div className="mt-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                          Instructor feedback — {resp.grade.score}/{resp.grade.maxScore}
                        </p>
                        {resp.grade.feedback && <p className="mt-1 whitespace-pre-wrap text-ink-900">{resp.grade.feedback}</p>}
                        {resp.grade.rubricScores != null && (
                          <pre className="mt-2 overflow-x-auto rounded bg-ivory-100 p-2 text-xs text-ink-600">
                            {JSON.stringify(resp.grade.rubricScores, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {essay && resp && !resp.grade && attempt.gradingStatus === 'PENDING_GRADING' && (
                      <p className="mt-2 text-sm text-ink-600">Awaiting instructor grading.</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </AppShell>
  );
}
