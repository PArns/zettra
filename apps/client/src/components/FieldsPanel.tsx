import { useEffect, useState } from 'react';
import { api, type EffectiveField } from '../lib/api';
import { useT } from '../i18n';
import { useToast } from './Toast';

/**
 * Editable structured fields for the open block (§8.1, §11). Edits write to `field_value` via
 * the API and thus reflect in table/board views — the app-level field↔views sync. (Inline
 * field nodes inside the prose editor remain a further seam.)
 */
export function FieldsPanel({ blockId }: { blockId: string }) {
  const [fields, setFields] = useState<EffectiveField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [visibility, setVisibility] = useState<'space' | 'private'>('space');
  const toast = useToast();
  const t = useT();

  useEffect(() => {
    let live = true;
    (async () => {
      const block = await api.block(blockId).catch(() => null);
      if (!block || !live) return;
      setVisibility(block.visibility === 'private' ? 'private' : 'space');
      const perTag = await Promise.all(block.tagIds.map((t) => api.tagFields(t).catch(() => [])));
      const all = dedupe(perTag.flat());
      const vals = await api.fieldValues(blockId).catch(() => []);
      if (!live) return;
      setFields(all);
      setValues(Object.fromEntries(vals.map((v) => [v.fieldId, firstNonNull(v)])));
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
          />
        </div>
      ))}
    </>
  );
}

function FieldInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: EffectiveField;
  value: unknown;
  onChange: (v: unknown) => void;
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
        <input
          id={id}
          type="date"
          defaultValue={value ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
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

function dedupe(fields: EffectiveField[]): EffectiveField[] {
  const byId = new Map(fields.map((f) => [f.id, f]));
  return [...byId.values()];
}

function firstNonNull(v: {
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
