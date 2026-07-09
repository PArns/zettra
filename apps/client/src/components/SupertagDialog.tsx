import { useEffect, useState } from 'react';
import { api, type EffectiveField, type Tag } from '../lib/api';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import {
  formatOptions,
  needsOptions,
  needsRelationTarget,
  optionsOf,
  parseOptions,
  supportsDefault,
} from '../lib/field-config';
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

/** A field definition being edited, before it is persisted as a `tag_field`. */
interface FieldDraft {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

const emptyDraft = (): FieldDraft => ({ name: '', type: 'text', config: {} });

function toDraft(f: EffectiveField): FieldDraft {
  return { name: f.name, type: f.type, config: { ...f.config } };
}

/**
 * Create or edit a supertag (§8.1): identity (name, icon, color, folder), inheritance
 * (`extends` — inherit another supertag's fields, invariant walked by resolveEffectiveFields),
 * and its own field schema. Each field carries a type plus per-type config (select options,
 * relation target, default value). Field changes hit the schema-evolution endpoints, which
 * enqueue backfill server-side; inherited fields are shown read-only (edit them on their owner).
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
  const [extendsId, setExtendsId] = useState<string | null>(tag?.extendsId ?? null);
  const [busy, setBusy] = useState(false);

  // Own fields: persisted rows in edit mode, local drafts in create mode (created together).
  const [ownFields, setOwnFields] = useState<EffectiveField[]>([]);
  const [draftFields, setDraftFields] = useState<FieldDraft[]>([]);
  const [inherited, setInherited] = useState<EffectiveField[]>([]);
  const [newField, setNewField] = useState<FieldDraft>(emptyDraft());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FieldDraft>(emptyDraft());

  // Other supertags eligible as an `extends` target (never itself).
  const extendOptions = tags.filter((x) => x.id !== tag?.id);

  const refreshFields = async () => {
    if (!tag) return;
    const eff = await api.tagFields(tag.id).catch(() => []);
    setOwnFields(eff.filter((f) => f.tagId === tag.id).sort((a, b) => a.position - b.position));
    setInherited(eff.filter((f) => f.tagId !== tag.id));
  };

  useEffect(() => {
    void refreshFields();
  }, [tag]);

  // In create mode there is no persisted tag yet, so preview inherited fields from the chosen
  // parent directly; in edit mode the resolved set already includes them.
  useEffect(() => {
    if (editing) return;
    if (!extendsId) {
      setInherited([]);
      return;
    }
    let live = true;
    api
      .tagFields(extendsId)
      .then((eff) => live && setInherited(eff))
      .catch(() => live && setInherited([]));
    return () => {
      live = false;
    };
  }, [editing, extendsId]);

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
      if (editing) {
        await api.updateTag(tag.id, { name, icon, color, extendsId });
      } else {
        await api.createTag({
          name,
          icon,
          color,
          parentId,
          extendsId,
          fields: draftFields.map((f, position) => ({
            name: f.name,
            type: f.type,
            config: f.config,
            position,
          })),
        });
      }
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
    const draft = normalizeDraft(newField);
    if (!draft.name.trim()) return;
    if (editing) {
      try {
        await api.addField(tag.id, { ...draft, position: ownFields.length });
        await refreshFields();
      } catch (err) {
        toast.error((err as Error).message);
        return;
      }
    } else {
      setDraftFields((prev) => [...prev, draft]);
    }
    setNewField(emptyDraft());
  }

  async function saveEdit(key: string, fieldId?: string) {
    const draft = normalizeDraft(editDraft);
    if (!draft.name.trim()) return;
    if (fieldId) {
      try {
        await api.updateField(fieldId, draft);
        await refreshFields();
      } catch (err) {
        toast.error((err as Error).message);
        return;
      }
    } else {
      const index = Number(key);
      setDraftFields((prev) => prev.map((f, i) => (i === index ? draft : f)));
    }
    setEditingKey(null);
  }

  async function removeOwn(key: string, fieldId?: string) {
    if (fieldId) {
      await api.removeField(fieldId).catch((err) => toast.error((err as Error).message));
      await refreshFields();
    } else {
      setDraftFields((prev) => prev.filter((_, i) => i !== Number(key)));
    }
  }

  /** Swap a field with its neighbour, persisting both positions in edit mode. */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (editing) {
      if (target < 0 || target >= ownFields.length) return;
      const a = ownFields[index];
      const b = ownFields[target];
      try {
        await Promise.all([
          api.updateField(a.id, { position: b.position }),
          api.updateField(b.id, { position: a.position }),
        ]);
        await refreshFields();
      } catch (err) {
        toast.error((err as Error).message);
      }
    } else {
      setDraftFields((prev) => {
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    }
  }

  const ownList: { key: string; fieldId?: string; draft: FieldDraft }[] = editing
    ? ownFields.map((f) => ({ key: f.id, fieldId: f.id, draft: toDraft(f) }))
    : draftFields.map((d, i) => ({ key: String(i), draft: d }));

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

          <Field
            label={t('supertag.extends')}
            htmlFor="st-extends"
            hint={t('supertag.extendsHint')}
          >
            {(id) => (
              <select
                id={id}
                value={extendsId ?? ''}
                onChange={(e) => setExtendsId(e.target.value || null)}
              >
                <option value="">{t('supertag.none')}</option>
                {extendOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {(x.icon ?? '#') + ' ' + x.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

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

          <div>
            <div className="settings-label">{t('supertag.fields')}</div>
            <div className="field-list">
              {ownList.map((row, index) => (
                <div key={row.key} className="field-item">
                  {editingKey === row.key ? (
                    <div className="field-editor">
                      <FieldDefEditor
                        draft={editDraft}
                        onChange={setEditDraft}
                        tags={extendOptions}
                        idPrefix={`edit-${row.key}`}
                      />
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                        <Button variant="ghost" size="sm" onClick={() => setEditingKey(null)}>
                          {t('common.cancel')}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => saveEdit(row.key, row.fieldId)}
                        >
                          {t('common.done')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="field-row">
                      <span className="field-name">{row.draft.name}</span>
                      <span className="field-type">
                        {t(`fieldType.${row.draft.type}` as StringKey)}
                      </span>
                      <div className="field-actions">
                        <button
                          className="icon-sm"
                          aria-label={t('supertag.moveUp')}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="icon-sm"
                          aria-label={t('supertag.moveDown')}
                          disabled={index === ownList.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          className="icon-sm"
                          aria-label={t('common.edit')}
                          onClick={() => {
                            setEditDraft(row.draft);
                            setEditingKey(row.key);
                          }}
                        >
                          ✎
                        </button>
                        <button className="ghost" onClick={() => removeOwn(row.key, row.fieldId)}>
                          {t('common.remove')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {ownList.length === 0 && <div className="field-empty">{t('supertag.noFields')}</div>}
            </div>

            <div className="field-editor field-add-editor">
              <FieldDefEditor
                draft={newField}
                onChange={setNewField}
                tags={extendOptions}
                idPrefix="new-field"
              />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={addField}>
                  + {t('supertag.addField')}
                </Button>
              </div>
            </div>
          </div>

          {inherited.length > 0 && (
            <div>
              <div className="settings-label">{t('supertag.inheritedFields')}</div>
              <div className="field-list">
                {inherited.map((f) => (
                  <div key={f.id} className="field-row is-inherited">
                    <span className="field-name">{f.name}</span>
                    <span className="field-type">{t(`fieldType.${f.type}` as StringKey)}</span>
                    <span className="field-badge">{t('supertag.inheritedBadge')}</span>
                  </div>
                ))}
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

/** Drop empty per-type config keys so a text field never carries stale options, etc. */
function normalizeDraft(draft: FieldDraft): FieldDraft {
  const config: Record<string, unknown> = { ...draft.config };
  if (!needsOptions(draft.type)) delete config.options;
  if (!needsRelationTarget(draft.type)) delete config.targetTagId;
  if (!supportsDefault(draft.type) && draft.type !== 'select') delete config.default;
  return { name: draft.name.trim(), type: draft.type, config };
}

/** The per-field definition editor: name, type, and the type-specific config inputs. */
function FieldDefEditor({
  draft,
  onChange,
  tags,
  idPrefix,
}: {
  draft: FieldDraft;
  onChange: (d: FieldDraft) => void;
  tags: Tag[];
  idPrefix: string;
}) {
  const t = useT();
  const setConfig = (patch: Record<string, unknown>) =>
    onChange({ ...draft, config: { ...draft.config, ...patch } });

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="field-add">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder={t('supertag.fieldName')}
          aria-label={t('supertag.fieldName')}
        />
        <select
          value={draft.type}
          aria-label={t('supertag.fields')}
          onChange={(e) => onChange({ ...draft, type: e.target.value, config: {} })}
        >
          {FIELD_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`fieldType.${value}` as StringKey)}
            </option>
          ))}
        </select>
      </div>

      {needsOptions(draft.type) && (
        <Field label={t('supertag.options')} htmlFor={`${idPrefix}-options`}>
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={formatOptions(draft.config.options)}
              placeholder={t('supertag.optionsPlaceholder')}
              onChange={(e) => setConfig({ options: parseOptions(e.target.value) })}
            />
          )}
        </Field>
      )}

      {needsRelationTarget(draft.type) && (
        <Field label={t('supertag.relationTarget')} htmlFor={`${idPrefix}-rel`}>
          {(id) => (
            <select
              id={id}
              value={(draft.config.targetTagId as string | undefined) ?? ''}
              onChange={(e) => setConfig({ targetTagId: e.target.value || undefined })}
            >
              <option value="">{t('supertag.none')}</option>
              {tags.map((x) => (
                <option key={x.id} value={x.id}>
                  {(x.icon ?? '#') + ' ' + x.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {supportsDefault(draft.type) && (
        <Field label={t('supertag.default')} htmlFor={`${idPrefix}-default`}>
          {(id) => (
            <Input
              id={id}
              type={draft.type === 'number' ? 'number' : draft.type === 'date' ? 'date' : 'text'}
              value={draft.config.default != null ? String(draft.config.default) : ''}
              onChange={(e) => setConfig({ default: e.target.value || undefined })}
            />
          )}
        </Field>
      )}

      {draft.type === 'select' && (
        <Field label={t('supertag.default')} htmlFor={`${idPrefix}-default-select`}>
          {(id) => (
            <select
              id={id}
              value={draft.config.default != null ? String(draft.config.default) : ''}
              onChange={(e) => setConfig({ default: e.target.value || undefined })}
            >
              <option value="">{t('supertag.none')}</option>
              {optionsOf(draft.config).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
    </div>
  );
}
