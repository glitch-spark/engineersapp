import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Pencil, Trash2, Eye, Filter, Plus, LayoutGrid, Table as TableIcon, ArrowUpDown } from 'lucide-react';
import Modal from '../components/Modal';
import Select from '../components/Select';
import { useAuth } from '../auth/useAuth';
import * as api from '../api/endpoints';
import { notify } from '../lib/notify';

const editorStyles = `
  .ql-editor { min-height: 140px; font-size: 14px; line-height: 1.5; }
  .prose h1, .prose h2, .prose h3 { font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
  .prose h1 { font-size: 1.4em; } .prose h2 { font-size: 1.2em; } .prose h3 { font-size: 1.1em; }
  .prose p { margin-bottom: 0.75em; line-height: 1.6; }
  .prose ul, .prose ol { margin-bottom: 0.75em; padding-left: 1.5em; }
  .prose strong { font-weight: 600; } .prose em { font-style: italic; } .prose u { text-decoration: underline; }
  .prose a { color: #2563eb; text-decoration: underline; }

  /* Read-modal prose blocks: word-wrap, scroll vertically only, min 2 / max 5 lines.
     line-height 1.5 * font-size 14px = 21px per line; padding adds ~16px each side. */
  .prose-readonly {
    font-size: 14px;
    line-height: 1.5;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    min-height: calc(2 * 1.5em + 1rem);   /* 2 lines + padding */
    max-height: calc(5 * 1.5em + 1rem);   /* 5 lines + padding */
    overflow-y: auto;
    overflow-x: hidden;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
  }
  .prose-readonly p { margin: 0 0 0.5em 0; }
  .prose-readonly p:last-child { margin-bottom: 0; }
  .prose-readonly h1, .prose-readonly h2, .prose-readonly h3 { font-weight: 600; margin: 0.5em 0 0.25em; }
  .prose-readonly h1 { font-size: 1.25em; } .prose-readonly h2 { font-size: 1.15em; } .prose-readonly h3 { font-size: 1.05em; }
  .prose-readonly ul, .prose-readonly ol { margin: 0 0 0.5em 0; padding-left: 1.25em; }
  .prose-readonly a { color: #2563eb; text-decoration: underline; }
  .prose-readonly img { max-width: 100%; height: auto; }
  .prose-readonly pre, .prose-readonly code { white-space: pre-wrap; word-break: break-all; }
`;

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const STAGES = [
  { value: 'intro', label: 'Intro' },
  { value: 'tech1', label: 'Tech 1' },
  { value: 'tech2', label: 'Tech 2' },
  { value: 'panel', label: 'Panel' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'final', label: 'Final' },
  { value: 'offer', label: 'Offer' },
  { value: 'others', label: 'Others' },
];

type AccountRef = { _id: string; name?: string; email?: string };
type CreatorRef = { _id: string; name?: string; email?: string };

type Interview = {
  _id: string;
  accountId: AccountRef | string;
  resumeId?: string | null;
  resumeFilename?: string | null;
  createdBy: CreatorRef | string;
  scheduledAt: string;
  endsAt?: string | null;
  stage: string;
  jobDescription?: string;
  transcript?: string;
  note?: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ModalMode = 'create' | 'read' | 'update' | 'delete' | null;

const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…');
    out.push(sorted[i]);
  }
  return out;
}

function combineDateTime(date: string, time: string): string {
  // local-time interpretation, then convert to UTC ISO string
  const t = time && time.length >= 5 ? time : '00:00';
  return new Date(`${date}T${t}:00`).toISOString();
}

function splitDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

