import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, FolderOpen, Save, RefreshCw, Database, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import { useVaultStore } from '../../stores/vaultStore'
import { SearchableSelect } from '../common/SearchableSelect'

interface AppSettingsModalProps {
  onClose: () => void
}

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const {
    storageInfo,
    dbHealth,
    checkDbHealth,
    setStoragePath,
    openDataDirectory,
    changeMasterPassword,
    listDatabases,
    createDatabase,
  } = useAuthStore()
  const { exportVaultVersioned, importVaultDryRun, importVault } = useVaultStore()
  const { theme, setTheme } = useThemeStore()

  const [dbPath, setDbPath] = useState(storageInfo?.db_path || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dbOptions, setDbOptions] = useState<{ name: string; path: string }[]>([])
  const [newDbName, setNewDbName] = useState('')
  const [backupDir, setBackupDir] = useState('')
  const [keepLast, setKeepLast] = useState(10)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [restorePath, setRestorePath] = useState('')
  const [dryRunResult, setDryRunResult] = useState<{
    version: number
    algorithm: string
    checksum_valid: boolean
    sqlite_valid: boolean
    bytes: number
  } | null>(null)
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(localStorage.getItem('auto_backup_enabled') === '1')
  const [autoBackupMinutes, setAutoBackupMinutes] = useState(Number(localStorage.getItem('auto_backup_minutes') || '60'))
  const [restoreConfirmText, setRestoreConfirmText] = useState('')

  useEffect(() => {
    setDbPath(storageInfo?.db_path || '')
    const currentDir = storageInfo?.db_path
      ? storageInfo.db_path.replace(/[\\/][^\\/]+$/, '')
      : ''
    setBackupDir(currentDir)
  }, [storageInfo?.db_path])

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

  const healthStatus = useMemo(() => {
    if (!dbHealth) return 'Chưa kiểm tra'
    if (!dbHealth.exists) return 'Thiếu file DB'
    if (dbHealth.quick_ok && dbHealth.integrity_ok) return 'Ổn định'
    return 'Có lỗi dữ liệu'
  }, [dbHealth])

  const hasDbIssue = !!dbHealth && (!dbHealth.exists || !dbHealth.quick_ok || !dbHealth.integrity_ok)

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await setStoragePath(dbPath.trim())
      setMessage('Đã lưu. Vui lòng khởi động lại ứng dụng để áp dụng đường dẫn database mới.')
    } catch (error) {
      setMessage(String(error))
    } finally {
      setIsSaving(false)
    }
  }

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
      setMessage('Đã tạo database mới. Bấm "Lưu" để chuyển ứng dụng sang database này.')
    } catch (error) {
      setMessage(String(error))
    }
  }

  const handleQuickBackup = async () => {
    if (!backupDir.trim()) {
      setMessage('Vui lòng nhập thư mục backup.')
      return
    }
    setIsBackingUp(true)
    setMessage(null)
    try {
      const out = await exportVaultVersioned(backupDir.trim(), keepLast)
      setMessage(`Backup thành công: ${out}`)
    } catch (error) {
      setMessage(String(error))
    } finally {
      setIsBackingUp(false)
    }
  }

  const saveAutoBackupSettings = () => {
    localStorage.setItem('auto_backup_enabled', autoBackupEnabled ? '1' : '0')
    localStorage.setItem('auto_backup_minutes', String(Math.max(10, autoBackupMinutes || 60)))
    localStorage.setItem('auto_backup_dir', backupDir.trim())
    setMessage('Đã lưu lịch backup tự động.')
  }

  const handleDryRunRestore = async () => {
    if (!restorePath.trim()) {
      setMessage('Vui lòng nhập đường dẫn file backup (.svb).')
      return
    }
    setIsDryRunning(true)
    setMessage(null)
    setDryRunResult(null)
    try {
      const result = await importVaultDryRun(restorePath.trim())
      setDryRunResult(result)
      if (!result.checksum_valid || !result.sqlite_valid) {
        setMessage('Cảnh báo: backup không hợp lệ hoàn toàn. Không nên restore.')
      } else {
        setMessage('Dry-run thành công. Bạn có thể restore.')
      }
    } catch (error) {
      setMessage(String(error))
    } finally {
      setIsDryRunning(false)
    }
  }

  const handleRestore = async () => {
    if (!restorePath.trim()) {
      setMessage('Vui lòng nhập đường dẫn file backup (.svb).')
      return
    }
    if (!dryRunResult || !dryRunResult.checksum_valid || !dryRunResult.sqlite_valid) {
      setMessage('Cần dry-run hợp lệ trước khi restore.')
      return
    }
    if (restoreConfirmText.trim().toUpperCase() !== 'RESTORE') {
      setMessage('Vui lòng nhập RESTORE để xác nhận.')
      return
    }
    setIsRestoring(true)
    setMessage(null)
    try {
      await importVault(restorePath.trim())
      setMessage('Restore hoàn tất. Vui lòng khóa/mở lại hoặc khởi động lại ứng dụng để nạp dữ liệu mới.')
      setRestoreConfirmText('')
    } catch (error) {
      setMessage(String(error))
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-5xl max-h-[94vh] modal-panel border border-border-subtle rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Thiết lập ứng dụng</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[86vh] overflow-y-auto">
          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-2">
            <p className="text-sm text-text-secondary">Giao diện</p>
            <div className="flex gap-2">
              <button onClick={() => setTheme('dark')} className={`px-3 py-1 rounded-lg border ${theme === 'dark' ? 'border-accent-primary text-text-primary' : 'border-border-subtle text-text-secondary'}`}>Tối</button>
              <button onClick={() => setTheme('light')} className={`px-3 py-1 rounded-lg border ${theme === 'light' ? 'border-accent-primary text-text-primary' : 'border-border-subtle text-text-secondary'}`}>Sáng</button>
            </div>
          </div>

          <div className="text-xs text-text-tertiary">Chế độ lưu trữ: {storageInfo?.mode || '-'}</div>

          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 text-xs text-text-secondary space-y-1">
            <div className="flex items-center justify-between">
              <span>DB Health</span>
              <span className={healthStatus === 'Ổn định' ? 'text-emerald-400' : 'text-red-400'}>{healthStatus}</span>
            </div>
            <div>Số trang DB: {dbHealth?.page_count ?? '-'}</div>
            <div>File: {dbHealth?.db_path || '-'}</div>
            <button onClick={() => checkDbHealth()} className="mt-2 px-2 py-1 rounded bg-bg-primary border border-border-subtle hover:bg-bg-hover flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Kiểm tra lại DB
            </button>
          </div>

          {hasDbIssue && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200 space-y-2">
              <p className="font-semibold">Phát hiện lỗi DB</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Mở thư mục dữ liệu và backup file vault ngay.</li>
                <li>Kiểm tra lại DB health.</li>
                <li>Nếu vẫn lỗi, restore từ backup đã verify (dry-run trước).</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <button onClick={() => openDataDirectory()} className="px-2 py-1 rounded bg-red-900/40 border border-red-400/30 hover:bg-red-900/60">Mở thư mục dữ liệu</button>
                <button onClick={() => checkDbHealth()} className="px-2 py-1 rounded bg-red-900/40 border border-red-400/30 hover:bg-red-900/60">Kiểm tra lại</button>
              </div>
            </div>
          )}

          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-text-primary"><Database className="w-4 h-4" /> <span className="text-sm">Database</span></div>
            <SearchableSelect
              value={dbPath}
              onChange={setDbPath}
              options={[
                { value: '', label: '-- Chọn database --' },
                ...dbOptions.map((d) => ({ value: d.path, label: `${d.name} - ${d.path}` })),
              ]}
              placeholder="-- Chọn database --"
              searchPlaceholder="Tìm database..."
              emptyText="Không có database"
            />
            <input value={dbPath} onChange={(e) => setDbPath(e.target.value)} className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
            <div className="flex gap-2 mt-2">
              <input value={newDbName} onChange={(e) => setNewDbName(e.target.value)} placeholder="Tên database mới (vd: customer_a)" className="flex-1 bg-bg-primary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
              <button onClick={handleCreateDatabase} className="px-3 py-2 rounded-lg bg-bg-primary text-text-secondary hover:text-text-primary border border-border-subtle">Tạo DB</button>
            </div>
          </div>

          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-text-primary"><ShieldCheck className="w-4 h-4" /> <span className="text-sm">Backup nhanh (versioned)</span></div>
            <input value={backupDir} onChange={(e) => setBackupDir(e.target.value)} placeholder="Thư mục backup" className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-tertiary">Giữ lại</label>
              <input type="number" min={1} value={keepLast} onChange={(e) => setKeepLast(Math.max(1, Number(e.target.value) || 1))} className="w-24 bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
              <span className="text-xs text-text-tertiary">bản gần nhất</span>
            </div>
            <button onClick={handleQuickBackup} disabled={isBackingUp} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary disabled:opacity-50">
              {isBackingUp ? 'Đang backup...' : 'Backup ngay'}
            </button>
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <p className="text-xs text-text-tertiary">Lịch backup tự động</p>
              <label className="text-xs text-text-secondary flex items-center gap-2"><input type="checkbox" checked={autoBackupEnabled} onChange={(e) => setAutoBackupEnabled(e.target.checked)} />Bật backup tự động</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary">Chu kỳ (phút)</span>
                <input type="number" min={10} value={autoBackupMinutes} onChange={(e) => setAutoBackupMinutes(Math.max(10, Number(e.target.value) || 60))} className="w-24 bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
                <button onClick={saveAutoBackupSettings} className="px-3 py-1 rounded-lg bg-bg-primary border border-border-subtle text-text-secondary hover:text-text-primary">Lưu lịch</button>
              </div>
            </div>
          </div>

          <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-text-primary"><ShieldCheck className="w-4 h-4" /> <span className="text-sm">Restore backup (an toàn)</span></div>
            <input value={restorePath} onChange={(e) => setRestorePath(e.target.value)} placeholder="Đường dẫn file backup (.svb)" className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
            <div className="flex gap-2">
              <button onClick={handleDryRunRestore} disabled={isDryRunning} className="px-3 py-2 rounded-lg bg-bg-primary border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-50">
                {isDryRunning ? 'Đang dry-run...' : 'Dry-run verify'}
              </button>
              <button onClick={handleRestore} disabled={isRestoring || !dryRunResult || !dryRunResult.checksum_valid || !dryRunResult.sqlite_valid} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary disabled:opacity-50">
                {isRestoring ? 'Đang restore...' : 'Restore ngay'}
              </button>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 space-y-1">
              <p className="text-xs text-amber-300">Bước xác nhận an toàn: nhập <b>RESTORE</b> để cho phép khôi phục.</p>
              <input value={restoreConfirmText} onChange={(e) => setRestoreConfirmText(e.target.value)} placeholder="Nhập RESTORE để xác nhận" className="w-full bg-bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" />
            </div>
            {dryRunResult && (
              <div className="text-xs text-text-secondary bg-bg-primary border border-border-subtle rounded-lg p-2 space-y-1">
                <p>Version: {dryRunResult.version} | Algorithm: {dryRunResult.algorithm}</p>
                <p>Kích thước: {dryRunResult.bytes} bytes</p>
                <p className={dryRunResult.checksum_valid ? 'text-emerald-400' : 'text-red-400'}>
                  Checksum: {dryRunResult.checksum_valid ? 'Hợp lệ' : 'Không hợp lệ'}
                </p>
                <p className={dryRunResult.sqlite_valid ? 'text-emerald-400' : 'text-red-400'}>
                  SQLite: {dryRunResult.sqlite_valid ? 'Hợp lệ' : 'Không hợp lệ'}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => openDataDirectory()} className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> Mở thư mục dữ liệu
            </button>
            <button onClick={handleSave} disabled={isSaving || !dbPath.trim()} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> Lưu
            </button>
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-2">
            <p className="text-sm text-text-secondary">Đổi master password</p>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Mật khẩu hiện tại" className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mật khẩu mới (>= 10 ký tự)" className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Xác nhận mật khẩu mới" className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
            <button onClick={handleChangePassword} disabled={!currentPassword || !newPassword || !confirmPassword} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary disabled:opacity-50">Đổi mật khẩu</button>
          </div>

          {message && <p className="text-xs text-text-tertiary">{message}</p>}
        </div>
      </motion.div>
    </div>
  )
}

