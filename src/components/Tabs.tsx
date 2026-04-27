import { type ReactNode, useRef } from 'react';

export type TabDef = {
  key: string;
  label: ReactNode;
  hidden?: boolean;
};

type TabsProps = {
  tabs: TabDef[];
  value: string;
  onChange: (key: string) => void;
  children: ReactNode;
  className?: string;
};

export default function Tabs({ tabs, value, onChange, children, className }: TabsProps) {
  const visible = tabs.filter((t) => !t.hidden);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusByOffset(currentKey: string, offset: number) {
    const idx = visible.findIndex((t) => t.key === currentKey);
    if (idx < 0) return;
    const next = visible[(idx + offset + visible.length) % visible.length];
    onChange(next.key);
    requestAnimationFrame(() => refs.current[next.key]?.focus());
  }

  return (
    <div className={className}>
      <div role="tablist" className="flex border-b border-gray-200 mb-6 gap-1 overflow-x-auto">
        {visible.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[t.key] = el;
              }}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusByOffset(t.key, 1);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusByOffset(t.key, -1);
                }
              }}
              className={
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ' +
                (active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300')
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  );
}
