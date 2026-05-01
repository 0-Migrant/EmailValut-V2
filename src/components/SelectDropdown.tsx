import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  group: string;
  options: SelectOption[];
}

function isGroup(item: SelectOption | SelectOptionGroup): item is SelectOptionGroup {
  return 'group' in item;
}

function flatOptions(options: (SelectOption | SelectOptionGroup)[]): SelectOption[] {
  return options.flatMap((o) => isGroup(o) ? o.options : [o]);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | SelectOptionGroup)[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: 'sm';
  autoFocus?: boolean;
  onBlur?: () => void;
}

export default function SelectDropdown({
  value, onChange, options, placeholder = '— Select —',
  className, style, size, autoFocus, onBlur,
}: Props) {
  const [open, setOpen] = useState(!!autoFocus);
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = flatOptions(options).find((o) => o.value === value);

  function close(triggered: boolean) {
    setOpen(false);
    if (!triggered) onBlur?.();
  }

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sizeClass = size === 'sm' ? ' sd-sm' : '';
  const rootClass = `sd-root${className ? ` ${className}` : ''}`;

  function selectOption(val: string) {
    onChange(val);
    close(true);
  }

  function renderOption(opt: SelectOption) {
    const active = opt.value === value;
    return (
      <button
        key={opt.value}
        type="button"
        disabled={opt.disabled}
        className={`sd-option${active ? ' sd-option-active' : ''}${opt.disabled ? ' sd-option-disabled' : ''}`}
        onClick={() => { if (!opt.disabled) selectOption(opt.value); }}
      >
        <span className="sd-option-label">{opt.label}</span>
        {opt.detail && <span className="sd-option-detail">{opt.detail}</span>}
      </button>
    );
  }

  return (
    <div ref={ref} className={rootClass} style={style}>
      <button
        type="button"
        className={`sd-trigger inp${sizeClass}${open ? ' sd-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sd-trigger-label">
          {selectedOption
            ? selectedOption.label
            : <span className="sd-placeholder">{placeholder}</span>}
        </span>
        <svg className={`sd-chevron${open ? ' sd-chevron-up' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="sd-menu">
          {options.map((item) => {
            if (isGroup(item)) {
              return (
                <div key={item.group} className="sd-group">
                  <div className="sd-group-label">{item.group}</div>
                  {item.options.map(renderOption)}
                </div>
              );
            }
            return renderOption(item);
          })}
        </div>
      )}
    </div>
  );
}
