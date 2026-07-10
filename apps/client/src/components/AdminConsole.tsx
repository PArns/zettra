import { useEffect, useState } from 'react';
import { api, type AdminUser, type Space } from '../lib/api';
import { useT } from '../i18n';
import { Button, Field, Input } from '../ui';
import { useToast } from './Toast';
import { useDialog } from './Dialog';

type Tab = 'users' | 'spaces';

/**
 * Admin console (§2): manage the tenant's users (create, set role, delete, impersonate) and its
 * spaces (create, delete). Rendered only for admins. The API is admin-guarded server-side too.
 */
export function AdminConsole({
  currentUserId,
  onClose,
  onImpersonate,
}: {
  currentUserId: string | null;
  onClose: () => void;
  onImpersonate: (accessToken: string) => void;
}) {
  const t = useT();
  const toast = useToast();
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'member',
  });
  const [newSpace, setNewSpace] = useState('');
  const [busy, setBusy] = useState(false);

  const loadUsers = () =>
    api
      .adminUsers()
      .then(setUsers)
      .catch(() => undefined);
  const loadSpaces = () =>
    api
      .adminSpaces()
      .then(setSpaces)
      .catch(() => undefined);

  useEffect(() => {
    void loadUsers();
    void loadSpaces();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function createUser() {
    if (!newUser.email.trim() || newUser.password.length < 8) {
      toast.error(t('admin.userFormHint'));
      return;
    }
    setBusy(true);
    try {
      await api.adminCreateUser({
        email: newUser.email.trim(),
        password: newUser.password,
        displayName: newUser.displayName.trim() || undefined,
        role: newUser.role,
      });
      setNewUser({ email: '', password: '', displayName: '', role: 'member' });
      await loadUsers();
      toast.success(t('admin.userCreated'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(u: AdminUser) {
    const role = u.role === 'admin' ? 'member' : 'admin';
    try {
      await api.adminSetUserRole(u.id, role);
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeUser(u: AdminUser) {
    const ok = await dialog.confirm({
      title: t('common.delete'),
      message: t('admin.deleteUserConfirm').replace('{email}', u.email),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.adminDeleteUser(u.id);
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function impersonate(u: AdminUser) {
    try {
      const { accessToken } = await api.adminImpersonate(u.id);
      onImpersonate(accessToken);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function createSpace() {
    if (!newSpace.trim()) return;
    setBusy(true);
    try {
      await api.adminCreateSpace(newSpace.trim());
      setNewSpace('');
      await loadSpaces();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSpace(s: Space) {
    const ok = await dialog.confirm({
      title: t('common.delete'),
      message: t('admin.deleteSpaceConfirm').replace('{name}', s.name),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.adminDeleteSpace(s.id);
      await loadSpaces();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.title')}
        style={{ maxWidth: 640 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">🛡️ {t('admin.title')}</span>
          <button className="icon" aria-label={t('common.close')} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
          <nav className="settings-tabs">
            <button
              className={`settings-tab ${tab === 'users' ? 'active' : ''}`}
              onClick={() => setTab('users')}
            >
              👥 {t('admin.usersTab')}
            </button>
            <button
              className={`settings-tab ${tab === 'spaces' ? 'active' : ''}`}
              onClick={() => setTab('spaces')}
            >
              🗂️ {t('admin.spacesTab')}
            </button>
          </nav>

          <div className="settings-panel">
            {tab === 'users' && (
              <div className="stack">
                <div className="admin-list">
                  {users.map((u) => (
                    <div key={u.id} className="admin-row">
                      <div className="admin-row-main">
                        <span className="admin-name">{u.displayName || u.email}</span>
                        <span className="admin-sub">{u.email}</span>
                      </div>
                      <span className={`role-badge ${u.role === 'admin' ? 'is-admin' : ''}`}>
                        {u.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleMember')}
                      </span>
                      <div className="admin-actions">
                        <button className="ghost" onClick={() => toggleRole(u)}>
                          {u.role === 'admin' ? t('admin.demote') : t('admin.promote')}
                        </button>
                        {u.id !== currentUserId && (
                          <>
                            <button className="ghost" onClick={() => impersonate(u)}>
                              {t('admin.impersonate')}
                            </button>
                            <button className="ghost danger" onClick={() => removeUser(u)}>
                              {t('common.remove')}
                            </button>
                          </>
                        )}
                        {u.id === currentUserId && (
                          <span className="admin-you">{t('admin.you')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="settings-label">{t('admin.newUser')}</div>
                <div className="admin-form">
                  <Field label={t('settings.email')} htmlFor="admin-email">
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('auth.password')} htmlFor="admin-pw">
                    {(id) => (
                      <Input
                        id={id}
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('settings.displayName')} htmlFor="admin-dn">
                    {(id) => (
                      <Input
                        id={id}
                        value={newUser.displayName}
                        onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('admin.role')} htmlFor="admin-role">
                    {(id) => (
                      <select
                        id={id}
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      >
                        <option value="member">{t('admin.roleMember')}</option>
                        <option value="admin">{t('admin.roleAdmin')}</option>
                      </select>
                    )}
                  </Field>
                  <Button variant="primary" onClick={createUser} disabled={busy}>
                    {t('admin.createUser')}
                  </Button>
                </div>
              </div>
            )}

            {tab === 'spaces' && (
              <div className="stack">
                <div className="admin-list">
                  {spaces.map((s) => (
                    <div key={s.id} className="admin-row">
                      <div className="admin-row-main">
                        <span className="admin-name">{s.name}</span>
                      </div>
                      <div className="admin-actions">
                        <button className="ghost danger" onClick={() => removeSpace(s)}>
                          {t('common.remove')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="admin-form">
                  <Field label={t('admin.spaceName')} htmlFor="admin-space">
                    {(id) => (
                      <Input
                        id={id}
                        value={newSpace}
                        onChange={(e) => setNewSpace(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createSpace()}
                      />
                    )}
                  </Field>
                  <Button variant="primary" onClick={createSpace} disabled={busy}>
                    {t('admin.createSpace')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
