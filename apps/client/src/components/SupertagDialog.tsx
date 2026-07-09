import { useEffect, useState } from 'react';
import { api, type EffectiveField, type Tag } from '../lib/api';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { Button, Field, Input } from '../ui';
import { useToast } from './Toast';

const FIELD_TYPE_VALUES = [
  'text',
  'number',
  'date',
  'checkbox',
  'select',
  'multi_select',
  'relation',
  'user',
  'url',
  'file',
] as const;

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
  const t = useT();
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
        aria-label={editing ? t('supertag.editTitle') : t('supertag.newTitle')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">
            {editing ? t('supertag.editTitle') : t('supertag.newTitle')}
          </span>
          <button className="icon" aria-label={t('common.close')} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-panel stack">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="settings-label">{t('supertag.icon')}</div>
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
              <Field label={t('common.name')} htmlFor="st-name">
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('supertag.namePlaceholder')}
                  />
                )}
              </Field>
            </div>
          </div>

          <div>
            <div className="settings-label">{t('supertag.color')}</div>
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
            <Field label={t('supertag.folder')} htmlFor="st-parent">
              {(id) => (
                <select
                  id={id}
                  value={parentId ?? ''}
                  onChange={(e) => setParentId(e.target.value || null)}
                >
                  <option value="">{t('supertag.none')}</option>
                  {tags.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {editing && (
            <div>
              <div className="settings-label">{t('supertag.fields')}</div>
              <div className="field-list">
                {fields.map((f) => (
                  <div key={f.id} className="field-row">
                    <span className="field-name">{f.name}</span>
                    <span className="field-type">{t(`fieldType.${f.type}` as StringKey)}</span>
                    <button className="ghost" onClick={() => removeField(f.id)}>
                      {t('common.remove')}
                    </button>
                  </div>
                ))}
                {fields.length === 0 && <div className="field-empty">{t('supertag.noFields')}</div>}
              </div>
              <div className="field-add">
                <Input
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  placeholder={t('supertag.newFieldName')}
                  onKeyDown={(e) => e.key === 'Enter' && addField()}
                />
                <select
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                >
                  {FIELD_TYPE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t(`fieldType.${value}` as StringKey)}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={addField}>
                  {t('common.add')}
                </Button>
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={saveBasics} disabled={busy}>
              {busy ? t('common.saving') : editing ? t('common.save') : t('supertag.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
