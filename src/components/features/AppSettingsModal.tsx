import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, FolderOpen, Save } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

interface AppSettingsModalProps {
  onClose: () => void
}

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const { storageInfo, setStoragePath, openDataDirectory } = useAuthStore()
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

