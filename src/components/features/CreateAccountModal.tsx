import { useState, useEffect } from 'react'
import { useVaultStore, AccountType, FieldValue } from '../../stores/vaultStore'
import { motion } from 'framer-motion'
import { X, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'
import { SearchableSelect } from '../common/SearchableSelect'
import { DatePickerInput } from '../common/DatePickerInput'

interface CreateAccountModalProps {
  onClose: () => void
  initialTypeId?: string | null
  initialCustomerId?: string | null
}

const todayYmd = () => new Date().toISOString().slice(0, 10)
const EXPIRY_PRESETS = [
  { label: '1 ngày', days: 1 },
  { label: '1 tuần', days: 7 },
  { label: '1 tháng', days: 30 },
  { label: '3 tháng', days: 90 },
  { label: '6 tháng', days: 180 },
  { label: '1 năm', days: 365 },
  { label: '2 năm', days: 730 },
]

export function CreateAccountModal({ onClose, initialTypeId = null, initialCustomerId = null }: CreateAccountModalProps) {
  const { accountTypes, customers, fetchCustomers, createAccount, generatePassword } = useVaultStore()
  const { language } = useI18nStore()
  const [selectedType, setSelectedType] = useState<AccountType | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [name, setName] = useState('')
  const [fields, setFields] = useState<{ key: string; value: string; type: string }[]>([])
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryMode, setExpiryMode] = useState<'date' | 'preset'>('preset')
  const [expiryDate, setExpiryDate] = useState('')
  const [startDate, setStartDate] = useState(todayYmd())
  const [expiryPresetDays, setExpiryPresetDays] = useState(30)
  const [visibleFields, setVisibleFields] = useState<Set<number>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const detectAutoGroup = (key: string): 'identity' | 'connection' | 'detail' => {
    const k = key.toLowerCase()
    if (k === 'username' || k === 'user' || k === 'login' || k === 'email' || k === 'account') return 'identity'
    if (k.includes('url') || k.includes('host') || k.includes('server') || k.includes('ip') || k.includes('port') || k.includes('endpoint') || k.includes('domain') || k.includes('panel')) return 'connection'
    return 'detail'
  }

  useEffect(() => {
    if (selectedType) {
      const today = todayYmd()
      setFields(selectedType.fields.map((f) => {
        const isLifecycleDate = ['purchase_date', 'created_date', 'buy_date'].includes(f.key)
        return { key: f.key, value: isLifecycleDate ? today : '', type: f.field_type }
      }))
    }
  }, [selectedType])

  useEffect(() => {
    if (!initialTypeId) return
    const matched = accountTypes.find((t) => t.id === initialTypeId)
    if (matched) {
      setSelectedType(matched)
    }
  }, [initialTypeId, accountTypes])

  useEffect(() => {
    if (!initialCustomerId) return
    setSelectedCustomerId(initialCustomerId)
  }, [initialCustomerId])

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

  const renderDynamicField = (field: { key: string; value: string; type: string }, index: number) => {
    const def = selectedType?.fields.find((f) => f.key === field.key)
    const options = def?.options || []
    const isPassword = field.type === 'password'
    const isVisible = visibleFields.has(index)

    if (isPassword) {
      return (
        <>
          <input type={isVisible ? 'text' : 'password'} value={field.value} onChange={(e) => handleFieldChange(index, e.target.value)} placeholder={field.key} className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary font-mono" />
          <button type="button" onClick={() => toggleFieldVisibility(index)} className="p-2 text-text-tertiary hover:text-text-secondary bg-bg-tertiary rounded-lg">{isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          <button type="button" onClick={() => handleGeneratePassword(index)} className="p-2 text-text-tertiary hover:text-accent-primary bg-bg-tertiary rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        </>
      )
    }

    if (field.type === 'select') {
      return (
        <SearchableSelect
          value={field.value}
          onChange={(v) => handleFieldChange(index, v)}
          options={[{ value: '', label: 'Chọn giá trị' }, ...options.map((o) => ({ value: o, label: o }))]}
          placeholder="Chọn giá trị"
          searchPlaceholder="Tìm giá trị..."
          className="flex-1"
        />
      )
    }

    if (field.type === 'multiselect' || field.type === 'tags') {
      const selectedValues = field.value ? field.value.split(',').map((v) => v.trim()).filter(Boolean) : []
      return (
        <div className="flex-1 space-y-2">
          <SearchableSelect
            value=""
            onChange={(v) => {
              if (!v) return
              if (!selectedValues.includes(v)) handleFieldChange(index, [...selectedValues, v].join(', '))
            }}
            options={[{ value: '', label: 'Thêm giá trị' }, ...options.map((o) => ({ value: o, label: o }))]}
            placeholder="Thêm giá trị"
            searchPlaceholder="Tìm giá trị..."
          />
          <input type="text" value={field.value} onChange={(e) => handleFieldChange(index, e.target.value)} placeholder="Nhập nhiều giá trị, cách nhau dấu phẩy" className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
        </div>
      )
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex-1 flex items-center gap-2 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary">
          <input type="checkbox" checked={field.value === 'true'} onChange={(e) => handleFieldChange(index, e.target.checked ? 'true' : 'false')} />
          Bật / Tắt
        </label>
      )
    }

    if (field.type === 'date') {
      return <DatePickerInput value={field.value} onChange={(v) => handleFieldChange(index, v)} className="flex-1" />
    }

    return <input type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'} value={field.value} onChange={(e) => handleFieldChange(index, e.target.value)} placeholder={field.key} className="flex-1 bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary" />
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
          `${t(language, 'Please fill in required fields', 'Vui lòng điền các trường bắt buộc')}: ${missingFields.map((f) => f.name).join(', ')}`
        )
        return
      }
    }

    setIsCreating(true)
    setError(null)

    try {
      const fieldValues: FieldValue[] = fields
        .filter((f) => f.value.trim())
        .map((f) => ({ id: '', account_id: '', field_key: f.key, field_type: f.type, value: f.value }))

      const hasPurchaseDate = fieldValues.some((f) => f.field_key === 'purchase_date')
      const hasCreatedDate = fieldValues.some((f) => f.field_key === 'created_date')
      if (!hasPurchaseDate) fieldValues.push({ id: '', account_id: '', field_key: 'purchase_date', field_type: 'date', value: startDate })
      if (!hasCreatedDate) fieldValues.push({ id: '', account_id: '', field_key: 'created_date', field_type: 'date', value: startDate })

      const computedExpiry = hasExpiry
        ? expiryMode === 'date'
          ? (expiryDate ? new Date(`${expiryDate}T00:00:00`).toISOString() : null)
          : new Date(new Date(`${startDate}T00:00:00`).getTime() + expiryPresetDays * 24 * 60 * 60 * 1000).toISOString()
        : null

      await createAccount(name, selectedCustomerId || null, selectedType?.id || null, fieldValues, hasExpiry, computedExpiry)
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsCreating(false)
    }
  }

  const fieldDefByKey = new Map((selectedType?.fields || []).map((f) => [f.key, f]))
  const labelForField = (key: string) => fieldDefByKey.get(key)?.name || key
  const isRequiredField = (key: string) => !!fieldDefByKey.get(key)?.required
  const resolveGroup = (key: string): 'identity' | 'connection' | 'detail' => {
    const configured = fieldDefByKey.get(key)?.field_group
    if (configured === 'identity' || configured === 'connection' || configured === 'detail') return configured
    return detectAutoGroup(key)
  }
  const loginAndPasswordFields = fields.filter((f) => f.type === 'password' || ['identity', 'connection'].includes(resolveGroup(f.key)))
  const identityFields = loginAndPasswordFields.filter((f) => f.type !== 'password' && resolveGroup(f.key) === 'identity')
  const connectionFields = loginAndPasswordFields.filter((f) => f.type !== 'password' && resolveGroup(f.key) === 'connection')
  const passwordOnlyFields = loginAndPasswordFields.filter((f) => f.type === 'password')
  const otherDynamicFields = fields.filter((f) => !(f.type === 'password' || ['identity', 'connection'].includes(resolveGroup(f.key))))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-6xl max-h-[94vh] modal-panel border border-border-subtle rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-gradient-to-r from-sky-500/10 via-violet-500/5 to-emerald-500/10">
          <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Create New Item', 'Tạo mục mới')}</h2>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="premium-section section-sky p-4">
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Name', 'Tên')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t(language, 'Item name', 'Tên mục')} className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary" autoFocus />
          </div>

          <div className="premium-section section-sky p-4">
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Category', 'Danh mục')}</label>
            <SearchableSelect
              value={selectedType?.id || ''}
              onChange={(v) => setSelectedType(accountTypes.find((t) => t.id === v) || null)}
              options={accountTypes.map((type) => ({ value: type.id, label: type.name }))}
              placeholder={t(language, 'Select category', 'Chọn danh mục')}
              searchPlaceholder={t(language, 'Search category...', 'Tìm danh mục...')}
              emptyText={t(language, 'No category found', 'Không tìm thấy danh mục')}
            />
          </div>

          <div className="premium-section section-sky p-4">
            <label className="text-sm font-medium text-text-secondary mb-2 block">{t(language, 'Customer', 'Khách hàng')}</label>
            <SearchableSelect
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              options={[
                { value: '', label: t(language, 'No customer', 'Không gán khách hàng') },
                ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
              ]}
              placeholder={t(language, 'No customer', 'Không gán khách hàng')}
              searchPlaceholder={t(language, 'Search customer...', 'Tìm khách hàng...')}
              emptyText={t(language, 'No customer found', 'Không tìm thấy khách hàng')}
            />
          </div>

          <div className="space-y-3 premium-section section-emerald p-4">
            <label className="text-sm font-medium text-text-secondary block">Thông tin thời hạn</label>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Ngày tạo / ngày mua</label>
              <DatePickerInput value={startDate} onChange={setStartDate} className="w-full" />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
              Tài khoản này có thời hạn
            </label>
            {hasExpiry && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setExpiryMode('preset')} className={`px-3 py-1.5 rounded-lg text-xs ${expiryMode === 'preset' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'}`}>Theo mốc thời gian</button>
                  <button type="button" onClick={() => setExpiryMode('date')} className={`px-3 py-1.5 rounded-lg text-xs ${expiryMode === 'date' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'}`}>Chọn ngày hết hạn</button>
                </div>
                {expiryMode === 'date' ? (
                  <DatePickerInput value={expiryDate} onChange={setExpiryDate} className="w-full" />
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

          {selectedType && loginAndPasswordFields.length > 0 && (
            <div className="space-y-4 premium-section section-amber p-4">
              <h3 className="text-sm font-medium text-text-secondary">Thông tin đăng nhập & mật khẩu</h3>
              {identityFields.length > 0 && <p className="text-xs uppercase tracking-wide text-sky-300/90">Danh tính</p>}
              {identityFields.map((field) => {
                const index = fields.findIndex((f) => f.key === field.key)
                return (
                  <div key={field.key}>
                    <label className="text-xs text-text-tertiary mb-1 block">{labelForField(field.key)}{isRequiredField(field.key) && '*'}</label>
                    <div className="flex gap-2">{renderDynamicField(field, index)}</div>
                  </div>
                )
              })}
              {connectionFields.length > 0 && <p className="text-xs uppercase tracking-wide text-emerald-300/90">Kết nối</p>}
              {connectionFields.map((field) => {
                const index = fields.findIndex((f) => f.key === field.key)
                return (
                  <div key={field.key}>
                    <label className="text-xs text-text-tertiary mb-1 block">{labelForField(field.key)}{isRequiredField(field.key) && '*'}</label>
                    <div className="flex gap-2">{renderDynamicField(field, index)}</div>
                  </div>
                )
              })}
              {passwordOnlyFields.length > 0 && <p className="text-xs uppercase tracking-wide text-amber-300/90">Mật khẩu</p>}
              {passwordOnlyFields.map((field) => {
                const index = fields.findIndex((f) => f.key === field.key)
                return (
                  <div key={field.key}>
                    <label className="text-xs text-text-tertiary mb-1 block">{labelForField(field.key)}{isRequiredField(field.key) && '*'}</label>
                    <div className="flex gap-2">{renderDynamicField(field, index)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {selectedType && otherDynamicFields.length > 0 && (
            <div className="space-y-4 premium-section section-violet p-4">
              <h3 className="text-sm font-medium text-text-secondary">{t(language, 'Details', 'Chi tiết')}</h3>
              {otherDynamicFields.map((field) => {
                const index = fields.findIndex((f) => f.key === field.key)
                return (
                  <div key={field.key}>
                    <label className="text-xs text-text-tertiary mb-1 block">{labelForField(field.key)}{isRequiredField(field.key) && '*'}</label>
                    <div className="flex gap-2">{renderDynamicField(field, index)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {error && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-sm lg:col-span-2">{error}</motion.p>}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-6 border-t border-border-subtle bg-bg-secondary/95 backdrop-blur">
          <button onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary">{t(language, 'Cancel', 'Hủy')}</button>
          <button onClick={handleSubmit} disabled={isCreating || !name.trim()} className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-bg-primary font-medium rounded-xl flex items-center gap-2">
            {isCreating ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t(language, 'Creating...', 'Đang tạo...')}</> : <><Plus className="w-4 h-4" /> {t(language, 'Create', 'Tạo')}</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

