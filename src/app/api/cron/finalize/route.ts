import { NextRequest, NextResponse } from 'next/server';
import { finalizeExpiredAttempts } from '@/lib/attempts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Expiry sweeper endpoint for scheduled invocation (Vercel Cron, cron-job.org,
 * GitHub Actions, etc.). Finalizes in-progress attempts past their deadline.
 * Protected by CRON_SECRET bearer token; open in local development only.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get('authorization') === `Bearer ${secret}`
    : process.env.NODE_ENV !== 'production';
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const finalized = await finalizeExpiredAttempts();
  return NextResponse.json({ ok: true, finalized, at: new Date().toISOString() });
}
