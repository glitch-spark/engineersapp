import { useEffect, useState } from 'react';
import type { Align, FontWeight, Typography } from '../lib/resumeStyles';

/** System-safe + commonly-bundled fonts. Most should render in Chromium
 *  (used by both the preview iframe and Playwright PDF) without needing
 *  external font loading. Web fonts (Roboto/Inter/etc.) work in the browser
 *  preview but may fall back to a default in the rendered PDF since the
 *  Playwright-controlled Chromium doesn't have them installed. */
const FONT_FAMILIES = [
  // Sans-serif system
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Helvetica',
  'Helvetica Neue',
  'Tahoma',
  'Verdana',
  'Trebuchet MS',
  'Geneva',
  'Calibri',
  'Segoe UI',
  'Lucida Sans Unicode',
  'Lucida Grande',
  // Serif system
  'Times New Roman',
  'Times',
  'Georgia',
  'Garamond',
  'Palatino',
  'Palatino Linotype',
  'Book Antiqua',
  'Cambria',
  'Constantia',
  'Didot',
  'Baskerville',
  // Monospace
  'Courier New',
  'Courier',
  'Lucida Console',
  'Consolas',
  'Monaco',
  'Menlo',
  // Display / decorative
  'Impact',
  'Comic Sans MS',
  'Brush Script MT',
  'Copperplate',
  // Web fonts (browser-only — may fall back in PDF)
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Inter',
  'Source Sans Pro',
  'Source Serif Pro',
  'Merriweather',
  'PT Sans',
  'PT Serif',
  'Nunito',
  'Raleway',
  'Poppins',
  'Work Sans',
  // Generic fallbacks
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
];
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Extras = {
  align?: Align;
};

export type TypographyRowValue = Typography & Extras;

export default function TypographyRow({
  label,
  value,
  onChange,
  showAlign = true,
}: {
  label: string;
  value: TypographyRowValue;
  onChange: (v: TypographyRowValue) => void;
  showAlign?: boolean;
}) {
  const set = <K extends keyof TypographyRowValue>(k: K, v: TypographyRowValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="grid grid-cols-12 gap-2 items-center text-sm">
      <label className="col-span-2 text-gray-700">{label}</label>

      <select
        value={value.fontFamily}
        onChange={(e) => set('fontFamily', e.target.value)}
        className="col-span-3 border border-gray-200 rounded-md px-2 py-1 text-sm"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <input
        type="number"
        min={6}
        max={48}
        value={value.fontSize}
        onChange={(e) => set('fontSize', Number(e.target.value))}
        className="col-span-2 border border-gray-200 rounded-md px-2 py-1 text-sm"
        title="Font size (pt)"
      />

      <button
        type="button"
        onClick={() => set('fontWeight', (value.fontWeight === 'bold' ? 'normal' : 'bold') as FontWeight)}
        className={`col-span-1 border rounded-md px-2 py-1 text-sm font-bold ${
          value.fontWeight === 'bold' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-500'
        }`}
        title="Bold"
      >
        B
      </button>

      {showAlign ? (
        <select
          value={value.align ?? 'left'}
          onChange={(e) => set('align', e.target.value as Align)}
          className="col-span-1 border border-gray-200 rounded-md px-1 py-1 text-xs"
          title="Alignment"
        >
          <option value="left">L</option>
          <option value="center">C</option>
          <option value="right">R</option>
          <option value="justify">J</option>
        </select>
      ) : (
        <div className="col-span-1" />
      )}

      <div className="col-span-3 flex gap-1 items-center">
        <input
          type="color"
          value={normalizeHex(value.color)}
          onChange={(e) => set('color', e.target.value)}
          className="h-8 w-8 rounded-md border border-gray-200 flex-shrink-0 cursor-pointer"
          title="Color picker"
        />
        <HexInput value={value.color} onCommit={(v) => set('color', v)} />
      </div>
    </div>
  );
}

function HexInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleBlur = () => {
    if (HEX_RE.test(draft)) {
      const clean = draft.startsWith('#') ? draft : '#' + draft;
      onCommit(expandShortHex(clean));
    } else {
      setDraft(value); // silent revert on invalid
    }
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="#000000"
      className="flex-1 min-w-0 border border-gray-200 rounded-md px-2 py-1 text-xs font-mono"
      title="Hex code"
    />
  );
}

function normalizeHex(c: string): string {
  if (!c) return '#000000';
  return HEX_RE.test(c) ? expandShortHex(c.startsWith('#') ? c : '#' + c) : '#000000';
}

function expandShortHex(c: string): string {
  if (c.length === 4) {
    return '#' + c.slice(1).split('').map((ch) => ch + ch).join('');
  }
  return c;
}
