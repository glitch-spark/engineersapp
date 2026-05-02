import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { FileDown, Loader2, AlertTriangle, Plus, Trash2, Settings, Copy } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import Select from '../components/Select';
import { useAuth } from '../auth/useAuth';
import * as api from '../api/endpoints';
import type { ScreeningPair } from '../api/endpoints';
import { notify } from '../lib/notify';

type GuidelinesMode = 'markdown' | 'plaintext';

export default function ResumeGeneratorPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: accountsData, isLoading: accountsLoading } = useSWR(
    'resume-accounts-lookup',
    () => api.lookupAccounts()
  );

  const accounts = useMemo(() => {
    const all = accountsData?.accounts ?? [];
    if (isAdmin) return all;
    return all.filter((a) => a.createdBy && user?.id && a.createdBy === user.id);
  }, [accountsData, isAdmin, user?.id]);

  const [accountId, setAccountId] = useState('');
  const selectedAccount = accounts.find((a) => a._id === accountId);
  const selectedNeedsSetup = selectedAccount && !selectedAccount.hasExperience;

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a._id,
        label: `${a.name}${a.label ? ` — ${a.label}` : ''}${a.hasExperience ? '' : ' (needs setup)'}`,
      })),
    [accounts]
  );

  const { data: account } = useSWR(
    accountId ? ['account', accountId] : null,
    async () => (await api.getAccount(accountId)) as Record<string, unknown>
  );

  const accountGuidelines = (account?.screeningPrompt as string) || '';
  const accountMode = (account?.screeningPromptMode as GuidelinesMode) || 'plaintext';

  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [questions, setQuestions] = useState<string[]>(['']);

  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideMode, setOverrideMode] = useState<GuidelinesMode>('plaintext');
  const [overrideText, setOverrideText] = useState('');

  // When account changes, default the override draft to the account's stored value
  // so toggling override on doesn't blank the editor.
  useEffect(() => {
    setOverrideMode(accountMode);
    setOverrideText(accountGuidelines);
  }, [accountId, accountMode, accountGuidelines]);

  const [generating, setGenerating] = useState(false);
  const [pairs, setPairs] = useState<ScreeningPair[] | null>(null);

  const { data: historyData, mutate: refetchHistory } = useSWR(
    accountId ? ['resume-history', accountId] : null,
    () => api.listResumeHistory(accountId)
  );

  function setQuestion(i: number, value: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? value : q)));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, '']);
  }

  function removeQuestion(i: number) {
    setQuestions((qs) => (qs.length === 1 ? [''] : qs.filter((_, idx) => idx !== i)));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || selectedNeedsSetup) {
      notify.warn('Pick a profile that has experience filled in first');
      return;
    }
    if (!company.trim()) {
      notify.warn('Company is required');
      return;
    }
    if (!jobDescription.trim()) {
      notify.warn('Job description is required');
      return;
    }

    const cleanQuestions = questions.map((q) => q.trim()).filter(Boolean);

    setGenerating(true);
    setPairs(null);

    try {
      // 1) Generate the resume PDF (also caches previewHtml on the account server-side).
      const { blob } = await api.generateResume({
        accountId,
        company: company.trim(),
        jobDescription,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume_${company.trim().replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      notify.success('Resume generated');
      refetchHistory();

      // 2) If questions are present, generate screening answers using the just-generated resume.
      if (cleanQuestions.length > 0) {
        const screeningBody = {
          accountId,
          jobDescription,
          questions: cleanQuestions,
          useGeneratedResumeContext: true,
          ...(overrideEnabled
            ? { guidelines: overrideText, guidelinesMode: overrideMode }
            : {}),
        };
        try {
          const { pairs: result } = await api.generateScreeningAnswers(screeningBody);
          setPairs(result);
        } catch (err) {
          notify.error(err, 'Resume generated, but answer generation failed');
        }
      }
    } catch (err) {
      notify.error(err, 'Failed to generate resume');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Resume Generator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pick a profile, paste a JD, optionally add screening questions, and click Generate.
          </p>
        </div>
        <Link
          to="/preferences"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary"
        >
          <Settings className="w-4 h-4" />
          Preferences
        </Link>
      </header>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        {accountsLoading ? (
          <p className="text-sm text-gray-500">Loading profiles...</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            You don't own any profiles yet.{' '}
            <Link to="/accounts" className="font-medium underline">
              Create one
            </Link>{' '}
            to start generating.
          </p>
        ) : (
          <Select
            label="Profile"
            required
            value={accountId}
            onChange={setAccountId}
            placeholder="Select a profile"
            options={accountOptions}
          />
        )}
        {selectedNeedsSetup && (
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              This profile has no <strong>experience</strong> filled in.{' '}
              <Link to="/accounts" className="font-medium underline">
                Edit on Profiles
              </Link>{' '}
              first.
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Company<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Corp"
            className="input focus-ring w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Job description<span className="text-red-500 ml-1">*</span>
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={10}
            className="input focus-ring w-full font-mono text-sm"
            required
          />
          <p className="text-xs text-gray-400 mt-1">{jobDescription.length.toLocaleString()} characters</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Screening questions <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> Add question
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            If you add any, the answers are generated against the just-generated resume + JD.
          </p>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <QuestionRow
                key={i}
                index={i}
                value={q}
                onChange={(v) => setQuestion(i, v)}
                onRemove={() => removeQuestion(i)}
                canRemove={questions.length > 1 || q !== ''}
              />
            ))}
          </div>
        </div>

        <details className="border border-gray-200 rounded-lg">
          <summary
            className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 select-none"
            onClick={(e) => {
              // Toggle override on the first user expand so we capture intent.
              if (!overrideEnabled) {
                e.preventDefault();
                setOverrideEnabled(true);
                (e.currentTarget.parentElement as HTMLDetailsElement).open = true;
              }
            }}
          >
            Override Q&amp;A guidelines for this generation
            <span className="text-xs text-gray-400 ml-2">
              (otherwise uses the profile's saved guidelines from{' '}
              <Link to="/preferences" className="text-primary underline" onClick={(e) => e.stopPropagation()}>
                Preferences
              </Link>
              )
            </span>
          </summary>
          <div className="p-3 space-y-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={overrideEnabled}
                  onChange={(e) => setOverrideEnabled(e.target.checked)}
                />
                Use override below instead of saved guidelines
              </label>
              <ModeToggle value={overrideMode} onChange={setOverrideMode} />
            </div>
            {overrideMode === 'markdown' ? (
              <div data-color-mode="light">
                <MDEditor
                  value={overrideText}
                  onChange={(v) => setOverrideText(v ?? '')}
                  height={180}
                  preview="edit"
                />
              </div>
            ) : (
              <textarea
                value={overrideText}
                onChange={(e) => setOverrideText(e.target.value)}
                rows={5}
                placeholder="Use the candidate's voice, keep answers under 150 words, lead with concrete examples..."
                className="input focus-ring w-full text-sm"
              />
            )}
          </div>
        </details>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={generating || !accountId || !!selectedNeedsSetup}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </form>

      {pairs && pairs.length > 0 && <ScreeningResults pairs={pairs} />}

      {accountId && (
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resume history</h2>
          {!historyData ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : historyData.applications.length === 0 ? (
            <p className="text-sm text-gray-500">No resumes generated for this profile yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {historyData.applications.map((app) => (
                <li key={app._id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{app.companyName}</p>
                    <p className="text-xs text-gray-500">{new Date(app.createdAt).toLocaleString()}</p>
                  </div>
                  {app.s3Url ? (
                    <a
                      href={app.s3Url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:text-primary-dark font-medium"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">no archive</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function QuestionRow({
  index,
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow on content change.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-400 mt-2.5 w-5 text-right">{index + 1}.</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
        placeholder={`Question ${index + 1}`}
        className="input focus-ring flex-1 text-sm resize-none overflow-hidden min-h-[40px]"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 mt-1"
        title="Remove question"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function ScreeningResults({ pairs }: { pairs: ScreeningPair[] }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Screening answers</h2>
      <ol className="space-y-4">
        {pairs.map((p, i) => (
          <li key={i} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                <span className="text-gray-400 mr-2">{i + 1}.</span>
                {p.question}
              </p>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(p.answer).then(() => notify.success('Answer copied'))
                }
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary flex-shrink-0"
                title="Copy answer"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{p.answer}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ModeToggle({ value, onChange }: { value: GuidelinesMode; onChange: (v: GuidelinesMode) => void }) {
  return (
    <div className="inline-flex border border-gray-200 rounded-md overflow-hidden text-xs">
      {(['plaintext', 'markdown'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-2 py-1 ${value === m ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          {m === 'plaintext' ? 'Plain text' : 'Markdown'}
        </button>
      ))}
    </div>
  );
}
