import { useEffect, useRef, useState } from 'react';
import { api, type EffectiveField, type EntityOption, type Member, type Tag } from '../lib/api';
import { useT } from '../i18n';
import { clickable } from '../lib/a11y';
import { DatePicker } from './DatePicker';
import { useToast } from './Toast';

/** Resolve a relation field's target supertag id from its config (id preferred, else by name). */
export function relationTargetId(
  field: EffectiveField,
  tagsByName: Map<string, string>,
): string | undefined {
  const byId = field.config?.targetTagId;
  if (typeof byId === 'string' && byId) return byId;
  const byName = field.config?.targetTagName;
  if (typeof byName === 'string' && byName) return tagsByName.get(byName);
  return undefined;
}

/**
 * Editable structured fields for the open block (§8.1, §11). Edits write to `field_value` via
 * the API and thus reflect in table/board views — the app-level field↔views sync. (Inline
 * field nodes inside the prose editor remain a further seam.)
 */
export function FieldsPanel({ blockId }: { blockId: string }) {
  const [fields, setFields] = useState<EffectiveField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [visibility, setVisibility] = useState<'space' | 'private'>('space');
  const [members, setMembers] = useState<Member[]>([]);
  const [entitiesByTag, setEntitiesByTag] = useState<Record<string, EntityOption[]>>({});
  const [tagsByName, setTagsByName] = useState<Map<string, string>>(new Map());
  const toast = useToast();
  const t = useT();

  useEffect(() => {
    let live = true;
    (async () => {
      const block = await api.block(blockId).catch(() => null);
      if (!block || !live) return;
      setVisibility(block.visibility === 'private' ? 'private' : 'space');
      const perTag = await Promise.all(
        block.tagIds.map((tid) => api.tagFields(tid).catch(() => [])),
      );
      const all = dedupe(perTag.flat());
      const vals = await api.fieldValues(blockId).catch(() => []);
      if (!live) return;
      setFields(all);
      setValues(Object.fromEntries(vals.map((v) => [v.fieldId, firstNonNull(v)])));

      // Load option lists for relation/user fields so their pickers can render.
      const needsMembers = all.some((f) => f.type === 'user');
      const tags = all.some((f) => f.type === 'relation')
        ? await api.tags().catch(() => [] as Tag[])
        : [];
      if (!live) return;
      const nameMap = new Map(tags.map((t) => [t.name, t.id]));
      setTagsByName(nameMap);
      if (needsMembers) {
        const m = await api.members().catch(() => []);
        if (live) setMembers(m);
      }
      const targetIds = [
        ...new Set(
          all
            .filter((f) => f.type === 'relation')
            .map((f) => relationTargetId(f, nameMap))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      for (const tid of targetIds) {
        const opts = await api.tagEntities(tid).catch(() => []);
        if (!live) return;
        setEntitiesByTag((prev) => ({ ...prev, [tid]: opts }));
      }
    })();
    return () => {
      live = false;
    };
  }, [blockId]);

  async function save(field: EffectiveField, value: unknown) {
    const previous = values[field.id];
    setValues((prev) => ({ ...prev, [field.id]: value }));
    try {
      await api.setField(blockId, field.id, value);
    } catch {
      setValues((prev) => ({ ...prev, [field.id]: previous })); // revert optimistic update
      toast.error(`Could not save "${field.name}"`);
    }
  }

  async function toggleVisibility() {
    const next = visibility === 'private' ? 'space' : 'private';
    setVisibility(next);
    try {
      await api.setVisibility(blockId, next);
    } catch {
      setVisibility(visibility);
      toast.error('Could not change visibility');
    }
  }

  return (
    <>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('supertag.fields')}
        <button
          className="ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={toggleVisibility}
          title={t('rail.toggleVisibility')}
        >
          {visibility === 'private' ? `🔒 ${t('rail.private')}` : `🌐 ${t('rail.space')}`}
        </button>
      </h3>
      {fields.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: 4 }}>
          {t('rail.noFieldsHint')}
        </p>
      )}
      {fields.map((f) => (
        <div key={f.id} className="field" style={{ marginBottom: 10 }}>
          <label htmlFor={`fld-${f.id}`}>{f.name}</label>
          <FieldInput
            id={`fld-${f.id}`}
            field={f}
            value={values[f.id]}
            onChange={(v) => save(f, v)}
            members={members}
            entities={entitiesByTag[relationTargetId(f, tagsByName) ?? ''] ?? []}
          />
        </div>
      ))}
    </>
  );
}

