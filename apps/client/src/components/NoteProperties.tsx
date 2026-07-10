import { useCallback, useEffect, useState } from 'react';
import { api, type EffectiveField, type EntityOption, type Member, type Tag } from '../lib/api';
import { useToast } from './Toast';
import { useT } from '../i18n';
import { ApplyTagMenu } from './ApplyTagMenu';
import { FieldInput, dedupe, firstNonNull, relationTargetId } from './FieldsPanel';

/**
 * In-page note properties (§8.1, like Notion/Tana): the note's supertags shown as pills and its
 * effective fields shown as editable rows, directly under the header. Field edits write to
 * `field_value` (so they reflect in table/board views); tags can be removed inline and added via
 * the supertag picker. Mirrors the right-rail FieldsPanel data, surfaced where the reading happens.
 */
export function NoteProperties({ blockId }: { blockId: string }) {
  const t = useT();
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [fields, setFields] = useState<EffectiveField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [entitiesByTag, setEntitiesByTag] = useState<Record<string, EntityOption[]>>({});
  const [tagsByName, setTagsByName] = useState<Map<string, string>>(new Map());
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const block = await api.block(blockId).catch(() => null);
      if (!block || !live) return;
      const allTags = await api.tags().catch(() => [] as Tag[]);
      if (!live) return;
      setTags(allTags.filter((tg) => block.tagIds.includes(tg.id)));

      const perTag = await Promise.all(block.tagIds.map((tid) => api.tagFields(tid).catch(() => [])));
      const all = dedupe(perTag.flat());
      const vals = await api.fieldValues(blockId).catch(() => []);
      if (!live) return;
      setFields(all);
      setValues(Object.fromEntries(vals.map((v) => [v.fieldId, firstNonNull(v)])));

      const nameMap = new Map(allTags.map((tg) => [tg.name, tg.id]));
      setTagsByName(nameMap);
      if (all.some((f) => f.type === 'user')) {
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
        if (live) setEntitiesByTag((prev) => ({ ...prev, [tid]: opts }));
      }
    })();
    return () => {
      live = false;
    };
  }, [blockId, nonce]);

  const save = async (field: EffectiveField, value: unknown) => {
    const previous = values[field.id];
    setValues((prev) => ({ ...prev, [field.id]: value }));
    try {
      await api.setField(blockId, field.id, value);
    } catch {
      setValues((prev) => ({ ...prev, [field.id]: previous }));
      toast.error(`Feld „${field.name}“ konnte nicht gespeichert werden`);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      await api.removeTag(tagId, blockId);
      reload();
    } catch (err) {
      toast.error(`Supertag entfernen fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  if (tags.length === 0 && fields.length === 0) {
    // Nothing applied yet — a single discreet affordance to add the first supertag.
    return (
      <div className="note-props note-props-empty">
        <ApplyTagMenu blockId={blockId} onApplied={reload} />
      </div>
    );
  }

  return (
    <div className="note-props">
      <div className="note-props-tags">
        {tags.map((tg) => (
          <span key={tg.id} className="note-tag-pill">
            <span className="note-tag-ico">{tg.icon ?? '#'}</span>
            {tg.name}
            <button
              className="note-tag-x"
              aria-label={`${t('common.remove')} ${tg.name}`}
              onClick={() => removeTag(tg.id)}
            >
              ✕
            </button>
          </span>
        ))}
        <ApplyTagMenu blockId={blockId} onApplied={reload} />
      </div>

      {fields.length > 0 && (
        <div className="note-props-fields">
          {fields.map((f) => (
            <div key={f.id} className="note-prop-row">
              <label htmlFor={`np-${f.id}`} className="note-prop-label">
                {f.name}
              </label>
              <div className="note-prop-value">
                <FieldInput
                  id={`np-${f.id}`}
                  field={f}
                  value={values[f.id]}
                  onChange={(v) => save(f, v)}
                  members={members}
                  entities={entitiesByTag[relationTargetId(f, tagsByName) ?? ''] ?? []}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
