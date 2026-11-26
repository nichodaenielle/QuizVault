import { redirect } from 'next/navigation';
import { getSessionUser, homePathFor } from '@/lib/auth';
import { DevLogin } from './dev-login';

export const dynamic = 'force-dynamic';

const FEATURES = [
  'Join sections with a class code',
  'Six question types, auto-graded',
  'Timed quizzes and exams',
  'Instant progress and released results',
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.role));
  const { error } = await searchParams;
  const oauthConfigured = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const devAuth = process.env.DEV_AUTH === '1' && process.env.NODE_ENV !== 'production';

  return (
    <main className="flex min-h-screen bg-ivory-50">
      {/* Brand panel */}
      <section className="relative hidden w-[45%] max-w-xl flex-col justify-between overflow-hidden bg-gradient-to-br from-pine-950 via-pine-900 to-pine-800 p-10 text-ivory-50 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-pine-700/40 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/QuizVault%20Logo%20Only.png"
            alt=""
            className="h-11 w-11 rounded-xl bg-ivory-100 object-contain p-1"
          />
          <span className="text-lg font-semibold tracking-tight">QuizVault</span>
        </div>

        <div className="relative">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
            Practice makes permanent.
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Reviewers, quizzes, and exams —
            <br />
            all in one vault.
          </h1>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-ivory-50/85">
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-gold-500"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5.5 4 8l4.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ivory-50/50">
          © {new Date().getFullYear()} QuizVault
        </p>
      </section>

      {/* Sign-in panel */}
      <section className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Compact brand for small screens */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/QuizVault%20Logo%20Only.png"
              alt=""
              className="h-10 w-10 rounded-xl bg-ivory-100 object-contain p-1 shadow-sm"
            />
            <div>
              <p className="font-semibold text-ink-900">QuizVault</p>
              <p className="text-xs text-ink-600">Reviewers, quizzes, and exams</p>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-400/15 bg-ivory-100 p-8 shadow-xl shadow-pine-950/10">
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">Sign in</h2>
            <p className="mt-1 text-sm text-ink-600">
              Use your Google account to continue.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </p>
            )}

            <div className="mt-6 space-y-3">
              {oauthConfigured ? (
                <a
                  href="/api/auth/google"
                  className="flex w-full items-center justify-center gap-3 rounded-lg bg-pine-900 px-4 py-3 text-sm font-medium text-ivory-50 shadow-sm transition-colors hover:bg-pine-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine-800"
                >
                  <GoogleIcon />
                  Continue with Google
                </a>
              ) : (
                <p className="rounded-lg border border-gold-500/40 bg-gold-100 px-3 py-2 text-sm text-ink-900">
                  Google OAuth is not configured. Set <code>GOOGLE_CLIENT_ID</code> and{' '}
                  <code>GOOGLE_CLIENT_SECRET</code> in <code>.env</code>.
                </p>
              )}

              {devAuth && <DevLogin />}
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-ink-600">
              By signing in you agree to use QuizVault for your courses.
              <br />
              Learners join sections with a class code after signing in.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-ink-400">
            Trouble signing in? Contact your instructor or administrator.
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
