export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { finalizeExpiredAttempts } = await import('@/lib/attempts');
    const g = globalThis as unknown as { __bhSweeper?: NodeJS.Timeout };
    if (!g.__bhSweeper) {
      g.__bhSweeper = setInterval(() => {
        finalizeExpiredAttempts().catch((e) => console.error('expiry sweep failed', e));
      }, 30_000);
      // Don't keep the process alive solely for the sweeper.
      g.__bhSweeper.unref?.();
    }
  }
}
