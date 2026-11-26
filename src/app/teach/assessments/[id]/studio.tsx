'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  publishAssessment,
  removeAssignment,
  saveAssessmentDraft,
  setAssessmentStatus,
  updateAssignmentSettings,
  type AssignmentSettingsInput,
  type DraftItem,
  type DraftSpec,
} from '@/lib/actions/assessments';
import { DEFAULT_RELEASE, type AssessmentSettings, type FeedbackRelease } from '@/lib/questions';
import type { QuestionType } from '@prisma/client';
import { Badge, Button, Card, Field } from '@/components/ui';
import { toLocalInputValue, fromLocalInputValue, formatDateTime } from '@/lib/time';

interface QuestionOpt { id: string; prompt: string; type: QuestionType; points: number; topic: string; subject: string }
interface SetOpt { id: string; title: string; count: number }
interface SectionOpt { id: string; name: string; learners: number }
interface AssignmentRow {
  id: string;
  sectionId: string;
  sectionName: string;
  opensAt: string | null;
  closesAt: string | null;
  timeLimitSec: number | null;
  attemptLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  feedbackRelease: FeedbackRelease | null;
  attemptCount: number;
}
interface VersionRow { version: number; publishedAt: string }

const TYPE_LABEL: Record<string, string> = {
  TRUE_FALSE: 'T/F', MULTIPLE_CHOICE: 'MC', MULTIPLE_SELECT: 'MS',
  SHORT_ANSWER: 'Short', IDENTIFICATION: 'ID', ESSAY: 'Essay',
};