function formatScheduled(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatTimeRange(startIso: string, endIso?: string | null): string {
  if (!startIso) return '—';
  const start = new Date(startIso);
  if (isNaN(start.getTime())) return '—';
  const startStr = start.toLocaleString();
  if (!endIso) return startStr;
  const end = new Date(endIso);
  if (isNaN(end.getTime())) return startStr;
  const sameDay = start.toDateString() === end.toDateString();
  const endStr = sameDay
    ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : end.toLocaleString();
  return `${startStr} – ${endStr}`;
}

const stageBadgeClass = (stage: string) => {
  switch (stage) {
    case 'intro': return 'bg-gray-100 text-gray-700';
    case 'tech1':
    case 'tech2': return 'bg-blue-100 text-blue-800';
    case 'hiring_manager': return 'bg-purple-100 text-purple-800';
    case 'final': return 'bg-amber-100 text-amber-800';
    case 'offer': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export default function InterviewsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const meId = user?.id ?? '';

  // Filters: creator defaults to "me" on first render; cleared via the dropdown.
  const [creatorId, setCreatorId] = useState<string>(meId);
  useEffect(() => {
    // If user object loads after first render, hydrate the default.
    if (creatorId === '' && meId) setCreatorId(meId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const [accountId, setAccountId] = useState('');
  const [stage, setStage] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');

  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, mutate, isLoading } = useSWR(
    ['interviews', creatorId, accountId, stage, from, to, sort, currentPage, pageSize] as const,
    () => api.listInterviews({
      page: currentPage,
      limit: pageSize,
      sort,
      ...(creatorId ? { creatorId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(stage ? { stage } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    })
  );

  const { data: accountsLookup } = useSWR(['accounts-lookup'], () => api.lookupAccounts());
  const accounts = accountsLookup?.accounts ?? [];

  // Owner-scoped accounts for the create/update form. Backend returns the user's own
  // accounts for staff and ALL accounts for admin.
  const { data: ownAccountsData } = useSWR(['accounts-own'], () => api.listAccounts({ limit: 1000 }));
  const ownAccounts = (ownAccountsData?.accounts as Array<{
    _id: string;
    name?: string;
    email?: string;
    resumes?: Array<{ id: string; filename: string }>;
  }>) || [];

  const { data: usersData } = useSWR(['users-lookup'], () => api.lookupUsers());
  const users = (usersData?.users as Array<{ _id: string; name?: string | null; email?: string | null }>) || [];

  const interviews = (data?.interviews as Interview[]) || [];
  const pagination = data?.pagination;

  // Modal state
  const [mode, setMode] = useState<ModalMode>(null);
  const [active, setActive] = useState<Interview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const blankForm = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const endHour = String((now.getHours() + 1) % 24).padStart(2, '0');
    return {
      accountId: '',
      resumeId: '',
      date: `${yyyy}-${mm}-${dd}`,
      startTime: `${hh}:${mi}`,
      endTime: `${endHour}:${mi}`,
      stage: '',
      jobDescription: '',
      transcript: '',
      note: '',
    };
  };

  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    if (mode === 'create') {
      setForm(blankForm());
      setError('');
    } else if ((mode === 'update' || mode === 'read') && active) {
      const start = splitDateTime(active.scheduledAt);
      const end = splitDateTime(active.endsAt || '');
      const accId = typeof active.accountId === 'string' ? active.accountId : active.accountId?._id ?? '';
      setForm({
        accountId: accId,
        resumeId: active.resumeId || '',
        date: start.date,
        startTime: start.time,
        endTime: end.time || start.time,
        stage: active.stage,
        jobDescription: active.jobDescription || '',
        transcript: active.transcript || '',
        note: active.note || '',
      });
      setError('');
    }
  }, [mode, active]);

  const closeModal = () => {
    setMode(null);
    setActive(null);
    setError('');
  };

  const openCreate = () => { setActive(null); setMode('create'); };
  const openRead = (iv: Interview) => { setActive(iv); setMode('read'); };
  const openUpdate = (iv: Interview) => { setActive(iv); setMode('update'); };
  const openDelete = (iv: Interview) => { setActive(iv); setMode('delete'); };

  const save = async () => {
    if (mode === 'create' && !form.accountId) {
      notify.error('Select a profile (account)');
      return;
    }
    if (!form.resumeId) {
      notify.error('Select a resume');
      return;
    }
    if (!form.date) {
      notify.error('Select a date');
      return;
    }
    if (!form.startTime || !form.endTime) {
      notify.error('Select start and end time');
      return;
    }
    if (form.endTime <= form.startTime) {
      notify.error('End time must be after start time');
      return;
    }
    if (!form.stage) {
      notify.error('Select an interview stage');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        accountId: form.accountId,
        resumeId: form.resumeId,
        scheduledAt: combineDateTime(form.date, form.startTime),
        endsAt: combineDateTime(form.date, form.endTime),
        stage: form.stage,
        jobDescription: form.jobDescription,
        transcript: form.transcript,
        note: form.note,
      };
      const account = ownAccounts.find((a) => a._id === form.accountId);
      const accountLabel = account?.name || account?.email || 'account';
      if (mode === 'update' && active) {
        await api.updateInterview(active._id, body);
        notify.success(`${stageLabel(form.stage)} interview for ${accountLabel} updated successfully`);
      } else {
        await api.createInterview(body);
        notify.success(`${stageLabel(form.stage)} interview for ${accountLabel} created successfully`);
      }
      closeModal();
      mutate();
    } catch (err) {
      notify.error(err, 'Failed to save interview');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await api.deleteInterview(active._id);
      notify.success('Interview deleted');
      closeModal();
      mutate();
    } catch (err) {
      notify.error(err, 'Failed to delete interview');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = (iv: Interview): boolean => {
    if (isAdmin) return true;
    const createdById = typeof iv.createdBy === 'string' ? iv.createdBy : iv.createdBy?._id;
    return createdById === meId;
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const accountOptions = useMemo(() => [
    { value: '', label: 'All accounts' },
    ...accounts.map((a) => ({ value: a._id, label: a.name ? `${a.name} (${a.email})` : a.email || a._id })),
  ], [accounts]);

  // Form-only account list — owner-scoped (admin sees all, staff sees own).
  const accountSelectOptions = useMemo(() =>
    ownAccounts.map((a) => ({ value: a._id, label: a.name ? `${a.name} (${a.email})` : a.email || a._id })),
  [ownAccounts]);

  const creatorOptions = useMemo(() => [
    { value: '', label: 'All creators' },
    ...users.map((u) => ({ value: u._id, label: u.name || u.email || u._id })),
  ], [users]);

  const stageOptions = useMemo(() => [
    { value: '', label: 'All stages' },
    ...STAGES,
  ], []);

  const renderRow = (iv: Interview) => {
    const creator = typeof iv.createdBy === 'object' ? iv.createdBy : null;
    const account = typeof iv.accountId === 'object' ? iv.accountId : null;
    const editable = canEdit(iv);
    return (
      <tr key={iv._id} className="border-t hover:bg-gray-50">
        <td className="px-3 py-2">{iv.ownerName || creator?.name || iv.ownerEmail || creator?.email || '—'}</td>
        <td className="px-3 py-2">{formatTimeRange(iv.scheduledAt, iv.endsAt)}</td>
        <td className="px-3 py-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stageBadgeClass(iv.stage)}`}>
            {stageLabel(iv.stage)}
          </span>
        </td>
        <td className="px-3 py-2">{account?.name || account?.email || '—'}</td>
        <td className="px-3 py-2">
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn" onClick={() => openRead(iv)} title="Read"><Eye size={16} /></button>
            <button
              type="button"
              className="btn"
              onClick={() => openUpdate(iv)}
              disabled={!editable}
              title={editable ? 'Update' : 'Only the creator or an admin can update'}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => openDelete(iv)}
              disabled={!editable}
              title={editable ? 'Delete' : 'Only the creator or an admin can delete'}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (iv: Interview) => {
    const creator = typeof iv.createdBy === 'object' ? iv.createdBy : null;
    const account = typeof iv.accountId === 'object' ? iv.accountId : null;
    const editable = canEdit(iv);
    return (
      <div key={iv._id} className="card p-4 space-y-2 hover:shadow-md transition">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stageBadgeClass(iv.stage)}`}>
            {stageLabel(iv.stage)}
          </span>
          <span className="text-xs text-gray-500">{formatTimeRange(iv.scheduledAt, iv.endsAt)}</span>
        </div>
        <div className="text-sm">
          <div className="text-gray-500">Account</div>
          <div className="font-medium">{account?.name || account?.email || '—'}</div>
        </div>
        <div className="text-sm">
          <div className="text-gray-500">Creator</div>
          <div>{iv.ownerName || creator?.name || iv.ownerEmail || creator?.email || '—'}</div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn" onClick={() => openRead(iv)} title="Read"><Eye size={16} /></button>
          <button type="button" className="btn" onClick={() => openUpdate(iv)} disabled={!editable} title="Update"><Pencil size={16} /></button>
          <button type="button" className="btn" onClick={() => openDelete(iv)} disabled={!editable} title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <style>{editorStyles}</style>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Interviews</h1>
        <button type="button" className="btn" onClick={openCreate}>
          <Plus size={16} className="mr-2" /> Create
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[180px]">
          <label className="block text-xs mb-1 text-gray-600">Creator</label>
          <Select value={creatorId} onChange={setCreatorId} options={creatorOptions} />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs mb-1 text-gray-600">Account</label>
          <Select value={accountId} onChange={setAccountId} options={accountOptions} />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs mb-1 text-gray-600">Stage</label>
          <Select value={stage} onChange={setStage} options={stageOptions} />
        </div>
        <div>
          <label className="block text-xs mb-1 text-gray-600">From</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1 text-gray-600">To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => { setCurrentPage(1); mutate(); }}
          title="Apply filters"
        >
          <Filter size={16} className="mr-1" /> Apply
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setSort(sort === 'desc' ? 'asc' : 'desc')}
          title={`Sort by time: ${sort === 'desc' ? 'latest first' : 'oldest first'}`}
        >
          <ArrowUpDown size={16} className="mr-1" /> {sort === 'desc' ? 'Latest' : 'Oldest'} first
        </button>
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
          <button
            type="button"
            className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-gray-100 text-primary' : 'bg-white text-gray-600'}`}
            onClick={() => setViewMode('table')}
            title="Table view"
          >
            <TableIcon size={16} />
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm border-l border-gray-200 ${viewMode === 'card' ? 'bg-gray-100 text-primary' : 'bg-white text-gray-600'}`}
            onClick={() => setViewMode('card')}
            title="Card view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Total + page-size */}
      {data && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span>Showing {pagination?.total ?? 0} interview{pagination?.total !== 1 ? 's' : ''} total</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Show:</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="select focus-ring text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}

      {/* List */}
      {viewMode === 'table' ? (
        <div className="card p-0 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-3 py-2">Creator</th>
                <th className="px-3 py-2">Date / Time</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>
              ) : interviews.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No interviews found.</td></tr>
              ) : (
                interviews.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
      ) : (
        isLoading ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : interviews.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No interviews found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {interviews.map(renderCard)}
          </div>
        )
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {pageNumbers(pagination.page, pagination.totalPages).map((n, idx) =>
                n === '…' ? (
                  <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-gray-500">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className={`px-3 py-1 border rounded text-sm ${
                      n === pagination.page
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => setCurrentPage(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create / Update / Read modal */}
      <Modal
        open={mode === 'create' || mode === 'update' || mode === 'read'}
        onClose={closeModal}
        title={
          mode === 'create' ? 'Create Interview'
          : mode === 'update' ? 'Update Interview'
          : 'Interview Details'
        }
      >
        <div className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {mode === 'read' ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Profile</div>
                  <div className="font-medium">
                    {(() => {
                      const a = accounts.find((x) => x._id === form.accountId);
                      return a ? `${a.name || a.email}` : form.accountId || '—';
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Stage</div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stageBadgeClass(form.stage)}`}>
                      {stageLabel(form.stage)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Resume</div>
                  <div className="font-medium">{active?.resumeFilename || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Date</div>
                  <div>{form.date || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Start time</div>
                  <div>{form.startTime || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">End time</div>
                  <div>{form.endTime || '—'}</div>
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Job Description</div>
                <div
                  className="prose-readonly bg-white"
                  dangerouslySetInnerHTML={{ __html: form.jobDescription || '<p class="text-gray-400 italic">—</p>' }}
                />
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Interview Transcript</div>
                <div
                  className="prose-readonly bg-white"
                  dangerouslySetInnerHTML={{ __html: form.transcript || '<p class="text-gray-400 italic">—</p>' }}
                />
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Note</div>
                <div
                  className="prose-readonly bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: form.note || '<p class="text-gray-400 italic">—</p>' }}
                />
              </div>
              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button type="button" className="btn" onClick={closeModal}>Close</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Profile <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.accountId}
                  onChange={(v) => setForm({ ...form, accountId: v, resumeId: '' })}
                  options={accountSelectOptions}
                  placeholder="Select an account"
                  disabled={mode === 'update' && !!active && !canEdit(active)}
                />
              </div>

              {(() => {
                const selectedAccount = ownAccounts.find((a) => a._id === form.accountId);
                const resumeOptions = (selectedAccount?.resumes || []).map((r) => ({
                  value: r.id || '',
                  label: r.filename || '(unnamed)',
                }));
                const noAccount = !form.accountId;
                const noResumes = !!selectedAccount && resumeOptions.length === 0;
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Resume <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={form.resumeId}
                      onChange={(v) => setForm({ ...form, resumeId: v })}
                      options={resumeOptions}
                      placeholder={noAccount ? 'Select an account first' : 'Select a resume'}
                      disabled={noAccount || noResumes || (mode === 'update' && !!active && !canEdit(active))}
                    />
                    {noResumes && (
                      <p className="text-xs text-amber-600 mt-1">
                        This account has no resumes yet. Add one in the Accounts page first.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start time <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    End time <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Interview Stage <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.stage}
                  onChange={(v) => setForm({ ...form, stage: v })}
                  options={STAGES}
                  placeholder="Select a stage"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Job Description</label>
                <div className="border border-gray-300 rounded-md">
                  <ReactQuill
                    theme="snow"
                    value={form.jobDescription}
                    onChange={(value) => setForm({ ...form, jobDescription: value })}
                    modules={QUILL_MODULES}
                    placeholder="Paste a URL or write the JD…"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Interview Transcript</label>
                <div className="border border-gray-300 rounded-md">
                  <ReactQuill
                    theme="snow"
                    value={form.transcript}
                    onChange={(value) => setForm({ ...form, transcript: value })}
                    modules={QUILL_MODULES}
                    placeholder="Paste or write the transcript…"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Note</label>
                <div className="border border-gray-300 rounded-md">
                  <ReactQuill
                    theme="snow"
                    value={form.note}
                    onChange={(value) => setForm({ ...form, note: value })}
                    modules={QUILL_MODULES}
                    placeholder="Internal notes…"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button type="button" className="btn" onClick={closeModal} disabled={saving}>Cancel</button>
                <button
                  type="button"
                  className="btn"
                  onClick={save}
                  disabled={saving || !form.date || !form.startTime || !form.endTime || !form.stage || (mode === 'create' && !form.accountId)}
                >
                  {saving ? 'Saving…' : mode === 'update' ? 'Save changes' : 'Create'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={mode === 'delete'} onClose={closeModal} title="Delete Interview">
        <div className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this interview? This action cannot be undone.
          </p>
          {active && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <div><span className="text-gray-500">Stage:</span> {stageLabel(active.stage)}</div>
              <div><span className="text-gray-500">When:</span> {formatScheduled(active.scheduledAt)}</div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
            <button type="button" className="btn" onClick={closeModal} disabled={saving}>Cancel</button>
            <button
              type="button"
              className="btn"
              onClick={remove}
              disabled={saving}
              style={{ backgroundColor: '#dc2626', color: 'white' }}
            >
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
