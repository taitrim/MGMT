import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, History, Activity, Shield, Key, Plus, Trash2, Edit2 } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'
import { invoke } from '@tauri-apps/api/core'

interface AuditLog {
  id: string
  user_id: string
  action: string
  target_type: string
  target_id: string
  details: any
  created_at: string
}

interface AuditLogModalProps {
  onClose: () => void
}

export function AuditLogModal({ onClose }: AuditLogModalProps) {
  const { language } = useI18nStore()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      const data = await invoke<AuditLog[]>('get_audit_logs', { limit: 300 })
      setLogs(data)
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    const actionOk = actionFilter === 'all' || log.action.includes(actionFilter)
    const q = query.trim().toLowerCase()
    if (!q) return actionOk
    const text = `${log.action} ${log.target_type || ''} ${log.target_id || ''} ${JSON.stringify(log.details || {})}`.toLowerCase()
    return actionOk && text.includes(q)
  })

  const exportCsv = () => {
    const rows = filteredLogs.map((log) => [
      log.created_at,
      log.action,
      log.target_type || '',
      log.target_id || '',
      JSON.stringify(log.details || {}),
    ])
    const header = ['created_at', 'action', 'target_type', 'target_id', 'details']
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return <Plus className="w-4 h-4 text-green-500" />
    if (action.includes('delete')) return <Trash2 className="w-4 h-4 text-red-500" />
    if (action.includes('update')) return <Edit2 className="w-4 h-4 text-blue-500" />
    if (action.includes('login') || action.includes('unlock')) return <Shield className="w-4 h-4 text-accent-primary" />
    return <Activity className="w-4 h-4 text-text-tertiary" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl modal-panel border border-border-subtle rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Security Audit Log', 'Nh?t ký b?o m?t')}</h2>
              <p className="text-sm text-text-tertiary">{t(language, 'Track all activity in your vault', 'Theo dõi toàn b? ho?t d?ng trong kho')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-border-subtle flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(language, 'Search logs...', 'Tìm nh?t ký...')} className="min-w-64 bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary" />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary">
            <option value="all">T?t c? hành d?ng</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="unlock">Unlock/Login</option>
            <option value="export">Export</option>
            <option value="import">Import/Restore</option>
          </select>
          <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary text-sm">Export CSV</button>
          <span className="text-xs text-text-tertiary ml-auto">{filteredLogs.length} logs</span>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-text-tertiary">{t(language, 'Loading activity logs...', 'Ðang t?i nh?t ký...')}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-bg-tertiary rounded-full flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-text-tertiary" />
              </div>
              <p className="text-text-primary font-medium">{t(language, 'No activity yet', 'Chua có ho?t d?ng')}</p>
              <p className="text-sm text-text-tertiary max-w-[240px]">{t(language, 'Important actions will appear here once they happen.', 'Các hành d?ng quan tr?ng s? hi?n th? t?i dây.')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-bg-tertiary rounded-xl border border-border-subtle hover:border-accent-primary/20 transition-colors">
                  <div className="mt-1">{getActionIcon(log.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-text-primary capitalize">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-text-tertiary font-mono">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-text-secondary truncate">{log.target_type} {log.target_id ? `(${log.target_id.slice(0, 8)}...)` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
