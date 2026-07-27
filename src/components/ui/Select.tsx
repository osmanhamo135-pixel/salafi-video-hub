import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * A themed listbox replacing the native `<select>`.
 *
 * The native control's popup list is drawn by the operating system. No amount
 * of `color-scheme` or `option` styling reaches it, so in a Tauri window with
 * a custom title bar it is the loudest remaining signal that this is a web
 * page in a frame — the same class of tell as `window.confirm()`, which this
 * app already replaced.
 *
 * Built on the app's own `.rule-list` / `.rule-row` idiom rather than Radix:
 * the vocabulary already exists, and the genuinely hard parts of a listbox are
 * the keyboard model and not escaping the viewport, both of which are here.
 *
 * Keyboard model follows the WAI-ARIA listbox pattern: Enter/Space/Down opens,
 * Up/Down move, Home/End jump, typing jumps to a prefix match, Escape closes
 * and restores focus to the trigger, Tab closes without committing.
 */

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional trailing detail — a count, a duration. */
  hint?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name. Required — an unlabelled listbox is unusable by screen reader. */
  label: string;
  className?: string;
  /** Rendered before the value in the trigger, e.g. a lucide icon. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  icon,
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [drop, setDrop] = useState<'down' | 'up'>('down');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ buffer: '', at: 0 });
  const id = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /* Flip upward when there is not room below. A listbox that opens off the
     bottom of the window is worse than the native control it replaced. */
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const needed = Math.min(options.length * 34 + 12, 280);
    setDrop(window.innerHeight - rect.bottom < needed && rect.top > needed ? 'up' : 'down');
  }, [open, options.length]);

  useEffect(() => {
    if (open) setActive(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  /* Close on outside press and on scroll: an absolutely-positioned list would
     otherwise detach from its trigger when the page moves under it. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!triggerRef.current?.parentElement?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const commit = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(a + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      default:
        // Typeahead: printable keys accumulate for a second, then reset.
        if (e.key.length === 1) {
          const now = Date.now();
          const t = typeahead.current;
          t.buffer = now - t.at > 1000 ? e.key : t.buffer + e.key;
          t.at = now;
          const q = t.buffer.toLowerCase();
          const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(q));
          if (hit !== -1) setActive(hit);
        }
    }
  };

  return (
    <div className={`select ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className="select-trigger"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-start" dir="auto">
          {selected?.label ?? ''}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${id}-opt-${active}`}
          data-drop={drop}
          className="select-list rule-list glass"
          onKeyDown={onKeyDown}
          tabIndex={-1}
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => commit(i)}
              className="select-option"
            >
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${o.value === value ? 'text-accent-gold' : 'opacity-0'}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {o.label}
              </span>
              {o.hint && <span className="shrink-0 text-[11px] text-text-faint">{o.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
