import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Sliders } from 'lucide-react';
import * as api from '../api/endpoints';
import { notify } from '../lib/notify';

type AccShape = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  label?: string;
  education?: string;
  experience?: string;
  github?: string;
  linkedin?: string;
  website?: string;
  twitter?: string;
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  address: '',
  label: '',
  education: '',
  experience: '',
  github: '',
  linkedin: '',
  website: '',
  twitter: '',
};

export default function AccountEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const acc = (await api.getAccount(id!)) as AccShape;
        if (cancelled) return;
        setForm({
          name: acc.name || '',
          email: acc.email || '',
          phone: acc.phone || '',
          address: acc.address || '',
          label: acc.label || '',
          education: acc.education || '',
          experience: acc.experience || '',
          github: acc.github || '',
          linkedin: acc.linkedin || '',
          website: acc.website || '',
          twitter: acc.twitter || '',
        });
      } catch (err) {
        notify.error(err, 'Could not load profile');
        navigate('/accounts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, navigate]);

  async function save() {
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
      if (isNew) {
        const created = (await api.createAccount(form)) as AccShape;
        notify.success(`Profile "${form.name}" created`);
        const newId = created._id || (created as Record<string, unknown>)['_id'];
        if (typeof newId === 'string') {
          navigate(`/accounts/${newId}`, { replace: true });
        } else {
          navigate('/accounts');
        }
      } else {
        await api.updateAccount(id!, form);
        notify.success(`Profile "${form.name}" updated`);
      }
    } catch (err) {
      notify.error(err, 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/accounts" className="text-gray-500 hover:text-primary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isNew ? 'New profile' : `Edit ${form.name || 'profile'}`}
          </h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium shadow-sm hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isNew ? 'Create' : 'Save changes'}
        </button>
      </header>

      <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Basic info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name *">
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email *">
            <input
              className="input w-full"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className="input w-full"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <input
              className="input w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Contact links</h2>
        <p className="text-xs text-gray-500">
          Used by Resume Generator's contact line — toggle visibility in Resume styling.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GitHub URL">
            <input
              type="url"
              className="input w-full"
              placeholder="https://github.com/..."
              value={form.github}
              onChange={(e) => setForm({ ...form, github: e.target.value })}
            />
          </Field>
          <Field label="LinkedIn URL">
            <input
              type="url"
              className="input w-full"
              placeholder="https://linkedin.com/in/..."
              value={form.linkedin}
              onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
            />
          </Field>
          <Field label="Website URL">
            <input
              type="url"
              className="input w-full"
              placeholder="https://..."
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="Twitter / X URL">
            <input
              type="url"
              className="input w-full"
              placeholder="https://x.com/..."
              value={form.twitter}
              onChange={(e) => setForm({ ...form, twitter: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Resume content</h2>
        <p className="text-xs text-gray-500">The structured fields the LLM prompt uses.</p>
        <Field label="Variant label">
          <input
            className="input w-full"
            placeholder="e.g. AI focus, Backend variant"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </Field>
        <Field label="Education">
          <textarea
            className="input w-full"
            rows={2}
            value={form.education}
            onChange={(e) => setForm({ ...form, education: e.target.value })}
            placeholder="University name, degree, years"
          />
        </Field>
        <Field label="Experience" hint="Required to generate a resume.">
          <textarea
            className="input w-full font-mono text-sm"
            rows={5}
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
            placeholder={'Company | Role | Period (one per line)'}
          />
        </Field>
      </section>

      {!isNew && (
        <Link
          to={`/accounts/${id}/resume-settings`}
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-6 py-4 shadow-sm hover:bg-gray-50"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Sliders size={14} /> Resume styling &amp; preview
          </span>
          <span className="text-xs text-gray-500">Open editor →</span>
        </Link>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
