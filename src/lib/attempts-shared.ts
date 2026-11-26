import { prisma } from './prisma';
import type { SessionUser } from './auth';
import type { Snapshot, SnapshotItem } from './questions';
import { Prisma } from '@prisma/client';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Strip answer keys from an item payload for learner consumption. */
export function learnerPayload(item: SnapshotItem): SnapshotItem['payload'] {
  const p = { ...(item.payload as Record<string, unknown>) };
  delete p.correct;
  delete p.correctId;
  delete p.correctIds;
  delete p.correctOrder;
  delete p.answers;
  delete p.rubric;
  // Ordering items are stored in correct sequence — always shuffle for learners.
  if (item.type === 'ORDERING' && Array.isArray(p.items)) {
    p.items = shuffle(p.items as { id: string; text: string }[]);
  }
  return p as SnapshotItem['payload'];
}

export function learnerItem(item: SnapshotItem) {
  return { ...item, payload: learnerPayload(item) };
}

/**
 * Build the effective item list for an attempt: applies question shuffling and
 * per-attempt option shuffling. Returns items plus the persisted order keys.
 */
export function buildAttemptItems(
  snapshot: Snapshot,
  opts: { shuffleQuestions: boolean; shuffleOptions: boolean },
): { items: SnapshotItem[]; itemOrder: string[] } {
  let items = [...snapshot.items];
  if (opts.shuffleQuestions) items = shuffle(items);
  if (opts.shuffleOptions) {
    items = items.map((item) => {
      const p = item.payload as { options?: { id: string; text: string }[] };
      if ((item.type === 'MULTIPLE_CHOICE' || item.type === 'MULTIPLE_SELECT') && p.options) {
        return { ...item, payload: { ...item.payload, options: shuffle(p.options) } };
      }
      return item;
    });
  }
  return { items, itemOrder: items.map((i) => i.key) };
}

export function snapshotFrom(version: { snapshot: Prisma.JsonValue } | null | undefined): Snapshot | null {
  if (!version?.snapshot || typeof version.snapshot !== 'object') return null;
  return version.snapshot as unknown as Snapshot;
}

/** Verify the user may take this attempt (owner check). */
export async function attemptForUser(attemptId: string, user: SessionUser) {
  return prisma.attempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: {
      version: true,
      assessment: { select: { mode: true, title: true } },
      assignment: { include: { assessment: true, section: true } },
    },
  });
}
