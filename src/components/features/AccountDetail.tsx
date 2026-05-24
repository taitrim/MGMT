import { useState, useEffect } from 'react'
import { Account, FieldValue, useVaultStore } from '../../stores/vaultStore'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Copy, Eye, EyeOff, Star, Trash2, Edit2, Key, RefreshCw, FileText, Download, AlertTriangle } from 'lucide-react'
import { TOTPViewer } from './TOTPViewer'
import { EditAccountModal } from './EditAccountModal'
import { invoke } from '@tauri-apps/api/core'
import { copyToClipboardSecure } from '../../utils/clipboard'
import { t, useI18nStore } from '../../stores/i18nStore'
import { useAuthStore } from '../../stores/authStore'
import { SearchableSelect } from '../common/SearchableSelect'

interface AccountDetailProps {
  account: Account
  onClose: () => void
}

export function AccountDetail({ account, onClose }: AccountDetailProps) {
  const { getAccountFields, deleteAccount, updateAccount, accountTypes } = useVaultStore()
  const { currentAccessUser, verifyCurrentAccessUserPassword } = useAuthStore()
  const { language } = useI18nStore()
  const [fields, setFields] = useState<FieldValue[]>([])
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasTotp, setHasTotp] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showReauthModal, setShowReauthModal] = useState(false)
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthError, setReauthError] = useState<string | null>(null)
  const [pendingRevealField, setPendingRevealField] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [confirmRevealField, setConfirmRevealField] = useState<string | null>(null)
  const [connectApp, setConnectApp] = useState(() => localStorage.getItem('quick_connect_app') || 'system')
  const [connectStatus, setConnectStatus] = useState<string | null>(null)
  const [customExe, setCustomExe] = useState(() => localStorage.getItem('quick_connect_custom_exe') || '')
  const [customArgs, setCustomArgs] = useState(() => localStorage.getItem('quick_connect_custom_args') || '{target}')

  useEffect(() => {
    loadFields()
  }, [account.id])
  useEffect(() => {
    localStorage.setItem('quick_connect_app', connectApp)
  }, [connectApp])
  useEffect(() => {
    localStorage.setItem('quick_connect_custom_exe', customExe)
  }, [customExe])
  useEffect(() => {
    localStorage.setItem('quick_connect_custom_args', customArgs)
  }, [customArgs])

  const loadFields = async () => {
    const data = await getAccountFields(account.id)
    setFields(data)
    
    // Check for TOTP
    try {
      const totp = await invoke('get_totp', { accountId: account.id })
      setHasTotp(!!totp)
    } catch (e) {
      setHasTotp(false)
    }

    // Load attachments
    try {
      const data = await invoke<any[]>('get_attachments', { accountId: account.id })
      setAttachments(data)
    } catch (e) {
      console.error('Failed to load attachments:', e)
    }
  }

  const toggleFieldVisibility = (fieldKey: string) => {
    const newVisible = new Set(visibleFields)
    if (newVisible.has(fieldKey)) {
      newVisible.delete(fieldKey)
    } else {
      if (currentAccessUser && !currentAccessUser.can_view_password) {
        alert(t(language, 'You do not have permission to view password', 'Bạn không có quyền xem mật khẩu'))
        return
      }
      const cacheUntil = Number(sessionStorage.getItem('password_reauth_until') || '0')
      if (Date.now() > cacheUntil) {
        setPendingRevealField(fieldKey)
        setShowReauthModal(true)
        return
      }
      setConfirmRevealField(fieldKey)
      return
    }
    setVisibleFields(newVisible)
  }

  const confirmRevealNow = () => {
    if (!confirmRevealField) return
    const next = new Set(visibleFields)
    next.add(confirmRevealField)
    setVisibleFields(next)
    setConfirmRevealField(null)
  }

  const confirmReauth = async () => {
    try {
      setReauthError(null)
      const ok = await verifyCurrentAccessUserPassword(reauthPassword)
      if (!ok) {
        setReauthError(t(language, 'Wrong password', 'Sai mật khẩu'))
        return
      }
      sessionStorage.setItem('password_reauth_until', String(Date.now() + 5 * 60 * 1000))
      if (pendingRevealField) {
        const next = new Set(visibleFields)
        next.add(pendingRevealField)
        setVisibleFields(next)
      }
      setPendingRevealField(null)
      setReauthPassword('')
      setShowReauthModal(false)
    } catch (e) {
      setReauthError(String(e))
    }
  }

  const copyToClipboard = async (value: string, fieldKey: string) => {
    const success = await copyToClipboardSecure(value)
    if (success) {
      setCopiedField(fieldKey)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleToggleFavorite = async () => {
    await updateAccount(account.id, { favorite: !account.favorite })
  }

  const handleDelete = async () => {
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteAccount(account.id)
      onClose()
    } finally {
      setIsDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

  const accountType = accountTypes.find(t => t.id === account.account_type_id)
  const fieldMap = new Map(fields.map((f) => [f.field_key.toLowerCase(), f.value?.trim() || '']))
  const pick = (...keys: string[]) => keys.map((k) => fieldMap.get(k)).find((v) => !!v) || ''
  const host = pick('host', 'hostname', 'server', 'ip', 'address', 'domain')
  const username = pick('username', 'user', 'login')
  const port = pick('port')
  const rawUrl = pick('url', 'website', 'endpoint', 'panel_url')
  const typeName = (accountType?.name || '').toLowerCase()

  const buildConnectionTarget = () => {
    if (rawUrl) {
      return { protocol: 'url', target: rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}` }
    }
    if (typeName.includes('rdp')) {
      return { protocol: 'rdp', target: port ? `${host}:${port}` : host }
    }
    if (typeName.includes('ssh') && host) {
      const auth = username ? `${encodeURIComponent(username)}@` : ''
      const portPart = port ? `:${port}` : ''
      return { protocol: 'ssh', target: `ssh://${auth}${host}${portPart}` }
    }
    if (typeName.includes('ftp') && host) {
      const auth = username ? `${encodeURIComponent(username)}@` : ''
      const portPart = port ? `:${port}` : ''
      return { protocol: 'sftp', target: `sftp://${auth}${host}${portPart}` }
    }
    if (typeName.includes('vpn') && host) {
      const portPart = port ? `:${port}` : ''
      return { protocol: 'url', target: `https://${host}${portPart}` }
    }
    if (typeName.includes('router') && host) {
      const portPart = port ? `:${port}` : ''
      return { protocol: 'url', target: `http://${host}${portPart}` }
    }
    if (host) {
      const portPart = port ? `:${port}` : ''
      return { protocol: 'url', target: `https://${host}${portPart}` }
    }
    return null
  }

  const inferProtocol = () => {
    if (typeName.includes('rdp')) return 'rdp'
    if (typeName.includes('ssh')) return 'ssh'
    if (typeName.includes('ftp') || typeName.includes('sftp')) return 'sftp'
    if (typeName.includes('website')) return 'url'
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return 'url'
    if (rawUrl.startsWith('ftp://') || rawUrl.startsWith('sftp://')) return 'sftp'
    return 'url'
  }

  const resolvePort = () => {
    const p = Number(port)
    if (Number.isFinite(p) && p > 0 && p < 65536) return p
    const proto = inferProtocol()
    if (proto === 'rdp') return 3389
    if (proto === 'ssh') return 22
    if (proto === 'sftp') return 22
    if (proto === 'url') return 443
    return 0
  }

  const openQuickConnection = async () => {
    try {
      const payload = buildConnectionTarget()
      if (!payload) {
        alert(t(language, 'No connection information found', 'Không tìm thấy thông tin kết nối'))
        return
      }
      await invoke('open_connection_with_app', {
        protocol: inferProtocol(),
        host,
        port: resolvePort(),
        username: username || null,
        target: payload.target,
        app: connectApp,
        customExe: connectApp === 'custom' ? customExe : null,
        customArgs: connectApp === 'custom' ? customArgs.split(/\s+/).filter(Boolean) : null,
      })
    } catch (e) {
      alert(String(e))
    }
  }

  const testConnection = async () => {
    try {
      if (!host) {
        setConnectStatus('Không có host/ip để kiểm tra')
        return
      }
      setConnectStatus('Đang kiểm tra kết nối...')
      const result = await invoke<{ reachable: boolean; message: string; latency_ms?: number | null }>('test_connection_target', {
        host,
        port: resolvePort(),
        timeoutMs: 3000,
      })
      if (result.reachable) {
        setConnectStatus(`Kết nối OK (${result.latency_ms ?? '-'} ms)`)
      } else {
        setConnectStatus(`Lỗi: ${result.message}`)
      }
    } catch (e) {
      setConnectStatus(String(e))
    }
  }

  const fieldNameByKey = new Map((accountType?.fields || []).map((f) => [f.key, f.name]))
  const fieldGroupByKey = new Map((accountType?.fields || []).map((f) => [f.key, f.field_group || null]))
  const detectAutoGroup = (key: string): 'identity' | 'connection' | 'detail' => {
    const k = key.toLowerCase()
    if (k === 'username' || k === 'user' || k === 'login' || k === 'email' || k === 'account') return 'identity'
    if (k.includes('url') || k.includes('host') || k.includes('server') || k.includes('ip') || k.includes('port') || k.includes('endpoint') || k.includes('domain') || k.includes('panel')) return 'connection'
    return 'detail'
  }
  const resolveGroup = (key: string): 'identity' | 'connection' | 'detail' => {
    const configured = fieldGroupByKey.get(key)
    if (configured === 'identity' || configured === 'connection' || configured === 'detail') return configured
    return detectAutoGroup(key)
  }
  const loginAddressFields = fields.filter((f) => {
    if (f.field_type === 'password') return false
    const g = resolveGroup(f.field_key)
    return g === 'identity' || g === 'connection'
  })
  const identityFields = loginAddressFields.filter((f) => resolveGroup(f.field_key) === 'identity')
  const connectionFields = loginAddressFields.filter((f) => resolveGroup(f.field_key) === 'connection')
  const passwordFields = fields.filter(f => f.field_type === 'password')
  const otherFields = fields.filter(
    (f) =>
      f.field_type !== 'password' &&
      resolveGroup(f.field_key) === 'detail'
  )

  const renderFieldPreview = (field: FieldValue) => {
    if (field.field_type === 'checkbox') {
      const enabled = field.value === 'true'
      return <span className={`text-xs px-2 py-1 rounded ${enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-400'}`}>{enabled ? 'Bật' : 'Tắt'}</span>
    }

    if (field.field_type === 'multiselect' || field.field_type === 'tags') {
      const values = field.value.split(',').map((v) => v.trim()).filter(Boolean)
      if (values.length === 0) return <p className="text-text-primary truncate">-</p>
      return (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => <span key={v} className="text-xs px-2 py-0.5 rounded bg-sky-500/15 text-sky-300">{v}</span>)}
        </div>
      )
    }

    if (field.field_type === 'select') {
      return <span className="text-xs px-2 py-1 rounded bg-indigo-500/15 text-indigo-300">{field.value || '-'}</span>
    }

    if (field.field_type === 'date') {
      return <span className="text-text-primary">{field.value ? new Date(field.value).toLocaleDateString() : '-'}</span>
    }

    return <p className="text-text-primary truncate">{field.value}</p>
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-full max-w-6xl mx-auto"
    >
      <div className="modal-panel border border-border-subtle rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-violet-500/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center">
              <Key className="w-6 h-6 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{account.name}</h2>
              <p className="text-sm text-text-tertiary">{accountType?.name || 'Login'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                  {new Date(account.updated_at).toLocaleDateString()}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">
                  {account.updated_by_access_user_name || 'Master'}
                </span>
              </div>
              {account.has_expiry && account.expires_at && (
                <p className="text-xs text-amber-400 mt-1">
                  {t(language, 'Expires on', 'Hết hạn vào')}: {new Date(account.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-44">
              <SearchableSelect
                value={connectApp}
                onChange={setConnectApp}
                options={[
                  { value: 'system', label: 'Mặc định hệ thống' },
                  { value: 'browser', label: 'Trình duyệt mặc định' },
                  { value: 'chrome', label: 'Google Chrome' },
                  { value: 'edge', label: 'Microsoft Edge' },
                  { value: 'firefox', label: 'Mozilla Firefox' },
                  { value: 'putty', label: 'PuTTY (SSH)' },
                  { value: 'winscp', label: 'WinSCP (SFTP/FTP)' },
                  { value: 'rdp', label: 'Remote Desktop' },
                  { value: 'custom', label: 'Ứng dụng tùy chỉnh' },
                ]}
                searchPlaceholder="Tìm app..."
              />
            </div>
            <button
              onClick={testConnection}
              className="px-3 py-2 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
            >
              Test kết nối
            </button>
            <button
              onClick={openQuickConnection}
              className="px-3 py-2 rounded-lg text-xs font-medium text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
            >
              {t(language, 'Quick Connect', 'Kết nối nhanh')}
            </button>
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg transition-colors ${
                account.favorite
                  ? 'text-accent-primary bg-accent-primary/10'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Star className={`w-5 h-5 ${account.favorite ? 'fill-accent-primary' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-5">
            {connectApp === 'custom' && (
              <div className="premium-section section-amber p-4 space-y-2">
                <p className="text-xs text-text-tertiary">Ứng dụng tùy chỉnh</p>
                <input
                  value={customExe}
                  onChange={(e) => setCustomExe(e.target.value)}
                  placeholder="Đường dẫn exe, ví dụ: C:\\Program Files\\PuTTY\\putty.exe"
                  className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary"
                />
                <input
                  value={customArgs}
                  onChange={(e) => setCustomArgs(e.target.value)}
                  placeholder="Tham số, ví dụ: {target} hoặc -ssh {host} -P {port} -l {username}"
                  className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary"
                />
                <p className="text-[11px] text-text-tertiary">Biến hỗ trợ: {'{target}'} {'{host}'} {'{port}'} {'{username}'}</p>
              </div>
            )}
            {connectStatus && (
              <div className="text-xs px-3 py-2 rounded-lg border border-border-subtle bg-bg-tertiary text-text-secondary">
                {connectStatus}
              </div>
            )}
            {hasTotp && (
            <div className="premium-section section-emerald p-4">
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Two-Factor Authentication', 'Xác thực hai lớp')}</h3>
              <TOTPViewer accountId={account.id} />
            </div>
            )}

          {(loginAddressFields.length > 0 || passwordFields.length > 0) && (
            <div className="premium-section section-sky p-4">
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Login & Password', 'Thông tin đăng nhập & mật khẩu')}</h3>

              {loginAddressFields.length > 0 && (
                <div className="space-y-3 mb-3">
                  {identityFields.length > 0 && <p className="text-xs uppercase tracking-wide text-sky-300/90">Danh tính</p>}
                  {identityFields.map((field) => (
                    <div key={field.field_key} className="flex items-center gap-3 bg-bg-tertiary rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-tertiary mb-1">{fieldNameByKey.get(field.field_key) || field.field_key}</p>
                        {field.value.startsWith('http') ? (
                          <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline truncate block">
                            {field.value}
                          </a>
                        ) : (
                          <p className="text-text-primary truncate">{field.value}</p>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(field.value, field.field_key)}
                        className={`p-2 rounded-lg transition-colors shrink-0 ${
                          copiedField === field.field_key
                            ? 'text-accent-primary bg-accent-primary/10'
                            : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        {copiedField === field.field_key ? <RefreshCw className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                  {connectionFields.length > 0 && <p className="text-xs uppercase tracking-wide text-emerald-300/90 mt-1">Kết nối</p>}
                  {connectionFields.map((field) => (
                    <div key={field.field_key} className="flex items-center gap-3 bg-bg-tertiary rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-tertiary mb-1">{fieldNameByKey.get(field.field_key) || field.field_key}</p>
                        {field.value.startsWith('http') ? (
                          <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline truncate block">
                            {field.value}
                          </a>
                        ) : (
                          <p className="text-text-primary truncate">{field.value}</p>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(field.value, field.field_key)}
                        className={`p-2 rounded-lg transition-colors shrink-0 ${
                          copiedField === field.field_key
                            ? 'text-accent-primary bg-accent-primary/10'
                            : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        {copiedField === field.field_key ? <RefreshCw className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {passwordFields.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-text-tertiary mb-2">{t(language, 'For safety, revealing password requires confirmation.', 'Để an toàn, khi hiện mật khẩu sẽ cần xác nhận.')}</p>
                  {passwordFields.map((field) => {
                    const isVisible = visibleFields.has(field.field_key)
                    const isCopied = copiedField === field.field_key

                    return (
                      <div key={field.field_key} className="flex items-center gap-3 bg-bg-tertiary rounded-xl p-3 border border-amber-500/20">
                        <div className="flex-1">
                          <p className="text-xs text-text-tertiary mb-1">{fieldNameByKey.get(field.field_key) || field.field_key}</p>
                          <p className="font-mono text-text-primary">
                            {isVisible ? field.value : '************'}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleFieldVisibility(field.field_key)}
                          className="p-2 text-text-tertiary hover:text-text-secondary transition-colors"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(field.value, field.field_key)}
                          className={`p-2 rounded-lg transition-colors ${
                            isCopied
                              ? 'text-accent-primary bg-accent-primary/10'
                              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                          }`}
                        >
                          {isCopied ? <RefreshCw className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          </div>

          <div className="space-y-5">
          {otherFields.length > 0 && (
            <div className="premium-section section-violet p-4">
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Details', 'Chi tiết')}</h3>
              <div className="space-y-3">
                {otherFields.map((field) => {
                  const isUrl = field.field_type === 'url'
                  const isCopied = copiedField === field.field_key

                  return (
                    <div
                      key={field.field_key}
                      className="flex items-center gap-3 bg-bg-tertiary rounded-xl p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-tertiary mb-1">{fieldNameByKey.get(field.field_key) || field.field_key}</p>
                        {isUrl ? (
                          <a
                            href={field.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-primary hover:underline truncate block"
                          >
                            {field.value}
                          </a>
                        ) : (
                          renderFieldPreview(field)
                        )}
                      </div>
                      {!isUrl && (
                        <button
                          onClick={() => copyToClipboard(field.value, field.field_key)}
                          className={`p-2 rounded-lg transition-colors shrink-0 ${
                            isCopied
                              ? 'text-accent-primary bg-accent-primary/10'
                              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                          }`}
                        >
                          {isCopied ? <RefreshCw className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="premium-section section-violet p-4">
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Attachments', 'Tệp đính kèm')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 bg-bg-tertiary rounded-xl p-3 border border-border-subtle group hover:border-accent-primary/30 transition-colors"
                  >
                    <div className="w-10 h-10 bg-bg-primary rounded-lg flex items-center justify-center text-text-tertiary group-hover:text-accent-primary transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate font-medium">{file.filename}</p>
                      <p className="text-[10px] text-text-tertiary uppercase">{file.mime_type?.split('/')[1] || 'FILE'} | {(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      className="p-2 text-text-tertiary hover:text-accent-primary transition-colors"
                      title={t(language, 'Download', 'Tải xuống')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-border-subtle bg-bg-tertiary/50">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">{t(language, 'Delete', 'Xóa')}</span>
          </button>
          <button onClick={() => setShowEditModal(true)} className="flex items-center gap-2 text-accent-primary hover:text-accent-primary-hover transition-colors">
            <Edit2 className="w-4 h-4" />
            <span className="text-sm">{t(language, 'Edit', 'Sửa')}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showEditModal && (
          <EditAccountModal accountId={account.id} onClose={() => { setShowEditModal(false); loadFields() }} />
        )}
        {showReauthModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowReauthModal(false)
                setPendingRevealField(null)
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-sm modal-panel border border-border-subtle rounded-2xl p-5"
            >
              <h3 className="text-sm font-semibold text-text-primary mb-2">{t(language, 'Re-authentication required', 'Cần xác thực lại')}</h3>
              <p className="text-xs text-text-tertiary mb-3">{t(language, 'Enter your password to reveal secret fields', 'Nhập mật khẩu user để xem thông tin nhạy cảm')}</p>
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary"
                placeholder={t(language, 'Password', 'Mật khẩu')}
              />
              {reauthError && <p className="text-xs text-red-400 mt-2">{reauthError}</p>}
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowReauthModal(false); setPendingRevealField(null); }} className="px-3 py-2 text-text-secondary">{t(language, 'Cancel', 'Hủy')}</button>
                <button onClick={confirmReauth} disabled={!reauthPassword} className="px-3 py-2 rounded-lg bg-accent-primary text-bg-primary disabled:opacity-50">{t(language, 'Confirm', 'Xác nhận')}</button>
              </div>
            </motion.div>
          </div>
        )}
        {confirmDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDeleteOpen(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md modal-panel border border-border-subtle rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
                  <Trash2 className="w-4 h-4" />
                </span>
                <h3 className="text-base font-semibold text-text-primary">{t(language, 'Confirm delete', 'Xác nhận xóa')}</h3>
              </div>
              <p className="text-sm text-text-secondary">{t(language, 'Are you sure you want to delete this item?', 'Bạn có chắc muốn xóa mục này không?')}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDeleteOpen(false)} className="px-3 py-2 rounded-xl bg-bg-tertiary text-text-secondary">{t(language, 'Cancel', 'Hủy')}</button>
                <button onClick={confirmDelete} className="px-3 py-2 rounded-xl bg-red-500 text-white">{t(language, 'Delete', 'Xóa')}</button>
              </div>
            </motion.div>
          </div>
        )}
        {confirmRevealField && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmRevealField(null) }}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md modal-panel border border-border-subtle rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <h3 className="text-base font-semibold text-text-primary">{t(language, 'Reveal password', 'Hiển thị mật khẩu')}</h3>
              </div>
              <p className="text-sm text-text-secondary">{t(language, 'Reveal this password?', 'Hiển thị mật khẩu này?')}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmRevealField(null)} className="px-3 py-2 rounded-xl bg-bg-tertiary text-text-secondary">{t(language, 'Cancel', 'Hủy')}</button>
                <button onClick={confirmRevealNow} className="px-3 py-2 rounded-xl bg-accent-primary text-bg-primary">{t(language, 'Confirm', 'Xác nhận')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

