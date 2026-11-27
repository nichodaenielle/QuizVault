import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { Flow, ManualSection, Shot, Tip, manualNav } from '@/components/manual';

export const dynamic = 'force-dynamic';

export default async function InstructorManual() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  return (
    <AppShell user={user} nav={manualNav(user.role)}>
      <PageHeader title="Instructor guide" subtitle="Build assessments, run sections, and grade essays." />

      <ManualSection id="dashboard" title="1. Teaching dashboard">
        <p>
          Stats show your sections, enrolled learners, assessments, and pending grades. The{' '}
          <strong>Needs attention</strong> panel surfaces essays awaiting grading, assessments closing within
          48 hours, and expired attempts — click through to handle them.
        </p>
        <Shot
          src="instructor-dashboard"
          alt="Instructor dashboard"
          legend={[
            'Needs attention — a live work queue: ungraded essays, closing deadlines, expired attempts.',
            'Pending grades — essay responses waiting in the grading queue.',
          ]}
        />
      </ManualSection>

      <ManualSection id="questions" title="2. Question bank">
        <p>
          Create questions in six types — multiple choice, multiple select, true/false, fill-in-the-blank,
          ordering, and essay — with points, hints, explanations, subjects, topics, and difficulty. Filters
          (type, difficulty, subject, status, search) apply instantly. Duplicate a question to fork a variant,
          or archive it to retire it without deleting history.
        </p>
        <Flow
          steps={[
            { title: 'Create', body: 'Question bank → New question.' },
            { title: 'Write', body: 'Prompt, options, answer key, points.' },
            { title: 'Reuse', body: 'Add to sets or assessments directly.' },
            { title: 'Retire', body: 'Archive when no longer needed.' },
          ]}
        />
        <Shot
          src="instructor-questions"
          alt="Question bank"
          legend={['New question — opens the question editor for all six question types.']}
        />
        <Shot
          src="instructor-question-new"
          alt="New question form"
          legend={[
            'Question type — pick one of the six supported formats.',
            'Prompt — the question text learners will see; add options and the answer key below.',
          ]}
        />
      </ManualSection>

      <ManualSection id="sets" title="3. Question sets">
        <p>
          Sets are reusable groups of questions — handy for mixed assessments and randomized draws. Open a set
          to reorder items, add or remove questions, and edit its details. Sets can be archived or deleted;
          deletion is blocked while a live draft references the set.
        </p>
        <Shot src="instructor-sets" alt="Question sets list" />
        <Shot src="instructor-set-detail" alt="Question set editor" caption="Drag items to reorder, or use the arrow buttons. The set editor shows each question's prompt and points." />
      </ManualSection>

      <ManualSection id="assessments" title="4. Assessments & the studio">
        <p>
          Assessments combine question types into three modes: <strong>Reviewer</strong> (practice with
          instant feedback), <strong>Quiz</strong> (timed, auto-graded), and <strong>Exam</strong> (strictest
          rules, often with essays). The studio builds the item list — pick individual questions, whole sets,
          or randomized draws — then publishes a frozen, versioned snapshot to sections.
        </p>
        <Flow
          steps={[
            { title: 'Create', body: 'Assessments → New assessment; choose mode and rules.' },
            { title: 'Build', body: 'Add questions, sets, or random draws in the studio.' },
            { title: 'Publish', body: 'Freeze a version and assign it to sections.' },
            { title: 'Grade', body: 'Essay responses land in the grading queue.' },
          ]}
        />
        <Shot
          src="instructor-assessments"
          alt="Assessments list"
          legend={['New assessment — start a reviewer, quiz, or exam.']}
        />
        <Shot
          src="instructor-assessment-studio"
          alt="Assessment studio"
          caption="The studio has two columns: the item builder on the left, and publish/assignment controls on the right. Published versions are immutable snapshots — editing later never changes attempts already in progress."
        />
        <Tip>
          Publishing fails loudly if a referenced question set was deleted — fix the draft first rather than
          silently shipping a shorter assessment.
        </Tip>
      </ManualSection>

      <ManualSection id="sections" title="5. Sections & class codes">
        <p>
          Sections group learners under you. Each section has join <strong>codes</strong> you can share,
          disable, expire, reactivate, or rotate. The section page shows the roster with per-learner attempt
          counts, and lets you remove learners (their past attempts are preserved).
        </p>
        <Shot
          src="instructor-sections"
          alt="Sections list"
        />
        <Shot
          src="instructor-section-detail"
          alt="Section detail page"
          legend={[
            'Class code — share this with learners; use the controls to rotate, expire, or disable it.',
            'Learner roster — enrollment status and attempt activity per learner.',
          ]}
        />
      </ManualSection>

      <ManualSection id="grading" title="6. Grading essays">
        <p>
          Essay responses appear in the <strong>Grading queue</strong> after learners submit. Open a response to
          read the answer, apply the rubric, enter a score and feedback, and save. Assessments containing
          essays stay in pending-grading status until every essay is graded.
        </p>
        <Shot
          src="instructor-grading"
          alt="Grading queue"
          legend={['Grading queue — every ungraded essay response in your sections, oldest first.']}
        />
      </ManualSection>

      <ManualSection id="invites" title="7. Invites">
        <p>
          The Invites page creates shareable links that onboard learners or instructors without needing class
          codes. Each invite is bound to an email address, grants a role and optional section access, expires,
          and can be revoked. Invitees sign in with the matching Google account to accept.
        </p>
        <Shot src="instructor-invites" alt="Invites page" caption="Create an invite, copy the link, and track who has accepted. Admins additionally see an Admin role option if their email is on the admin-invite allowlist." />
      </ManualSection>
    </AppShell>
  );
}
