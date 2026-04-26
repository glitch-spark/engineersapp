import useSWR from 'swr';
import { useState, useEffect, useRef } from 'react';
import Modal from '../components/Modal';
import { Pencil, Trash2, FileText, Upload, X, Eye } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import * as api from '../api/endpoints';
import { parseResume, RESUME_ACCEPT, MAX_RESUME_BYTES } from '../lib/resumeParser';
import { openResumeInNewTab } from '../lib/resumeViewer';
import { notify } from '../lib/notify';

type ResumeRow = {
  id?: string;
  filename: string;
  markdown: string;
  uploadedAt?: string;
  sizeBytes: number;
};
type Acc = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  ownerName?: string;
  resumes?: ResumeRow[];
};

const MAX_RESUMES = 20;

function resumesLabel(n: number) {
  return n === 1 ? '1 resume' : `${n} resumes`;
}

export default function AccountsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, mutate, isLoading } = useSWR(
    ['accounts', currentPage, pageSize, debouncedSearch, isAdmin ? userId : ''] as const,
    () => api.listAccounts({ page: currentPage, limit: pageSize, search: debouncedSearch, ...(isAdmin && userId ? { userId } : {}) })
  );

  const { data: usersData } = useSWR(isAdmin ? ['users-list'] : null, () => api.listUsers());
  const users = (usersData?.users as Array<{ _id: string; name?: string; email?: string }>) || [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acc | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [resumeError, setResumeError] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', address: '' });
    setResumes([]);
    setResumeError('');
    setOpen(true);
  };

  const openEdit = async (acc: Acc) => {
    // List endpoint strips resume markdown to keep payloads small; fetch the
    // full account so Edit can round-trip existing resumes intact.
    setEditing(acc);
    setForm({ name: acc.name, email: acc.email, phone: acc.phone || '', address: acc.address || '' });
    setResumes([]);
    setResumeError('');
    setOpen(true);
    try {
      const full = await api.getAccount(acc._id) as Acc;
      setResumes((full.resumes || []).map((r) => ({
        id: r.id,
        filename: r.filename,
        markdown: r.markdown,
        uploadedAt: r.uploadedAt,
        sizeBytes: new TextEncoder().encode(r.markdown).length,
      })));
    } catch (err) {
      setResumeError(err instanceof Error ? `Could not load resumes: ${err.message}` : 'Could not load resumes');
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setResumeError('');
    setParsing(true);
    const incoming = Array.from(files);
    const slotsLeft = Math.max(0, MAX_RESUMES - resumes.length);
    const accepted = incoming.slice(0, slotsLeft);
    const rejected = incoming.slice(slotsLeft);
    const errors = rejected.map((f) => `${f.name}: cap of ${MAX_RESUMES} resumes reached`);

    const results = await Promise.allSettled(accepted.map((f) => parseResume(f)));
    const next: ResumeRow[] = [...resumes];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        const { filename, markdown } = res.value;
        next.push({
          filename,
          markdown,
          sizeBytes: new TextEncoder().encode(markdown).length,
        });
      } else {
        const reason = res.reason instanceof Error ? res.reason.message : 'parse failed';
        errors.push(`${accepted[i].name}: ${reason}`);
      }
    });

    setResumes(next);
    if (errors.length) setResumeError(errors.join(' · '));
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeResume = (idx: number) => {
    setResumes(resumes.filter((_, i) => i !== idx));
  };

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) {
      notify.error('Name is required');
      return;
    }
    if (!form.email.trim()) {
      notify.error('Email is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        resumes: resumes.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          filename: r.filename,
          markdown: r.markdown,
        })),
      };
      if (editing) {
        await api.updateAccount(editing._id, body);
        notify.success(`Account "${form.name}" updated`);
      } else {
        await api.createAccount(body);
        notify.success(`Account "${form.name}" created`);
      }
      await mutate();
      setOpen(false);
    } catch (err) {
      notify.error(err, 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (acc: Acc) => {
    if (!confirm(`Delete account "${acc.name}"?`)) return;
    try {
      await api.deleteAccount(acc._id);
      notify.success(`Account "${acc.name}" deleted`);
      mutate();
    } catch (err) {
      notify.error(err, 'Failed to delete account');
    }
  };

  const viewResume = (r: ResumeRow) => {
    if (!r.markdown) {
      notify.error('Resume content not loaded yet');
      return;
    }
    try {
      openResumeInNewTab(r.filename, r.markdown);
    } catch (err) {
      notify.error(err, 'Could not open resume');
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setDebouncedSearch('');
  };

  const accounts = (data?.accounts as Acc[]) || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <button className="btn ml-auto" onClick={openAdd}>Add</button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="block text-xs mb-1 text-gray-600">User</label>
            <select
              className="select focus-ring"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Show:</label>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="select focus-ring text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {debouncedSearch && (
        <div className="text-sm text-gray-600">
          {pagination ? (
            <>
              Found {pagination.total} result{pagination.total !== 1 ? 's' : ''} for "{debouncedSearch}"
              {pagination.total > 0 && (
                <span className="ml-2">
                  (Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)})
                </span>
              )}
            </>
          ) : (
            `Searching for "${debouncedSearch}"...`
          )}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Resumes</th>
              <th className="px-3 py-2 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  {debouncedSearch ? `No accounts found matching "${debouncedSearch}"` : 'No accounts found.'}
                </td>
              </tr>
            ) : accounts.map((a) => {
              const count = a.resumes?.length ?? 0;
              return (
                <tr key={a._id} className="border-t">
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2">{a.email}</td>
                  <td className="px-3 py-2">{a.phone}</td>
                  <td className="px-3 py-2">{a.address}</td>
                  <td className="px-3 py-2">{a.ownerName || '—'}</td>
                  <td className="px-3 py-2">
                    {count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <FileText size={12} /> {resumesLabel(count)}
                      </span>
                    ) : (
                      <span className="text-gray-400">{resumesLabel(0)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="btn" onClick={() => openEdit(a)} title="Edit"><Pencil size={16} /></button>
                      <button className="btn" onClick={() => remove(a)} title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {!debouncedSearch && (
              <>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </>
            )}
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
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) pageNum = i + 1;
                else if (pagination.page <= 3) pageNum = i + 1;
                else if (pagination.page >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
                else pageNum = pagination.page - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 border rounded text-sm ${
                      pageNum === pagination.page
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Account' : 'Add Account'}>
        <div className="space-y-3">
          <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />

          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Resumes <span className="text-xs text-gray-500">({resumes.length} / {MAX_RESUMES})</span>
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing || resumes.length >= MAX_RESUMES}
              >
                <Upload size={14} className="mr-1" />
                {parsing ? 'Parsing…' : 'Add resume'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={RESUME_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {resumeError && (
              <p className="text-xs text-red-600 mb-2 break-words">{resumeError}</p>
            )}
            <p className="text-xs text-gray-500 mb-2">
              PDF, TXT, or MD. Parsed to markdown in your browser. Max {(MAX_RESUME_BYTES / 1024).toFixed(0)} KB each.
            </p>
            {resumes.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded">
                No resumes attached
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
                {resumes.map((r, idx) => (
                  <li key={r.id || `new-${idx}`} className="flex items-center gap-2 px-2 py-2 text-sm">
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate" title={r.filename}>{r.filename}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {(r.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                    {!r.id && (
                      <span className="text-xs text-blue-600 whitespace-nowrap">new</span>
                    )}
                    <button
                      type="button"
                      onClick={() => viewResume(r)}
                      className="text-gray-400 hover:text-blue-600"
                      title="View resume in new tab"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeResume(idx)}
                      className="text-gray-400 hover:text-red-600"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button className="btn" onClick={save} disabled={parsing || saving}>
              {saving ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save changes' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
