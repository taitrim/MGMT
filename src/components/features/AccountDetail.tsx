import { useState, useEffect } from 'react'
import { Account, FieldValue, useVaultStore } from '../../stores/vaultStore'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Copy, Eye, EyeOff, Star, Trash2, Edit2, Key, RefreshCw, FileText, Download } from 'lucide-react'
import { TOTPViewer } from './TOTPViewer'
import { EditAccountModal } from './EditAccountModal'
import { invoke } from '@tauri-apps/api/core'
import { copyToClipboardSecure } from '../../utils/clipboard'
import { t, useI18nStore } from '../../stores/i18nStore'

interface AccountDetailProps {
  account: Account
  onClose: () => void
}

export function AccountDetail({ account, onClose }: AccountDetailProps) {
  const { getAccountFields, deleteAccount, updateAccount, accountTypes } = useVaultStore()
  const { language } = useI18nStore()
  const [fields, setFields] = useState<FieldValue[]>([])
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasTotp, setHasTotp] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadFields()
  }, [account.id])

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
      const ok = confirm(t(language, 'Reveal this password?', 'Hiển thị mật khẩu này?'))
      if (!ok) return
      newVisible.add(fieldKey)
    }
    setVisibleFields(newVisible)
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
    if (!confirm(t(language, 'Are you sure you want to delete this item?', 'Bạn có chắc muốn xóa mục này không?'))) return
    setIsDeleting(true)
    await deleteAccount(account.id)
    onClose()
  }

  const accountType = accountTypes.find(t => t.id === account.account_type_id)
  const fieldNameByKey = new Map((accountType?.fields || []).map((f) => [f.key, f.name]))
  const loginAddressFields = fields.filter((f) =>
    ['url', 'hostname', 'host', 'ip_address', 'endpoint', 'panel_url'].includes(f.field_key)
  )
  const passwordFields = fields.filter(f => f.field_type === 'password')
  const otherFields = fields.filter(
    (f) =>
      f.field_type !== 'password' &&
      !['url', 'hostname', 'host', 'ip_address', 'endpoint', 'panel_url'].includes(f.field_key)
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center">
              <Key className="w-6 h-6 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{account.name}</h2>
              <p className="text-sm text-text-tertiary">{accountType?.name || 'Login'}</p>
              {account.has_expiry && account.expires_at && (
                <p className="text-xs text-amber-400 mt-1">
                  {t(language, 'Expires on', 'Hết hạn vào')}: {new Date(account.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="p-6 space-y-6">
          {hasTotp && (
            <div>
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Two-Factor Authentication', 'Xác thực hai lớp')}</h3>
              <TOTPViewer accountId={account.id} />
            </div>
          )}

          {loginAddressFields.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Login Access', 'Địa chỉ đăng nhập')}</h3>
              <div className="space-y-3">
                {loginAddressFields.map((field) => (
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
            </div>
          )}

          {passwordFields.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-tertiary mb-3">{t(language, 'Passwords', 'Mat khau')}</h3>
              <p className="text-xs text-text-tertiary mb-2">{t(language, 'For safety, revealing password requires confirmation.', 'Để an toàn, khi hiện mật khẩu sẽ cần xác nhận.')}</p>
              <div className="space-y-3">
                {passwordFields.map((field) => {
                  const isVisible = visibleFields.has(field.field_key)
                  const isCopied = copiedField === field.field_key

                  return (
                    <div
                      key={field.field_key}
                      className="flex items-center gap-3 bg-bg-tertiary rounded-xl p-3"
                    >
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
            </div>
          )}

          {otherFields.length > 0 && (
            <div>
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
                          <p className="text-text-primary truncate">{field.value}</p>
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
            <div>
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
            <span className="text-sm">{t(language, 'Edit', 'Sua')}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showEditModal && (
          <EditAccountModal accountId={account.id} onClose={() => { setShowEditModal(false); loadFields() }} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

