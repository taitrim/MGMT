import { useState, useEffect } from 'react'
import { useVaultStore, FieldValue } from '../../stores/vaultStore'
import { motion } from 'framer-motion'
import { X, Save, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'
import { SearchableSelect } from '../common/SearchableSelect'
import { DatePickerInput } from '../common/DatePickerInput'

interface EditAccountModalProps {
  accountId: string
  onClose: () => void
}

const EXPIRY_PRESETS = [
  { label: '1 ngày', days: 1 },
  { label: '1 tuần', days: 7 },
  { label: '1 tháng', days: 30 },
  { label: '3 tháng', days: 90 },
  { label: '6 tháng', days: 180 },
  { label: '1 năm', days: 365 },
  { label: '2 năm', days: 730 },
]

export function EditAccountModal({ accountId, onClose }: EditAccountModalProps) {
  const { updateAccount, getAccountFields, accountTypes, accounts, generatePassword } = useVaultStore()
  const { language } = useI18nStore()
  const [name, setName] = useState('')
  const [fields, setFields] = useState<FieldValue[]>([])
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryMode, setExpiryMode] = useState<'date' | 'preset'>('date')
  const [expiresAt, setExpiresAt] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [expiryPresetDays, setExpiryPresetDays] = useState(30)
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const account = accounts.find((a) => a.id === accountId)
  const accountType = accountTypes.find((t) => t.id === account?.account_type_id)
  const fieldNameByKey = new Map((accountType?.fields || []).map((f) => [f.key, f.name]))
  const fieldGroupByKey = new Map((accountType?.fields || []).map((f) => [f.key, f.field_group || null]))

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
    const purchaseField = data.find((f) => f.field_key === 'purchase_date')?.value
    const createdField = data.find((f) => f.field_key === 'created_date')?.value
    setStartDate((purchaseField || createdField || new Date().toISOString().slice(0, 10)).slice(0, 10))
    setFields(data)
  }

  const toggleFieldVisibility = (fieldKey: string) => {
    const newVisible = new Set(visibleFields)
    if (newVisible.has(fieldKey)) newVisible.delete(fieldKey)
    else newVisible.add(fieldKey)
    setVisibleFields(newVisible)
  }

  const handleFieldChange = (fieldKey: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.field_key === fieldKey ? { ...f, value } : f)))
  }

  const handleGeneratePassword = async () => {
    const password = await generatePassword(24, true)
    const passwordField = fields.find((f) => f.field_type === 'password')
    if (passwordField) handleFieldChange(passwordField.field_key, password)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t(language, 'Name is required', 'Tên là bắt buộc'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      let dirtyFields = fields.filter((f) => f.value.trim().length > 0)
      const purchaseField = dirtyFields.find((f) => f.field_key === 'purchase_date')
      const createdField = dirtyFields.find((f) => f.field_key === 'created_date')
      if (!purchaseField) dirtyFields = [...dirtyFields, { id: '', account_id: accountId, field_key: 'purchase_date', field_type: 'date', value: startDate }]
      if (!createdField) dirtyFields = [...dirtyFields, { id: '', account_id: accountId, field_key: 'created_date', field_type: 'date', value: startDate }]

      const computedExpiresAt = hasExpiry
        ? expiryMode === 'date'
          ? (expiresAt ? new Date(`${expiresAt}T00:00:00`).toISOString() : null)
          : new Date(new Date(`${startDate}T00:00:00`).getTime() + expiryPresetDays * 24 * 60 * 60 * 1000).toISOString()
        : null

      await updateAccount(
        accountId,
        { name, has_expiry: hasExpiry, expires_at: computedExpiresAt },
        dirtyFields.length > 0 ? dirtyFields : undefined
      )
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const renderDynamicField = (field: FieldValue) => {
    const def = accountType?.fields.find((f) => f.key === field.field_key)
    const options = def?.options || []

    if (field.field_type === 'select') {
      return (
        <SearchableSelect
          value={field.value}
          onChange={(v) => handleFieldChange(field.field_key, v)}
          options={[{ value: '', label: 'Chọn giá trị' }, ...options.map((o) => ({ value: o, label: o }))]}
          placeholder="Chọn giá trị"
          searchPlaceholder="Tìm giá trị..."
        />
      )
    }

    if (field.field_type === 'multiselect' || field.field_type === 'tags') {
      return (
        <div className="space-y-2">
          <SearchableSelect
            value=""
            onChange={(v) => {
              if (!v) return
              const selectedValues = field.value ? field.value.split(',').map((x) => x.trim()).filter(Boolean) : []
              if (!selectedValues.includes(v)) handleFieldChange(field.field_key, [...selectedValues, v].join(', '))
            }}
            options={[{ value: '', label: 'Thêm giá trị' }, ...options.map((o) => ({ value: o, label: o }))]}
            placeholder="Thêm giá trị"
            searchPlaceholder="Tìm giá trị..."
          />
          <input type="text" value={field.value} onChange={(e) => handleFieldChange(field.field_key, e.target.value)} className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
        </div>
      )
    }

    if (field.field_type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary">
          <input type="checkbox" checked={field.value === 'true'} onChange={(e) => handleFieldChange(field.field_key, e.target.checked ? 'true' : 'false')} />
          Bật / Tắt
        </label>
      )
    }

    if (field.field_type === 'date') {
      return <DatePickerInput value={field.value} onChange={(v) => handleFieldChange(field.field_key, v)} />
    }
    return <input type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : field.field_type === 'number' ? 'number' : 'text'} value={field.value} onChange={(e) => handleFieldChange(field.field_key, e.target.value)} className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
  }

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
  const passwordFields = fields.filter((f) => f.field_type === 'password')
  const otherFields = fields.filter((f) => f.field_type !== 'password')
  const loginIdentityFields = otherFields.filter((f) => {
    const g = resolveGroup(f.field_key)
    return g === 'identity' || g === 'connection'
  })
  const identityFields = loginIdentityFields.filter((f) => resolveGroup(f.field_key) === 'identity')
  const connectionFields = loginIdentityFields.filter((f) => resolveGroup(f.field_key) === 'connection')
  const remainingOtherFields = otherFields.filter((f) => resolveGroup(f.field_key) === 'detail')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-6xl max-h-[94vh] modal-panel border border-border-subtle rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-gradient-to-r from-sky-500/10 via-violet-500/5 to-emerald-500/10">
          <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Edit', 'Sửa')} {account?.name || t(language, 'Item', 'Mục')}</h2>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="premium-section section-sky p-4">
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Name', 'Tên')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary" />
          </div>

          <div className="space-y-2 premium-section section-emerald p-4">
            <label className="text-xs text-text-tertiary">Ngày tạo / ngày mua</label>
            <DatePickerInput value={startDate} onChange={setStartDate} className="w-full" />
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
              Tài khoản này có thời hạn
            </label>
            {hasExpiry && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setExpiryMode('preset')} className={`px-3 py-1.5 rounded-lg text-xs ${expiryMode === 'preset' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'}`}>Theo mốc</button>
                  <button type="button" onClick={() => setExpiryMode('date')} className={`px-3 py-1.5 rounded-lg text-xs ${expiryMode === 'date' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'}`}>Chọn ngày</button>
                </div>
                {expiryMode === 'date' ? (
                  <DatePickerInput value={expiresAt} onChange={setExpiresAt} className="w-full" />
                ) : (
                  <SearchableSelect
                    value={String(expiryPresetDays)}
                    onChange={(v) => setExpiryPresetDays(Number(v))}
                    options={EXPIRY_PRESETS.map((p) => ({ value: String(p.days), label: p.label }))}
                    searchPlaceholder="Tìm mốc thời gian..."
                  />
                )}
              </div>
            )}
          </div>

          {(passwordFields.length > 0 || loginIdentityFields.length > 0) && (
            <div className="space-y-3 premium-section section-amber p-4">
              <h3 className="text-sm font-medium text-text-secondary">{t(language, 'Login & Password', 'Thông tin đăng nhập & mật khẩu')}</h3>
              {identityFields.length > 0 && <p className="text-xs uppercase tracking-wide text-sky-300/90">Danh tính</p>}
              {identityFields.map((field) => (
                <div key={field.field_key}>
                  <label className="text-xs text-text-tertiary mb-1 block">{fieldNameByKey.get(field.field_key) || field.field_key}</label>
                  {renderDynamicField(field)}
                </div>
              ))}
              {connectionFields.length > 0 && <p className="text-xs uppercase tracking-wide text-emerald-300/90">Kết nối</p>}
              {connectionFields.map((field) => (
                <div key={field.field_key}>
                  <label className="text-xs text-text-tertiary mb-1 block">{fieldNameByKey.get(field.field_key) || field.field_key}</label>
                  {renderDynamicField(field)}
                </div>
              ))}
              {passwordFields.map((field) => {
                const isVisible = visibleFields.has(field.field_key)
                return (
                  <div key={field.field_key}>
                    <label className="text-xs text-text-tertiary mb-1 block capitalize">{fieldNameByKey.get(field.field_key) || field.field_key}</label>
                    <div className="flex gap-2">
                      <input type={isVisible ? 'text' : 'password'} value={field.value} onChange={(e) => handleFieldChange(field.field_key, e.target.value)} className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary font-mono" />
                      <button onClick={() => toggleFieldVisibility(field.field_key)} className="p-2 text-text-tertiary hover:text-text-secondary bg-bg-tertiary rounded-lg">{isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      <button onClick={handleGeneratePassword} className="p-2 text-text-tertiary hover:text-accent-primary bg-bg-tertiary rounded-lg"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {remainingOtherFields.length > 0 && (
            <div className="space-y-3 premium-section section-violet p-4">
              <h3 className="text-sm font-medium text-text-secondary">{t(language, 'Details', 'Chi tiết')}</h3>
              {remainingOtherFields.map((field) => (
                <div key={field.field_key}>
                  <label className="text-xs text-text-tertiary mb-1 block">{fieldNameByKey.get(field.field_key) || field.field_key}</label>
                  {renderDynamicField(field)}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-6 border-t border-border-subtle bg-bg-secondary/95 backdrop-blur">
          <button onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary">{t(language, 'Cancel', 'Hủy')}</button>
          <button onClick={handleSubmit} disabled={isSaving || !name.trim()} className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-bg-primary font-medium rounded-xl flex items-center gap-2">
            {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t(language, 'Saving...', 'Đang lưu...')}</> : <><Save className="w-4 h-4" /> {t(language, 'Save', 'Lưu')}</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

