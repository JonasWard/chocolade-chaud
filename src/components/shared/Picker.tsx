import React from 'react';
import { createPortal } from 'react-dom';
import { useMode } from './Mode';

// a list to pick from, in sections with lines between them: a popover under its button, on a phone a sheet from the bottom

export interface IPickerItem<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** a muted note after the label */
  hint?: string;
  style?: React.CSSProperties;
}

export interface IPickerSection<T> {
  title?: string;
  items: IPickerItem<T>[];
}

const MIN_SPACE = 280;
// see max-width of .picker in ui.css
const MAX_WIDTH = 320;

export function Picker<T>({
  label,
  trigger,
  className,
  sections,
  value,
  onPick,
  search,
}: {
  label: string;
  /** what the button shows */
  trigger: React.ReactNode;
  className?: string;
  sections: IPickerSection<T>[];
  /** the current value, marked in the list */
  value?: T;
  onPick: (value: T) => void;
  /** with a search field: the sections for what is typed */
  search?: (query: string) => IPickerSection<T>[];
}) {
  const sheet = useMode().mobile;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [place, setPlace] = React.useState<React.CSSProperties>({});
  const button = React.useRef<HTMLButtonElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  const shown = (search && query ? search(query) : sections).filter((s) => s.items.length);
  const items = shown.flatMap((s) => s.items);

  const close = (refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) button.current?.focus();
  };
  const pick = (item: IPickerItem<T>) => {
    close();
    onPick(item.value);
  };

  const toggle = (e: React.MouseEvent) => {
    // in a card or a column, the picker is not a tap on it
    e.stopPropagation();
    if (open) return close();
    const rect = button.current!.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const up = below < MIN_SPACE && rect.top > below;
    // along the left of the button, or its right when there is no room for it
    const side = rect.left + MAX_WIDTH > window.innerWidth ? { right: window.innerWidth - rect.right } : { left: rect.left };
    setPlace(up ? { ...side, bottom: window.innerHeight - rect.top + 4, maxHeight: rect.top - 16 } : { ...side, top: rect.bottom + 4, maxHeight: below - 16 });
    setActive(Math.max(0, sections.flatMap((s) => s.items).findIndex((i) => i.value === value)));
    setOpen(true);
  };

  // outside a tap closes it, so do scrolling (it would leave the list behind) and resizing
  React.useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !list.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node) && close(false);
    const away = (e: Event) => !list.current?.contains(e.target as Node) && close(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    list.current?.querySelector<HTMLElement>('input, [role=listbox]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [open]);

  React.useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % Math.max(items.length, 1));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      pick(items[active]);
    }
  };

  let index = 0;
  const popover = (
    <>
      {sheet && <div className='picker-backdrop' onPointerDown={() => close(false)} />}
      <div ref={list} className={sheet ? 'picker sheet' : 'picker'} style={sheet ? undefined : place} onKeyDown={onKey} onClick={(e) => e.stopPropagation()}>
        {search && (
          <input
            type='search'
            aria-label={`search ${label}`}
            aria-controls={id}
            placeholder='Search…'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
        )}
        <div id={id} role='listbox' aria-label={label} tabIndex={-1}>
          {shown.map((section, s) => (
            <div key={s} className='picker-section' role='group' aria-label={section.title}>
              {section.title && <div className='picker-title'>{section.title}</div>}
              {section.items.map((item) => {
                const i = index++;
                const current = item.value === value;
                return (
                  <button
                    key={i}
                    type='button'
                    role='option'
                    aria-selected={current}
                    data-index={i}
                    className={['picker-item', i === active && 'active', current && 'current'].filter(Boolean).join(' ')}
                    style={item.style}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(item)}
                  >
                    {item.icon}
                    <span className='picker-label'>{item.label}</span>
                    {item.hint && <span className='meta'>{item.hint}</span>}
                    {current && <span className='picker-check'>✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {!items.length && <div className='picker-title'>Nothing found</div>}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button ref={button} type='button' className={className ?? 'picker-trigger'} aria-label={label} aria-haspopup='listbox' aria-expanded={open} onClick={toggle}>
        {trigger}
      </button>
      {open && createPortal(popover, document.body)}
    </>
  );
}
