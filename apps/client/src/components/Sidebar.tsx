import type { FolderDto } from '@zettra/shared';
import type { Space, Tag, View } from '../lib/api';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';
import {
  IconCalendar,
  IconCheck,
  IconInbox,
  IconPlus,
  IconReview,
  IconSearch,
  IconSpace,
  IconSparkles,
  IconToday,
} from '../ui';
import { TagTree } from './TagTree';
import { FolderTree } from './FolderTree';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export type Nav =
  | { kind: 'today' }
  | { kind: 'calendar' }
  | { kind: 'todo' }
  | { kind: 'inbox' }
  | { kind: 'review' }
  | { kind: 'forReview' }
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'view'; id: string; name: string };

export function Sidebar(props: {
  tags: Tag[];
  views: View[];
  spaces: Space[];
  folders: FolderDto[];
  inboxCount: number;
  reviewCount: number;
  forReviewCount: number;
  nav: Nav;
  onNav: (n: Nav) => void;
  onReparentTag: (tagId: string, parentId: string | null) => void;
  onCreateTag: () => void;
  onEditTag: (tag: Tag) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: FolderDto) => void;
  onDeleteFolder: (folder: FolderDto) => void;
  onReparentFolder: (folderId: string, parentId: string | null) => void;
  onFileNote: (blockId: string, folderId: string | null) => void;
  onCapture: () => void;
  email: string;
  onSignOut: () => void;
  onAddWorkspace: () => void;
}) {
  const { tags, views, nav } = props;
  const t = useT();
  const isActive = (n: Nav) =>
    (n.kind === nav.kind && n.kind !== 'view') ||
    (n.kind === 'view' && nav.kind === 'view' && n.id === nav.id);

  const activeViewId = nav.kind === 'view' ? nav.id : null;
  const activeFolderId = nav.kind === 'folder' ? nav.id : null;

  return (
    <aside className="sidebar">
      <WorkspaceSwitcher onAddWorkspace={props.onAddWorkspace} />

      <div className="side-actions">
        <button className="primary side-new" onClick={props.onCapture}>
          <span>✎</span> {t('nav.createNew')}
        </button>
        <button className="side-search" aria-label={t('nav.search')} title={t('nav.search')}>
          <IconSearch />
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="nav-section">
          <div
            className={`nav-item ${isActive({ kind: 'today' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'today' }))}
          >
            <span className="nav-ico">
              <IconToday />
            </span>{' '}
            {t('nav.today')}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'calendar' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'calendar' }))}
          >
            <span className="nav-ico">
              <IconCalendar />
            </span>{' '}
            {t('nav.calendar')}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'todo' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'todo' }))}
          >
            <span className="nav-ico">
              <IconCheck size={18} />
            </span>{' '}
            {t('nav.todo')}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'inbox' }) ? 'active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const noteId = e.dataTransfer.getData('application/x-zettra-note');
              if (noteId) {
                e.preventDefault();
                props.onFileNote(noteId, null); // Drop a note here → un-file back to the Briefkasten.
              }
            }}
            {...clickable(() => props.onNav({ kind: 'inbox' }))}
          >
            <span className="nav-ico">
              <IconInbox />
            </span>{' '}
            {t('nav.briefkasten')}
            {props.inboxCount > 0 && <span className="count">{props.inboxCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'forReview' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'forReview' }))}
          >
            <span className="nav-ico">
              <IconReview />
            </span>{' '}
            {t('nav.forReview')}
            {props.forReviewCount > 0 && <span className="count">{props.forReviewCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'review' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'review' }))}
          >
            <span className="nav-ico">
              <IconSparkles />
            </span>{' '}
            {t('nav.connections')}
            {props.reviewCount > 0 && <span className="count">{props.reviewCount}</span>}
          </div>
        </div>

        <div className="nav-section">
          <div className="label">
            <span>{t('nav.tags')}</span>
            <button
              className="label-add"
              aria-label={t('nav.newSupertag')}
              title={t('nav.newSupertag')}
              onClick={props.onCreateTag}
            >
              <IconPlus size={15} />
            </button>
          </div>
          <TagTree
            tags={tags}
            views={views}
            activeViewId={activeViewId}
            onOpenView={(v) => props.onNav({ kind: 'view', id: v.id, name: v.name })}
            onReparent={props.onReparentTag}
            onEdit={props.onEditTag}
          />
        </div>

        <div className="nav-section">
          <div className="label">
            <span>{t('nav.folders')}</span>
            <button
              className="label-add"
              aria-label={t('folder.new')}
              title={t('folder.new')}
              onClick={() => props.onCreateFolder(null)}
            >
              <IconPlus size={15} />
            </button>
          </div>
          <FolderTree
            folders={props.folders}
            activeFolderId={activeFolderId}
            onOpen={(f) => props.onNav({ kind: 'folder', id: f.id, name: f.name })}
            onReparent={props.onReparentFolder}
            onFileNote={props.onFileNote}
            onCreateChild={(parentId) => props.onCreateFolder(parentId)}
            onRename={props.onRenameFolder}
            onDelete={props.onDeleteFolder}
          />
        </div>

        <div className="nav-section">
          <div className="label">{t('nav.spaces')}</div>
          {props.spaces.map((s) => (
            <div key={s.id} className="nav-item static" title={s.name}>
              <span className="nav-ico">
                {s.aiPolicy === 'local_only' ? '🔒' : <IconSpace size={16} />}
              </span>{' '}
              {s.name}
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="avatar">{props.email.slice(0, 2).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {props.email}
          </div>
        </div>
        <button
          className="icon"
          title={t('nav.signOut')}
          aria-label={t('nav.signOut')}
          onClick={props.onSignOut}
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
