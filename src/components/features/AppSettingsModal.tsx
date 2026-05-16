import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, FolderOpen, Save, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

interface AppSettingsModalProps {
  onClose: () => void
}

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const { storageInfo, dbHealth, checkDbHealth, setStoragePath, openDataDirectory } = useAuthStore()
  const [dbPath, setDbPath] = useState(storageInfo?.db_path || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
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
            <input
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
            />
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
          {message && <p className="text-xs text-text-tertiary">{message}</p>}
        </div>
      </motion.div>
    </div>
  )
}
