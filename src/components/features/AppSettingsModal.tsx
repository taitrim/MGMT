import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, FolderOpen, Save, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'

interface AppSettingsModalProps {
  onClose: () => void
}

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const { storageInfo, dbHealth, checkDbHealth, setStoragePath, openDataDirectory, changeMasterPassword, listDatabases, createDatabase } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const [dbPath, setDbPath] = useState(storageInfo?.db_path || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dbOptions, setDbOptions] = useState<{ name: string; path: string }[]>([])
  const [newDbName, setNewDbName] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const items = await listDatabases()
        setDbOptions(items)
      } catch {
        setDbOptions([])
      }
    }
    load()
  }, [listDatabases])

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await setStoragePath(dbPath.trim())
      setMessage('Da luu. Vui long khoi dong lai ung dung de ap dung duong dan moi.')
    } catch (error) {
      setMessage(String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const healthStatus =
    !dbHealth ? 'Unknown' : (!dbHealth.exists ? 'Missing DB file' : (dbHealth.quick_ok && dbHealth.integrity_ok ? 'Healthy' : 'Corrupted'))
  const hasDbIssue = !!dbHealth && (!dbHealth.exists || !dbHealth.quick_ok || !dbHealth.integrity_ok)

  const handleChangePassword = async () => {
    setMessage(null)
    if (newPassword.length < 10) {
      setMessage('Mật khẩu mới phải từ 10 ký tự trở lên.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Xác nhận mật khẩu mới không khớp.')
      return
    }
    try {
      await changeMasterPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Đổi master password thành công.')
    } catch (error) {
      setMessage(String(error))
    }
  }

  const handleCreateDatabase = async () => {
    if (!newDbName.trim()) return
    try {
      const created = await createDatabase(newDbName.trim())
      const items = await listDatabases()
      setDbOptions(items)
      setDbPath(created.path)
      setNewDbName('')
      setMessage('Da tao database moi. Bam Save de chuyen sang DB nay.')
    } catch (error) {
      setMessage(String(error))
    }
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
        className="w-full max-w-xl bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">App Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-2">
            <p className="text-sm text-text-secondary">Theme</p>
            <div className="flex gap-2">
              <button onClick={() => setTheme('dark')} className={`px-3 py-1 rounded-lg border ${theme === 'dark' ? 'border-accent-primary text-text-primary' : 'border-border-subtle text-text-secondary'}`}>Dark</button>
              <button onClick={() => setTheme('light')} className={`px-3 py-1 rounded-lg border ${theme === 'light' ? 'border-accent-primary text-text-primary' : 'border-border-subtle text-text-secondary'}`}>Light</button>
            </div>
          </div>

          <div className="text-xs text-text-tertiary">
            Mode: {storageInfo?.mode || '-'}
          </div>
          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 text-xs text-text-secondary space-y-1">
            <div className="flex items-center justify-between">
              <span>DB Health</span>
              <span className={healthStatus === 'Healthy' ? 'text-emerald-400' : 'text-red-400'}>{healthStatus}</span>
            </div>
            <div>Pages: {dbHealth?.page_count ?? '-'}</div>
            <div>File: {dbHealth?.db_path || '-'}</div>
            <button
              onClick={() => checkDbHealth()}
              className="mt-2 px-2 py-1 rounded bg-bg-primary border border-border-subtle hover:bg-bg-hover flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Re-check DB health
            </button>
          </div>
          {hasDbIssue && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200 space-y-2">
              <p className="font-semibold">DB issue detected</p>
              <p>Recommended actions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open data folder and backup your vault file immediately.</li>
                <li>Run health check again.</li>
                <li>If still failing, restore from a verified backup (dry-run first).</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openDataDirectory()}
                  className="px-2 py-1 rounded bg-red-900/40 border border-red-400/30 hover:bg-red-900/60"
                >
                  Open data folder
                </button>
                <button
                  onClick={() => checkDbHealth()}
                  className="px-2 py-1 rounded bg-red-900/40 border border-red-400/30 hover:bg-red-900/60"
                >
                  Re-check
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-text-secondary block mb-1">Database path</label>
            <select
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary mb-2"
            >
              <option value="">-- Chon database --</option>
              {dbOptions.map((d) => (
                <option key={d.path} value={d.path}>{d.name} - {d.path}</option>
              ))}
            </select>
            <input
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
            />
            <div className="flex gap-2 mt-2">
              <input
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                placeholder="Tên database mới (vd: customer_a)"
                className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
              />
              <button onClick={handleCreateDatabase} className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary">
                Tạo DB
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openDataDirectory()}
              className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Open data folder
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !dbPath.trim()}
              className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-2">
            <p className="text-sm text-text-secondary">Đổi master password</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu mới (>= 10 ký tự)"
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Xác nhận mật khẩu mới"
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
            />
            <button
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmPassword}
              className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary disabled:opacity-50"
            >
              Đổi mật khẩu
            </button>
          </div>
          {message && <p className="text-xs text-text-tertiary">{message}</p>}
        </div>
      </motion.div>
    </div>
  )
}
