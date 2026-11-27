import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { Flow, ManualSection, Shot, Tip, manualNav } from '@/components/manual';
import { ManualToc } from '@/components/manual-toc';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { id: 'sign-in', title: '1. Signing in' },
  { id: 'join', title: '2. Joining a section' },
  { id: 'dashboard', title: '3. Your dashboard' },
  { id: 'section', title: '4. Section page' },
  { id: 'runner', title: '5. Taking an assessment' },
  { id: 'results', title: '6. Results & review' },
];

export default async function LearnerManual() {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  return (
    <AppShell user={user} nav={manualNav(user.role)}>
      <PageHeader title="Learner guide" subtitle="Everything you need to join sections and complete assessments." />

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <ManualToc items={SECTIONS} />
      <div className="min-w-0">
      <ManualSection id="sign-in" title="1. Signing in">
        <p>
          Open QuizVault and choose <strong>Continue with Google</strong>. There is no password — your Google
          account is your identity. New accounts start as learners automatically.
        </p>
        <Shot
          src="common-sign-in"
          alt="QuizVault sign-in page"
          legend={[
            'Page heading — sign in with any Google account.',
            'Continue with Google — the only sign-in method.',
            'Feature highlights for learners, including joining sections with a class code.',
          ]}
        />
      </ManualSection>

      <ManualSection id="join" title="2. Joining a section">
        <p>
          Your instructor shares a <strong>class code</strong>. Go to <strong>Join section</strong> in the
          navigation, paste the code, and submit. Access may be instant or require instructor approval,
          depending on how your section is configured.
        </p>
        <Flow
          steps={[
            { title: 'Get the code', body: 'Ask your instructor for the class code.' },
            { title: 'Join section', body: 'Enter the code on the Join section page.' },
            { title: 'Wait for access', body: 'Instant, or pending instructor approval.' },
            { title: 'See assignments', body: 'Published work appears on your dashboard.' },
          ]}
        />
        <Shot
          src="learner-join"
          alt="Join a section page"
          legend={[
            'Class code field — enter the code exactly as shared.',
            'Join section — submits the code; you will see whether access was granted or is pending.',
          ]}
        />
      </ManualSection>

      <ManualSection id="dashboard" title="3. Your dashboard">
        <p>
          The learner dashboard shows your stats at a glance, an <strong>Up next</strong> card surfacing your
          in-progress attempt or the soonest upcoming assignment, your sections, and your assignment list with
          score badges on completed work.
        </p>
        <Shot
          src="learner-dashboard"
          alt="Learner dashboard"
          legend={[
            'Stat cards — sections joined, attempts in progress, completed, and average score.',
            'Up next — resume an open attempt or see what opens soonest.',
          ]}
        />
      </ManualSection>

      <ManualSection id="section" title="4. Section page & assignments">
        <p>
          Each section page lists its assignments. Open one to see details, then press <strong>Start</strong>
          (or <strong>Resume</strong> if you have an open attempt). Completed assignments show your score.
        </p>
        <Shot src="learner-section" alt="Section page with assignments" caption="The section page lists every assignment with its status and your score where released." />
      </ManualSection>

      <ManualSection id="runner" title="5. Taking an assessment">
        <p>
          The runner presents one question at a time. Answers save automatically as you go — you can leave and
          resume later until the deadline. Use the navigator palette to jump between questions, flag ones to
          revisit, and press <strong>Submit</strong> when done. Submission is final.
        </p>
        <Shot
          src="learner-runner"
          alt="Assessment runner"
          legend={[
            'Navigator palette — jump to any question; colors show answered, current, and flagged states.',
            'Submit — opens a confirmation; after submitting you cannot change answers.',
          ]}
        />
        <Tip>
          Essays may keep the attempt in <em>pending grading</em> after you submit — your instructor grades
          them manually before final scores are released.
        </Tip>
      </ManualSection>

      <ManualSection id="results" title="6. Results & review">
        <p>
          After submission, the results page shows your score once released, per-question review with correct
          answers and explanations (depending on the assessment&rsquo;s feedback settings), and any essay feedback
          your instructor has entered.
        </p>
        <Shot
          src="learner-results"
          alt="Attempt results page"
          legend={[
            'Score — your points out of the total, shown when feedback is released.',
            'Review — per-question breakdown with correctness and explanations.',
          ]}
        />
      </ManualSection>
      </div>
      </div>
    </AppShell>
  );
}