export function FieldInput({
  id,
  field,
  value,
  onChange,
  members,
  entities,
}: {
  id: string;
  field: EffectiveField;
  value: unknown;
  onChange: (v: unknown) => void;
  members: Member[];
  entities: EntityOption[];
}) {
  const options = (field.config?.options as string[] | undefined) ?? [];
  switch (field.type) {
    case 'checkbox':
      return (
        <input
          id={id}
          type="checkbox"
          style={{ width: 'auto' }}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'number':
      return (
        <input
          id={id}
          type="number"
          defaultValue={value != null ? String(value) : ''}
          onBlur={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return (
        <DateField
          id={id}
          value={value != null ? String(value).slice(0, 10) : ''}
          onChange={onChange}
        />
      );
    case 'select':
      return (
        <select
          id={id}
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'multi_select': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div id={id} className="multi-select" role="group">
          {options.map((o) => {
            const on = selected.includes(o);
            return (
              <label key={o} className={`chip ${on ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
                />
                {o}
              </label>
            );
          })}
          {options.length === 0 && <span className="field-empty">—</span>}
        </div>
      );
    }
    case 'url':
      return (
        <input
          id={id}
          type="url"
          defaultValue={value != null ? String(value) : ''}
          placeholder="https://…"
          onBlur={(e) => onChange(e.target.value)}
        />
      );
    case 'relation':
      return (
        <RefPicker
          id={id}
          value={value != null ? String(value) : ''}
          options={entities.map((e) => ({ value: e.blockId, label: e.title }))}
          onChange={onChange}
        />
      );
    case 'user':
      return (
        <RefPicker
          id={id}
          value={value != null ? String(value) : ''}
          options={members.map((m) => ({
            value: m.id,
            label: m.displayName ?? m.email,
            sub: m.displayName ? m.email : undefined,
          }))}
          onChange={onChange}
        />
      );
    default:
      return (
        <input
          id={id}
          defaultValue={value != null ? String(value) : ''}
          onBlur={(e) => onChange(e.target.value)}
        />
      );
  }
}

interface RefOption {
  value: string;
  label: string;
  sub?: string;
}

/** A searchable single-select picker over reference options (relation entities or members). */
function RefPicker({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: RefOption[];
  onChange: (v: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(needle))
    : options;

  return (
    <div className="menu ref-picker" ref={ref}>
      <button
        id={id}
        type="button"
        className="ref-picker-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? '' : 'placeholder'}>
          {selected ? selected.label : t('field.pick')}
        </span>
        {value && (
          <span
            className="ref-picker-clear"
            role="button"
            aria-label={t('field.clear')}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onChange('');
              }
            }}
          >
            ✕
          </span>
        )}
      </button>
      {open && (
        <div className="menu-list">
          <input
            className="ref-picker-search"
            autoFocus
            value={q}
            placeholder={t('field.search')}
            onChange={(e) => setQ(e.target.value)}
          />
          {filtered.map((o) => (
            <div
              key={o.value}
              className={`m-item ${o.value === value ? 'on' : ''}`}
              {...clickable(() => {
                onChange(o.value);
                setOpen(false);
                setQ('');
              })}
            >
              <span className="ref-picker-label">{o.label}</span>
              {o.sub && <span className="ref-picker-sub">{o.sub}</span>}
            </div>
          ))}
          {filtered.length === 0 && <div className="m-item muted">{t('search.noMatches')}</div>}
        </div>
      )}
    </div>
  );
}

/** A date field: a trigger showing the chosen date that opens the reusable DatePicker popover. */
function DateField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString(document.documentElement.lang || 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : t('date.pick');

  return (
    <div className="menu date-field" ref={ref}>
      <button
        id={id}
        type="button"
        className="ref-picker-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? '' : 'placeholder'}>📅 {label}</span>
      </button>
      {open && (
        <div className="menu-list dp-pop">
          <DatePicker
            value={value}
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function dedupe(fields: EffectiveField[]): EffectiveField[] {
  const byId = new Map(fields.map((f) => [f.id, f]));
  return [...byId.values()];
}

export function firstNonNull(v: {
  valueText: string | null;
  valueNumber: string | null;
  valueDate: string | null;
  valueBool: boolean | null;
  valueJson: unknown;
}): unknown {
  if (v.valueText !== null) return v.valueText;
  if (v.valueNumber !== null) return v.valueNumber;
  if (v.valueDate !== null) return v.valueDate;
  if (v.valueBool !== null) return v.valueBool;
  return v.valueJson ?? null;
}
