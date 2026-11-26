import { prisma } from './prisma';
import { generateCode } from './utils';
import type { CodeStatus } from '@prisma/client';

const JOIN_WINDOW_MS = 15 * 60 * 1000;
const JOIN_MAX_FAILURES = 8;

export interface JoinResult {
  ok: boolean;
  error?: string;
  sectionId?: string;
  sectionName?: string;
  alreadyEnrolled?: boolean;
}

/** Create a fresh ACTIVE code for a section, disabling previous active codes. */
export async function rotateCode(sectionId: string, actorId: string | null) {
  const code = await uniqueCode();
  await prisma.$transaction(async (tx) => {
    await tx.sectionCode.updateMany({
      where: { sectionId, status: 'ACTIVE' },
      data: { status: 'DISABLED', disabledAt: new Date() },
    });
    await tx.sectionCode.create({
      data: { sectionId, code, status: 'ACTIVE', createdBy: actorId },
    });
  });
  return code;
}

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateCode(8);
    const exists = await prisma.sectionCode.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique join code');
}

export async function setCodeStatus(codeId: string, status: CodeStatus) {
  await prisma.sectionCode.update({
    where: { id: codeId },
    data: {
      status,
      ...(status === 'DISABLED' ? { disabledAt: new Date() } : {}),
    },
  });
}

export async function expireCode(codeId: string) {
  await setCodeStatus(codeId, 'EXPIRED');
}

/** Attempt to join a section with a class code. Enforces rate limiting. */
export async function joinWithCode(
  rawCode: string,
  userId: string,
  ip: string | null,
): Promise<JoinResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Enter a class code.' };

  // Rate limit: too many recent failures for this user or IP.
  const since = new Date(Date.now() - JOIN_WINDOW_MS);
  const [userFails, ipFails] = await Promise.all([
    prisma.joinAttempt.count({ where: { userId, success: false, createdAt: { gte: since } } }),
    ip ? prisma.joinAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }) : 0,
  ]);
  if (userFails >= JOIN_MAX_FAILURES || ipFails >= JOIN_MAX_FAILURES * 2) {
    await prisma.joinAttempt.create({ data: { code, userId, ip, success: false } });
    return { ok: false, error: 'Too many failed attempts. Please try again later.' };
  }

  const record = async (success: boolean) => {
    await prisma.joinAttempt.create({ data: { code, userId, ip, success } });
  };

  const sectionCode = await prisma.sectionCode.findUnique({
    where: { code },
    include: { section: true },
  });
  const valid =
    sectionCode &&
    sectionCode.status === 'ACTIVE' &&
    (!sectionCode.expiresAt || sectionCode.expiresAt > new Date());

  if (!valid) {
    await record(false);
    return { ok: false, error: 'That class code is invalid or no longer active.' };
  }

  const sectionId = sectionCode.sectionId;
  const existing = await prisma.enrollment.findUnique({
    where: { sectionId_userId: { sectionId, userId } },
  });
  if (existing) {
    await record(true);
    return { ok: true, sectionId, sectionName: sectionCode.section.name, alreadyEnrolled: true };
  }

  await prisma.$transaction([
    prisma.enrollment.create({ data: { sectionId, userId } }),
    prisma.joinAttempt.create({ data: { code, userId, ip, success: true } }),
  ]);
  return { ok: true, sectionId, sectionName: sectionCode.section.name };
}
