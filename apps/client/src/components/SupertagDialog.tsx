import { useEffect, useState } from 'react';
import { api, type EffectiveField, type Tag } from '../lib/api';
import { Button, Field, Input } from '../ui';
import { useToast } from './Toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'relation', label: 'Relation' },
  { value: 'user', label: 'User' },
  { value: 'url', label: 'URL' },
  { value: 'file', label: 'File' },
];

const ICONS = ['🏷️', '📁', '✅', '📅', '👤', '🌐', '📌', '💡', '🚀', '📊', '🧩', '⭐'];
const COLORS = ['#0891b2', '#3b82f6', '#7c6dff', '#059669', '#e11d48', '#d97706'];

/**
 * Create or edit a supertag (§8.1): name, icon, color, folder parent, and — when editing — its
 * fields (add/rename/retype/remove). Field changes hit the schema-evolution endpoints, which
 * enqueue backfill server-side.
 */
export function SupertagDialog({
  tag,
  tags,
  onClose,
  onSaved,
}: {
  tag: Tag | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = tag != null;
  const [name, setName] = useState(tag?.name ?? '');
  const [icon, setIcon] = useState(tag?.icon ?? '🏷️');
  const [color, setColor] = useState(tag?.color ?? COLORS[0]);
  const [parentId, setParentId] = useState<string | null>(tag?.parentId ?? null);
  const [fields, setFields] = useState<EffectiveField[]>([]);
  const [newField, setNewField] = useState({ name: '', type: 'text' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tag)
      api
        .tagFields(tag.id)
        .then(setFields)
        .catch(() => undefined);
  }, [tag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveBasics() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setBusy(true);
    try {
      if (editing) await api.updateTag(tag.id, { name, icon, color });
      else await api.createTag({ name, icon, color, parentId });
      toast.success(editing ? 'Supertag updated' : 'Supertag created');
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addField() {
    if (!tag || !newField.name.trim()) return;
    try {
      await api.addField(tag.id, { name: newField.name.trim(), type: newField.type });
      setNewField({ name: '', type: 'text' });
      setFields(await api.tagFields(tag.id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeField(id: string) {
    if (!tag) return;
    await api.removeField(id).catch((err) => toast.error((err as Error).message));
    setFields(await api.tagFields(tag.id));
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit supertag' : 'New supertag'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{editing ? 'Edit supertag' : 'New supertag'}</span>
          <button className="icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-panel stack">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="settings-label">Icon</div>
              <div className="emoji-grid">
                {ICONS.map((e) => (
                  <button
                    key={e}
                    className={`emoji-swatch ${icon === e ? 'on' : ''}`}
                    onClick={() => setIcon(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Name" htmlFor="st-name">
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Project"
                  />
                )}
              </Field>
            </div>
          </div>

          <div>
            <div className="settings-label">Color</div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {!editing && (
            <Field label="Folder (optional)" htmlFor="st-parent">
              {(id) => (
                <select
                  id={id}
                  value={parentId ?? ''}
                  onChange={(e) => setParentId(e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {editing && (
            <div>
              <div className="settings-label">Fields</div>
              <div className="field-list">
                {fields.map((f) => (
                  <div key={f.id} className="field-row">
                    <span className="field-name">{f.name}</span>
                    <span className="field-type">{f.type}</span>
                    <button className="ghost" onClick={() => removeField(f.id)}>
                      Remove
                    </button>
                  </div>
                ))}
                {fields.length === 0 && <div className="field-empty">No fields yet.</div>}
              </div>
              <div className="field-add">
                <Input
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  placeholder="New field name"
                  onKeyDown={(e) => e.key === 'Enter' && addField()}
                />
                <select
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={addField}>
                  Add
                </Button>
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveBasics} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save' : 'Create supertag'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
