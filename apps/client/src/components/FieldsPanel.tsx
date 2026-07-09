import { useEffect, useState } from 'react';
import { api, type EffectiveField } from '../lib/api';

/**
 * Editable structured fields for the open block (§8.1, §11). Edits write to `field_value` via
 * the API and thus reflect in table/board views — the app-level field↔views sync. (Inline
 * field nodes inside the prose editor remain a further seam.)
 */
export function FieldsPanel({ blockId }: { blockId: string }) {
  const [fields, setFields] = useState<EffectiveField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [visibility, setVisibility] = useState<'space' | 'private'>('space');

  useEffect(() => {
    let live = true;
    (async () => {
      const block = await api.block(blockId).catch(() => null);
      if (!block || !live) return;
      setVisibility((block as { visibility?: 'space' | 'private' }).visibility ?? 'space');
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
    setValues((prev) => ({ ...prev, [field.id]: value }));
    await api.setField(blockId, field.id, value).catch(() => undefined);
  }

  async function toggleVisibility() {
    const next = visibility === 'private' ? 'space' : 'private';
    setVisibility(next);
    await api.setVisibility(blockId, next).catch(() => setVisibility(visibility));
  }

  return (
    <>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Fields
        <button
          className="ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={toggleVisibility}
          title="Toggle block visibility"
        >
          {visibility === 'private' ? '🔒 Private' : '🌐 Space'}
        </button>
      </h3>
      {fields.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: 4 }}>
          Add a supertag to give this note fields.
        </p>
      )}
      {fields.map((f) => (
        <div key={f.id} className="field" style={{ marginBottom: 10 }}>
          <label>{f.name}</label>
          <FieldInput field={f} value={values[f.id]} onChange={(v) => save(f, v)} />
        </div>
      ))}
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: EffectiveField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const options = (field.config?.options as string[] | undefined) ?? [];
  switch (field.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          defaultValue={value != null ? String(value) : ''}
          onBlur={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          defaultValue={value ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'select':
      return (
        <select
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
