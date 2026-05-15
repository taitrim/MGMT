import { useState, useEffect } from 'react'
import { useVaultStore, FieldValue } from '../../stores/vaultStore'
import { motion } from 'framer-motion'
import { X, Save, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'

interface EditAccountModalProps {
  accountId: string
  onClose: () => void
}

export function EditAccountModal({ accountId, onClose }: EditAccountModalProps) {
  const { updateAccount, getAccountFields, accountTypes, accounts, generatePassword } = useVaultStore()
  const { language } = useI18nStore()
  const [name, setName] = useState('')
  const [fields, setFields] = useState<FieldValue[]>([])
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const account = accounts.find(a => a.id === accountId)
  const accountType = accountTypes.find(t => t.id === account?.account_type_id)
  const fieldNameByKey = new Map((accountType?.fields || []).map((f) => [f.key, f.name]))

  useEffect(() => {
    if (account) {
      setName(account.name)
      setHasExpiry(!!account.has_expiry)
      setExpiresAt(account.expires_at ? account.expires_at.slice(0, 10) : '')
      loadFields()
    }
  }, [accountId])

  const loadFields = async () => {
    const data = await getAccountFields(accountId)
    setFields(data)
    // Auto-hide password fields
    const hiddenPasswords = new Set(data.filter(f => f.field_type === 'password').map(f => f.field_key))
    setVisibleFields(hiddenPasswords)
  }

  const toggleFieldVisibility = (fieldKey: string) => {
    const newVisible = new Set(visibleFields)
    if (newVisible.has(fieldKey)) {
      newVisible.delete(fieldKey)
    } else {
      newVisible.add(fieldKey)
    }
    setVisibleFields(newVisible)
  }

  const handleFieldChange = (fieldKey: string, value: string) => {
    setFields(prev => prev.map(f => f.field_key === fieldKey ? { ...f, value } : f))
  }

  const handleGeneratePassword = async () => {
    const password = await generatePassword(24, true)
    const passwordField = fields.find(f => f.field_type === 'password')
    if (passwordField) {
      handleFieldChange(passwordField.field_key, password)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t(language, 'Name is required', 'Ten la bat buoc'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const dirtyFields = fields.filter(f => f.value.trim().length > 0)
      await updateAccount(
        accountId,
        {
          name,
          has_expiry: hasExpiry,
          expires_at: hasExpiry && expiresAt ? new Date(`${expiresAt}T00:00:00`).toISOString() : null
        },
        dirtyFields.length > 0 ? dirtyFields : undefined
      )
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const passwordFields = fields.filter(f => f.field_type === 'password')
  const otherFields = fields.filter(f => f.field_type !== 'password')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[90vh] bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Edit', 'Sửa')} {account?.name || t(language, 'Item', 'Mục')}</h2>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Name', 'Ten')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-primary transition-colors" />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
              {t(language, 'This account has expiration', 'Tài khoản này có thời hạn')}
            </label>
            {hasExpiry && (
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary"
              />
            )}
          </div>

          {passwordFields.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary">{t(language, 'Passwords', 'Mat khau')}</h3>
              {passwordFields.map(field => {
                const isVisible = visibleFields.has(field.field_key)
                return (
                  <div key={field.field_key}>
                    <label className="text-xs text-text-tertiary mb-1 block capitalize">{field.field_key}</label>
                    <div className="flex gap-2">
                      <input type={isVisible ? 'text' : 'password'} value={field.value}
                        onChange={e => handleFieldChange(field.field_key, e.target.value)}
                        className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary font-mono focus:outline-none focus:border-accent-primary transition-colors" />
                      <button onClick={() => toggleFieldVisibility(field.field_key)}
                        className="p-2 text-text-tertiary hover:text-text-secondary bg-bg-tertiary rounded-lg transition-colors">
                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={handleGeneratePassword}
                        className="p-2 text-text-tertiary hover:text-accent-primary bg-bg-tertiary rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {otherFields.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary">{t(language, 'Details', 'Chi tiết')}</h3>
              {otherFields.map(field => (
                <div key={field.field_key}>
                  <label className="text-xs text-text-tertiary mb-1 block">{fieldNameByKey.get(field.field_key) || field.field_key}</label>
                  {field.field_type === 'textarea' ? (
                    <textarea
                      value={field.value}
                      onChange={e => handleFieldChange(field.field_key, e.target.value)}
                      className="w-full min-h-24 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                    />
                  ) : (
                    <input
                      type={
                        field.field_type === 'email' ? 'email' :
                        field.field_type === 'url' ? 'url' :
                        field.field_type === 'number' ? 'number' :
                        field.field_type === 'date' ? 'date' :
                        'text'
                      }
                      value={field.value}
                      onChange={e => handleFieldChange(field.field_key, e.target.value)}
                      className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-border-subtle">
          <button onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors">{t(language, 'Cancel', 'Hủy')}</button>
          <button onClick={handleSubmit} disabled={isSaving || !name.trim()}
            className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg-primary font-medium rounded-xl transition-colors flex items-center gap-2">
            {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t(language, 'Saving...', 'Đang lưu...')}</> : <><Save className="w-4 h-4" /> {t(language, 'Save', 'Lưu')}</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