export function Studio({
  assessmentId,
  status,
  initialDraft,
  questions,
  sets,
  sections,
  assignments,
  versions,
  timezone,
}: {
  assessmentId: string;
  status: string;
  initialDraft: DraftSpec;
  questions: QuestionOpt[];
  sets: SetOpt[];
  sections: SectionOpt[];
  assignments: AssignmentRow[];
  versions: VersionRow[];
  timezone: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>(initialDraft.items ?? []);
  const [settings, setSettings] = useState<AssessmentSettings>(initialDraft.settings ?? {});
  const [selectedSections, setSelectedSections] = useState<string[]>(initialDraft.settings?.sectionIds ?? []);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');


  async function persist(nextItems = items, nextSettings = settings, nextSections = selectedSections) {
    setSaveState('saving');
    const s: DraftSpec = { items: nextItems, settings: { ...nextSettings, sectionIds: nextSections } };
    const res = await saveAssessmentDraft(assessmentId, s);
    setSaveState(res.ok ? 'saved' : 'error');
    if (!res.ok) setMessage(res.error ?? 'Save failed.');
    return res.ok;
  }

  function mutate(fn: (draft: { items: DraftItem[]; settings: AssessmentSettings; sections: string[] }) => void) {
    const nextItems = [...items];
    const nextSettings = { ...settings };
    const nextSections = [...selectedSections];
    fn({ items: nextItems, settings: nextSettings, sections: nextSections });
    setItems(nextItems);
    setSettings(nextSettings);
    setSelectedSections(nextSections);
    void persist(nextItems, nextSettings, nextSections);
  }

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const setById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);

  function describe(item: DraftItem): { title: string; sub: string } {
    if (item.kind === 'QUESTION') {
      const q = qById.get(item.questionId);
      return { title: q?.prompt ?? 'Deleted question', sub: q ? `${q.subject} · ${TYPE_LABEL[q.type] ?? q.type} · ${q.points} pts` : '' };
    }
    if (item.kind === 'SET') {
      const s = setById.get(item.setId);
      return { title: `Set: ${s?.title ?? 'Deleted set'}`, sub: `${s?.count ?? 0} questions` };
    }
    const s = setById.get(item.setId);
    return { title: `Random ${item.count} from: ${s?.title ?? 'Deleted set'}`, sub: 'Randomly drawn at publish time' };
  }

  async function publish() {
    setMessage('');
    const saved = await persist();
    if (!saved) return;
    const res = await publishAssessment(assessmentId, selectedSections);
    setMessage(res.ok ? 'Published.' : res.error ?? 'Publish failed.');
    router.refresh();
  }

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    const res = await fn();
    if (!res.ok) setMessage(res.error ?? 'Action failed.');
    router.refresh();
  }

  const editable = status !== 'ARCHIVED';
  const isDraft = status === 'DRAFT';

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Builder */}
      <div className="space-y-6">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Questions</h2>
            <span className="text-xs text-ink-600" role="status">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : saveState === 'error' ? 'Save failed' : ''}
            </span>
          </div>
          {!editable ? (
            <p className="text-sm text-ink-600">This assessment is archived and read-only.</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink-400/30 p-4 text-sm text-ink-600">
              No questions yet. Add questions, sets, or a random draw below.
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((item, i) => {
                const d = describe(item);
                return (
                  <li key={`${item.kind}-${i}`} className="flex items-start gap-3 rounded-lg border border-ink-400/20 bg-ivory-50 p-3">
                    <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-semibold text-ink-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-ink-900">{d.title}</p>
                      <p className="text-xs text-ink-600">{d.sub}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" disabled={i === 0} onClick={() => moveItem(i, -1)} className="rounded border border-ink-400/30 px-2 py-0.5 text-xs disabled:opacity-40" aria-label="Move up">↑</button>
                      <button type="button" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)} className="rounded border border-ink-400/30 px-2 py-0.5 text-xs disabled:opacity-40" aria-label="Move down">↓</button>
                      <button type="button" onClick={() => mutate((d) => { d.items.splice(i, 1); })} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700" aria-label="Remove">✕</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {editable && (
            <div className="mt-4 grid gap-3 border-t border-ink-400/15 pt-4 sm:grid-cols-3">
              <AddPicker
                label="Add question"
                options={questions.map((q) => ({ id: q.id, label: `${q.prompt.slice(0, 60)}… (${TYPE_LABEL[q.type]})` }))}
                onPick={(id) => mutate((d) => { d.items.push({ kind: 'QUESTION', questionId: id }); })}
              />
              <AddPicker
                label="Add set"
                options={sets.map((s) => ({ id: s.id, label: `${s.title} (${s.count})` }))}
                onPick={(id) => mutate((d) => { d.items.push({ kind: 'SET', setId: id }); })}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Random draw</label>
                <div className="flex gap-1">
                  <select id="rand-set" className="flex-1 text-sm" defaultValue="">
                    <option value="">Set…</option>
                    {sets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                  <input id="rand-count" type="number" min={1} className="w-16 text-sm" placeholder="n" aria-label="Number of questions" />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const sel = document.getElementById('rand-set') as HTMLSelectElement;
                      const cnt = document.getElementById('rand-count') as HTMLInputElement;
                      if (sel.value && Number(cnt.value) > 0) {
                        mutate((d) => { d.items.push({ kind: 'RANDOM', setId: sel.value, count: Number(cnt.value) }); });
                        sel.value = '';
                        cnt.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-ink-900">Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opens at (optional)" htmlFor="opensAt">
              <input
                id="opensAt"
                type="datetime-local"
                disabled={!editable}
                value={toLocalInputValue(settings.opensAt ? new Date(settings.opensAt) : null, timezone)}
                onChange={(e) => mutate((d) => { d.settings.opensAt = fromLocalInputValue(e.target.value, timezone)?.toISOString() ?? null; })}
              />
            </Field>
            <Field label="Closes at (optional)" htmlFor="closesAt">
              <input
                id="closesAt"
                type="datetime-local"
                disabled={!editable}
                value={toLocalInputValue(settings.closesAt ? new Date(settings.closesAt) : null, timezone)}
                onChange={(e) => mutate((d) => { d.settings.closesAt = fromLocalInputValue(e.target.value, timezone)?.toISOString() ?? null; })}
              />
            </Field>
            <Field label="Time limit (minutes)" htmlFor="timeLimit">
              <input
                id="timeLimit"
                type="number"
                min={1}
                disabled={!editable}
                value={settings.timeLimitSec ? Math.round(settings.timeLimitSec / 60) : ''}
                onChange={(e) => mutate((d) => { d.settings.timeLimitSec = e.target.value ? Number(e.target.value) * 60 : null; })}
                placeholder="No limit"
              />
            </Field>
            <Field label="Attempt limit" htmlFor="attemptLimit">
              <input
                id="attemptLimit"
                type="number"
                min={1}
                disabled={!editable}
                value={settings.attemptLimit ?? 1}
                onChange={(e) => mutate((d) => { d.settings.attemptLimit = Math.max(1, Number(e.target.value) || 1); })}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-ink-900">
              <input type="checkbox" disabled={!editable} checked={!!settings.shuffleQuestions} onChange={(e) => mutate((d) => { d.settings.shuffleQuestions = e.target.checked; })} />
              Shuffle question order
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-900">
              <input type="checkbox" disabled={!editable} checked={!!settings.shuffleOptions} onChange={(e) => mutate((d) => { d.settings.shuffleOptions = e.target.checked; })} />
              Shuffle answer options
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium text-ink-900">Result release</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['showScores', 'Show scores'],
                ['showCorrectAnswers', 'Show correct answers'],
                ['showExplanations', 'Show explanations'],
                ['showFeedback', 'Show instructor feedback'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-900">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={!!(settings.feedbackRelease ?? DEFAULT_RELEASE)[key]}
                    onChange={(e) =>
                      mutate((d) => {
                        d.settings.feedbackRelease = { ...(d.settings.feedbackRelease ?? DEFAULT_RELEASE), [key]: e.target.checked };
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <Field label="Release results at (optional)" htmlFor="releaseAt" >
              <input
                id="releaseAt"
                type="datetime-local"
                disabled={!editable}
                value={toLocalInputValue(settings.feedbackRelease?.releaseAt ? new Date(settings.feedbackRelease.releaseAt) : null, timezone)}
                onChange={(e) =>
                  mutate((d) => {
                    d.settings.feedbackRelease = {
                      ...(d.settings.feedbackRelease ?? DEFAULT_RELEASE),
                      releaseAt: fromLocalInputValue(e.target.value, timezone)?.toISOString() ?? null,
                    };
                  })
                }
              />
            </Field>
          </fieldset>
        </Card>
      </div>

      {/* Publish + assignments */}
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-ink-900">Publish to sections</h2>
          <p className="mb-3 text-sm text-ink-600">
            Publishing freezes a versioned snapshot. Later edits never change existing attempts.
          </p>
          {sections.length === 0 ? (
            <p className="text-sm text-ink-600">No sections available to you.</p>
          ) : (
            <ul className="mb-4 max-h-56 space-y-1 overflow-y-auto">
              {sections.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-pine-50">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={selectedSections.includes(s.id)}
                      onChange={(e) =>
                        setSelectedSections((sel) =>
                          e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id),
                        )
                      }
                    />
                    <span className="text-sm text-ink-900">{s.name}</span>
                    <span className="text-xs text-ink-600">({s.learners} learners)</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={publish} disabled={!editable || items.length === 0 || selectedSections.length === 0}>
              {status === 'PUBLISHED' ? 'Publish new version' : 'Publish'}
            </Button>
            {status === 'PUBLISHED' && (
              <Button type="button" variant="secondary" onClick={() => act(() => setAssessmentStatus(assessmentId, 'CLOSED'))}>
                Close assessment
              </Button>
            )}
            {status === 'CLOSED' && (
              <Button type="button" variant="secondary" onClick={() => act(() => setAssessmentStatus(assessmentId, 'PUBLISHED'))}>
                Reopen
              </Button>
            )}
            {status !== 'ARCHIVED' && status !== 'DRAFT' && (
              <Button type="button" variant="ghost" onClick={() => act(() => setAssessmentStatus(assessmentId, 'ARCHIVED'))}>
                Archive
              </Button>
            )}
            {isDraft && (
              <Button type="button" variant="ghost" onClick={() => act(() => setAssessmentStatus(assessmentId, 'ARCHIVED'))}>
                Archive draft
              </Button>
            )}
          </div>
          {message && <p role="status" className="mt-2 text-sm text-ink-600">{message}</p>}
          {versions.length > 0 && (
            <p className="mt-2 text-xs text-ink-600">Published versions: {versions.map((v) => `v${v.version}`).join(', ')}</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-ink-900">Section assignments</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-ink-600">Not published to any section yet.</p>
          ) : (
            <ul className="space-y-3">
              {assignments.map((a) => (
                <AssignmentSettings key={a.id} row={a} editable={editable} timezone={timezone} onRemove={() => act(() => removeAssignment(a.id))} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );

  function moveItem(index: number, dir: -1 | 1) {
    mutate((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.items.length) return;
      [d.items[index], d.items[j]] = [d.items[j], d.items[index]];
    });
  }
}

function AddPicker({
  label,
  options,
  onPick,
}: {
  label: string;
  options: { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  const [selected, setSelected] = useState('');
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-600">{label}</label>
      <div className="flex gap-1">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1 text-sm">
          <option value="">Select…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <Button type="button" variant="secondary" disabled={!selected} onClick={() => { onPick(selected); setSelected(''); }}>
          Add
        </Button>
      </div>
    </div>
  );
}

function AssignmentSettings({
  row,
  editable,
  timezone,
  onRemove,
}: {
  row: AssignmentRow;
  editable: boolean;
  timezone: string;
  onRemove: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [opensAt, setOpensAt] = useState(toLocalInputValue(row.opensAt ? new Date(row.opensAt) : null, timezone));
  const [closesAt, setClosesAt] = useState(toLocalInputValue(row.closesAt ? new Date(row.closesAt) : null, timezone));
  const [timeLimitMin, setTimeLimitMin] = useState(row.timeLimitSec ? Math.round(row.timeLimitSec / 60) : '');
  const [attemptLimit, setAttemptLimit] = useState(row.attemptLimit);
  const [shuffleQ, setShuffleQ] = useState(row.shuffleQuestions);
  const [shuffleO, setShuffleO] = useState(row.shuffleOptions);
  const [release, setRelease] = useState<FeedbackRelease>({ ...DEFAULT_RELEASE, ...(row.feedbackRelease ?? {}) });

  async function save() {
    setBusy(true);
    setError('');
    const input: AssignmentSettingsInput = {
      opensAt: fromLocalInputValue(opensAt, timezone)?.toISOString() ?? null,
      closesAt: fromLocalInputValue(closesAt, timezone)?.toISOString() ?? null,
      timeLimitSec: timeLimitMin === '' ? null : Number(timeLimitMin) * 60,
      attemptLimit: Number(attemptLimit) || 1,
      shuffleQuestions: shuffleQ,
      shuffleOptions: shuffleO,
      feedbackRelease: release,
    };
    const res = await updateAssignmentSettings(row.id, input);
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Failed.');
    router.refresh();
  }

  return (
    <li className="rounded-lg border border-ink-400/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-900">{row.sectionName}</p>
        <span className="flex items-center gap-2">
          <Badge tone="neutral">{row.attemptCount} attempts</Badge>
          {row.attemptCount === 0 && editable && (
            <button type="button" onClick={onRemove} className="text-xs text-red-700 hover:underline">Remove</button>
          )}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-ink-600">Opens
          <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} disabled={!editable} className="mt-0.5" />
        </label>
        <label className="text-xs text-ink-600">Closes
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} disabled={!editable} className="mt-0.5" />
        </label>
        <label className="text-xs text-ink-600">Time limit (min)
          <input type="number" min={1} value={timeLimitMin} onChange={(e) => setTimeLimitMin(e.target.value)} disabled={!editable} className="mt-0.5" placeholder="None" />
        </label>
        <label className="text-xs text-ink-600">Attempts
          <input type="number" min={1} value={attemptLimit} onChange={(e) => setAttemptLimit(Number(e.target.value))} disabled={!editable} className="mt-0.5" />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-900">
        <label className="flex items-center gap-1"><input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} disabled={!editable} /> Shuffle Qs</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} disabled={!editable} /> Shuffle options</label>
        {(['showScores', 'showCorrectAnswers', 'showExplanations', 'showFeedback'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={!!release[k]} onChange={(e) => setRelease((r) => ({ ...r, [k]: e.target.checked }))} disabled={!editable} />
            {k.replace('show', '')}
          </label>
        ))}
      </div>
      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={save} disabled={busy} className="px-3 py-1 text-xs">
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
          {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
        </div>
      )}
      <p className="mt-1 text-[11px] text-ink-400">
        {row.opensAt ? `opens ${formatDateTime(row.opensAt, timezone)}` : 'opens immediately'}
        {' · '}
        {row.closesAt ? `closes ${formatDateTime(row.closesAt, timezone)}` : 'no close'}
      </p>
    </li>
  );
}
