import { useState, useEffect } from 'react'
import { useVaultStore, AccountType, FieldValue } from '../../stores/vaultStore'
import { motion } from 'framer-motion'
import { X, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'

interface CreateAccountModalProps {
  onClose: () => void
}

export function CreateAccountModal({ onClose }: CreateAccountModalProps) {
  const { accountTypes, customers, fetchCustomers, createAccount, generatePassword } = useVaultStore()
  const { language } = useI18nStore()
  const [selectedType, setSelectedType] = useState<AccountType | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [name, setName] = useState('')
  const [fields, setFields] = useState<{ key: string; value: string; type: string }[]>([])
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryMode, setExpiryMode] = useState<'date' | 'preset'>('date')
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryPresetDays, setExpiryPresetDays] = useState(30)
  const [visibleFields, setVisibleFields] = useState<Set<number>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedType) {
      setFields(selectedType.fields.map((f) => ({ key: f.key, value: '', type: f.field_type })))
    }
  }, [selectedType])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleGeneratePassword = async (index: number) => {
    const password = await generatePassword(24, true)
    const next = [...fields]
    next[index].value = password
    setFields(next)
  }

  const toggleFieldVisibility = (index: number) => {
    const next = new Set(visibleFields)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setVisibleFields(next)
  }

  const handleFieldChange = (index: number, value: string) => {
    const next = [...fields]
    next[index].value = value
    setFields(next)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t(language, 'Please enter a name', 'Vui lòng nhập tên'))
      return
    }

    if (selectedType) {
      const requiredFields = selectedType.fields.filter((f) => f.required)
      const missingFields = requiredFields.filter((f) => {
        const field = fields.find((fi) => fi.key === f.key)
        return !field?.value.trim()
      })

      if (missingFields.length > 0) {
        setError(
          `${t(language, 'Please fill in required fields', 'Vui lòng điền các trường bắt buộc')}: ${missingFields
            .map((f) => f.name)
            .join(', ')}`
        )
        return
      }
    }

    setIsCreating(true)
    setError(null)

    try {
      const fieldValues: FieldValue[] = fields
        .filter((f) => f.value.trim())
        .map((f) => ({
          id: '',
          account_id: '',
          field_key: f.key,
          field_type: f.type,
          value: f.value,
        }))

      const computedExpiry =
        hasExpiry
          ? expiryMode === 'date'
            ? (expiryDate ? new Date(`${expiryDate}T00:00:00`).toISOString() : null)
            : new Date(Date.now() + expiryPresetDays * 24 * 60 * 60 * 1000).toISOString()
          : null

      await createAccount(
        name,
        selectedCustomerId || null,
        selectedType?.id || null,
        fieldValues,
        hasExpiry,
        computedExpiry
      )
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[90vh] bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Create New Item', 'Tạo mục mới')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Name', 'Tên')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(language, 'Item name', 'Tên mục')}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Category', 'Danh mục')}</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {accountTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    selectedType?.id === type.id
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-subtle bg-bg-tertiary text-text-secondary hover:border-border-default'
                  }`}
                >
                  <span className="text-xs">{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Customer', 'Khách hàng')}</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
            >
              <option value="">{t(language, 'No customer', 'Không gán khách hàng')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-text-secondary block">{t(language, 'Expiration', 'Thời hạn')}</label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
              {t(language, 'This account has expiration', 'Tài khoản này có thời hạn')}
            </label>
            {hasExpiry && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setExpiryMode('date')} className={`px-3 py-1.5 rounded-lg text-xs ${expiryMode === 'date' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'}`}>{t(language, 'Pick date', 'Chọn ngày')}</button>
                  <button type="button" onClick={() => setExpiryMode('preset')} className={`px-3 py-1.5 rounded-lg text-xs ${expiryMode === 'preset' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'}`}>{t(language, 'Preset', 'Theo mốc thời gian')}</button>
                </div>
                {expiryMode === 'date' ? (
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
                ) : (
                  <select value={expiryPresetDays} onChange={(e) => setExpiryPresetDays(Number(e.target.value))} className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary">
                    <option value={7}>7 {t(language, 'days', 'ngày')}</option>
                    <option value={30}>30 {t(language, 'days', 'ngày')}</option>
                    <option value={60}>60 {t(language, 'days', 'ngày')}</option>
                    <option value={90}>90 {t(language, 'days', 'ngày')}</option>
                    <option value={180}>180 {t(language, 'days', 'ngày')}</option>
                    <option value={365}>365 {t(language, 'days', 'ngày')}</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {selectedType && fields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">{t(language, 'Details', 'Chi tiết')}</h3>
              {fields.map((field, index) => {
                const isPassword = field.type === 'password'
                const isVisible = visibleFields.has(index)

                return (
                  <div key={field.key}>
                    <label className="text-xs text-text-tertiary mb-1 block">
                      {selectedType.fields.find((f) => f.key === field.key)?.name || field.key}{' '}
                      {selectedType.fields.find((f) => f.key === field.key)?.required && '*'}
                    </label>
                    <div className="flex gap-2">
                      {isPassword ? (
                        <>
                          <input
                            type={isVisible ? 'text' : 'password'}
                            value={field.value}
                            onChange={(e) => handleFieldChange(index, e.target.value)}
                            placeholder={field.key}
                            className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => toggleFieldVisibility(index)}
                            className="p-2 text-text-tertiary hover:text-text-secondary bg-bg-tertiary rounded-lg transition-colors"
                          >
                            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGeneratePassword(index)}
                            className="p-2 text-text-tertiary hover:text-accent-primary bg-bg-tertiary rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <input
                          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                          value={field.value}
                          onChange={(e) => handleFieldChange(index, e.target.value)}
                          placeholder={field.key}
                          className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-sm">
              {error}
            </motion.p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-border-subtle">
          <button onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors">
            {t(language, 'Cancel', 'Hủy')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isCreating || !name.trim()}
            className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg-primary font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t(language, 'Creating...', 'Đang tạo...')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t(language, 'Create', 'Tạo')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
