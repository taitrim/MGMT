import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Trash2, Save, KeyRound } from 'lucide-react'
import { AccessUser, useVaultStore } from '../../stores/vaultStore'

interface AccessUserManagerModalProps {
  onClose: () => void
}

const roles: AccessUser['role'][] = ['owner', 'admin', 'editor', 'viewer']
const categoryOptions = ['server', 'database', 'ssh', 'website', 'router', 'cloud', 'email', 'outlook', 'api', 'license']

export function AccessUserManagerModal({ onClose }: AccessUserManagerModalProps) {
  const { accessUsers, fetchAccessUsers, createAccessUser, updateAccessUser, deleteAccessUser, changeAccessUserPassword } = useVaultStore()
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<AccessUser['role']>('viewer')
  const [newPassword, setNewPassword] = useState('')
  const [newCanViewPassword, setNewCanViewPassword] = useState(false)
  const [newCanCreateAccount, setNewCanCreateAccount] = useState(false)
  const [newCategoryPermissions, setNewCategoryPermissions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<AccessUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')

  useEffect(() => {
    fetchAccessUsers()
  }, [fetchAccessUsers])

  const onCreate = async () => {
    if (!newName.trim() || newPassword.length < 10) return
    try {
      await createAccessUser(
        newName.trim(),
        newEmail.trim() || null,
        newRole,
        newPassword,
        newCategoryPermissions,
        newCanViewPassword,
        newCanCreateAccount
      )
      setNewName('')
      setNewEmail('')
      setNewRole('viewer')
      setNewPassword('')
      setNewCanViewPassword(false)
      setNewCanCreateAccount(false)
      setNewCategoryPermissions([])
    } catch (e) {
      setError(String(e))
    }
  }

  const confirmResetPassword = async () => {
    if (!resetTarget) return
    if (resetPassword.length < 10) {
      setError('Mật khẩu mới phải từ 10 ký tự')
      return
    }
    if (resetPassword !== resetConfirm) {
      setError('Xác nhận mật khẩu không khớp')
      return
    }
    try {
      await changeAccessUserPassword(resetTarget.id, resetPassword)
      setResetTarget(null)
      setResetPassword('')
      setResetConfirm('')
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const toggleNewCategory = (category: string) => {
    setNewCategoryPermissions((prev) => prev.includes(category) ? prev.filter((x) => x !== category) : [...prev, category])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-5xl bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Phân quyền user</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên user" className="bg-bg-primary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (tùy chọn)" className="bg-bg-primary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mật khẩu (>=10 ký tự)" className="bg-bg-primary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as AccessUser['role'])} className="bg-bg-primary border border-border-subtle rounded-xl px-3 py-2 text-text-primary">
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={onCreate} className="bg-accent-primary text-bg-primary rounded-xl px-3 py-2 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Thêm user
              </button>
            </div>
            <label className="text-xs text-text-secondary flex items-center gap-2">
              <input type="checkbox" checked={newCanViewPassword} onChange={(e) => setNewCanViewPassword(e.target.checked)} />
              Cho phép xem password
            </label>
            <label className="text-xs text-text-secondary flex items-center gap-2">
              <input type="checkbox" checked={newCanCreateAccount} onChange={(e) => setNewCanCreateAccount(e.target.checked)} />
              Cho phép thêm tài khoản
            </label>
            <div>
              <p className="text-xs text-text-secondary mb-2">Quyền xem theo hạng mục</p>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((cat) => (
                  <label key={cat} className="text-xs text-text-secondary px-2 py-1 rounded border border-border-subtle flex items-center gap-1">
                    <input type="checkbox" checked={newCategoryPermissions.includes(cat)} onChange={() => toggleNewCategory(cat)} />
                    {cat}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[45vh] overflow-auto">
            {accessUsers.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onSave={updateAccessUser}
                onDelete={deleteAccessUser}
                onOpenReset={() => setResetTarget(u)}
              />
            ))}
            {accessUsers.length === 0 && (
              <p className="text-sm text-text-tertiary">Chưa có user phân quyền nào.</p>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </motion.div>

      {resetTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setResetTarget(null)
              setResetPassword('')
              setResetConfirm('')
            }
          }}
        >
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-bg-secondary border border-border-subtle rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Reset password - {resetTarget.name}</h3>
            <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Mật khẩu mới (>=10 ký tự)" className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setResetTarget(null); setResetPassword(''); setResetConfirm('') }} className="px-3 py-2 text-text-secondary">Hủy</button>
              <button onClick={confirmResetPassword} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary">Xác nhận</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function UserRow({
  user,
  onSave,
  onDelete,
  onOpenReset,
}: {
  user: AccessUser
  onSave: (user: AccessUser) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onOpenReset: () => void
}) {
  const [draft, setDraft] = useState<AccessUser>(user)

  useEffect(() => {
    setDraft(user)
  }, [user])

  const toggleCategory = (category: string) => {
    const next = draft.category_permissions.includes(category)
      ? draft.category_permissions.filter((x) => x !== category)
      : [...draft.category_permissions, category]
    setDraft({ ...draft, category_permissions: next })
  }

  return (
    <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
        <input value={draft.email || ''} onChange={(e) => setDraft({ ...draft, email: e.target.value || null })} className="bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as AccessUser['role'] })} className="bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary">
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="text-xs text-text-secondary flex items-center gap-2"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />Active</label>
        <label className="text-xs text-text-secondary flex items-center gap-2"><input type="checkbox" checked={draft.can_view_password} onChange={(e) => setDraft({ ...draft, can_view_password: e.target.checked })} />Xem password</label>
        <label className="text-xs text-text-secondary flex items-center gap-2"><input type="checkbox" checked={draft.can_create_account} onChange={(e) => setDraft({ ...draft, can_create_account: e.target.checked })} />Thêm tài khoản</label>
        <div className="text-xs text-text-tertiary">{new Date(draft.created_at).toLocaleDateString()}</div>
        <button onClick={() => onSave(draft)} className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover justify-self-end" title="Lưu"><Save className="w-4 h-4" /></button>
        <div className="flex gap-1 justify-self-end">
          <button onClick={onOpenReset} className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10" title="Reset password"><KeyRound className="w-4 h-4" /></button>
          <button onClick={() => onDelete(draft.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" title="Xóa"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {categoryOptions.map((cat) => (
          <label key={cat} className="text-xs text-text-secondary px-2 py-1 rounded border border-border-subtle flex items-center gap-1">
            <input type="checkbox" checked={draft.category_permissions.includes(cat)} onChange={() => toggleCategory(cat)} />
            {cat}
          </label>
        ))}
      </div>
    </div>
  )
}
