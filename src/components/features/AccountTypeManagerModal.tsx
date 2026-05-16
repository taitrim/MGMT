import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Download, Plus, Trash2, Upload, X } from 'lucide-react'
import { FieldDefinition, useVaultStore } from '../../stores/vaultStore'

interface Props {
  onClose: () => void
}

const FIELD_TYPES = ['text', 'textarea', 'password', 'url', 'number', 'checkbox', 'date', 'email', 'select', 'multiselect', 'tags', 'totp', 'sshkey']

const emptyField = (): FieldDefinition => ({
  key: '',
  name: '',
  field_type: 'text',
  required: false,
  encrypted: true,
  options: null,
})

export function AccountTypeManagerModal({ onClose }: Props) {
  const {
    accountTypes,
    createAccountType,
    updateAccountType,
    deleteAccountType,
    getAccountTypeFieldUsageCount,
    exportAccountTypeTemplates,
    importAccountTypeTemplates,
  } = useVaultStore()

  const [selectedId, setSelectedId] = useState<string | null>(accountTypes[0]?.id || null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('#22c55e')
  const [fields, setFields] = useState<FieldDefinition[]>([emptyField()])
  const [error, setError] = useState<string | null>(null)

  const selectedType = useMemo(() => accountTypes.find((t) => t.id === selectedId) || null, [accountTypes, selectedId])

  useEffect(() => {
    if (!selectedType) return
    setName(selectedType.name)
    setIcon(selectedType.icon || '')
    setColor(selectedType.color || '#22c55e')
    setFields(selectedType.fields.length ? selectedType.fields : [emptyField()])
  }, [selectedType])

  const resetNew = () => {
    setSelectedId(null)
    setName('')
    setIcon('')
    setColor('#22c55e')
    setFields([emptyField()])
    setError(null)
  }

  const save = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Vui lòng nhập tên loại tài khoản')
      return
    }

    const cleaned = fields
      .filter((f) => f.key.trim() && f.name.trim())
      .map((f) => ({
        ...f,
        key: f.key.trim(),
        name: f.name.trim(),
        options: (f.field_type === 'select' || f.field_type === 'multiselect')
          ? (f.options || []).map((o) => o.trim()).filter(Boolean)
          : null,
      }))

    if (cleaned.length === 0) {
      setError('Cần ít nhất 1 trường thông tin')
      return
    }

    if (selectedId) {
      await updateAccountType(selectedId, name.trim(), icon || null, color || null, cleaned)
    } else {
      await createAccountType(name.trim(), icon || null, color || null, cleaned)
    }
    onClose()
  }

  const remove = async () => {
    if (!selectedId) return
    if (selectedType?.is_builtin) {
      setError('Không thể xóa loại tài khoản có sẵn trong hệ thống')
      return
    }
    await deleteAccountType(selectedId)
    resetNew()
  }

  const handleExportTemplates = async () => {
    const path = window.prompt('Nhập đường dẫn file JSON để xuất template:', 'C:\\templates\\account-types.json')
    if (!path) return
    await exportAccountTypeTemplates(path)
    setError('Đã xuất template thành công')
  }

  const handleImportTemplates = async () => {
    const path = window.prompt('Nhập đường dẫn file JSON để nhập template:', 'C:\\templates\\account-types.json')
    if (!path) return
    const imported = await importAccountTypeTemplates(path)
    setError(`Đã nhập ${imported} template`)
  }

  const duplicateCurrent = () => {
    if (!selectedType) return
    setSelectedId(null)
    setName(`${name} Copy`)
    setFields(fields.map((f) => ({ ...f, options: f.options ? [...f.options] : null })))
    setError(null)
  }

  const removeFieldAt = async (index: number) => {
    const field = fields[index]
    if (!field) return
    if (selectedId && field.key.trim()) {
      const usage = await getAccountTypeFieldUsageCount(selectedId, field.key.trim())
      if (usage > 0) {
        const ok = window.confirm(`Trường "${field.name || field.key}" đang có dữ liệu ở ${usage} mục. Xóa trường này có thể làm mất liên kết hiển thị. Bạn có chắc chắn?`)
        if (!ok) return
      }
    }
    setFields((prev) => prev.filter((_, idx) => idx !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-5xl h-[88vh] bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex">
        <div className="w-80 border-r border-border-subtle p-4 space-y-2 overflow-y-auto">
          <button onClick={resetNew} className="w-full px-3 py-2 rounded-lg bg-accent-primary text-bg-primary text-sm">+ Tạo loại mới</button>
          <button onClick={duplicateCurrent} disabled={!selectedId} className="w-full px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Copy className="w-4 h-4" /> Nhân bản
          </button>
          <button onClick={handleExportTemplates} className="w-full px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary text-sm flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Xuất template
          </button>
          <button onClick={handleImportTemplates} className="w-full px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary text-sm flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" /> Nhập template
          </button>
          {accountTypes.map((t) => (
            <button key={t.id} onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedId === t.id ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover'}`}>
              <div className="flex items-center justify-between">
                <span>{t.name}</span>
                {t.is_builtin && <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary">Mặc định</span>}
              </div>
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary">Quản lý mẫu thông tin tài khoản</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên loại" className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2" />
              <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon (tùy chọn)" className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2" />
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#22c55e" className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2" />
            </div>
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={i} className="space-y-2 bg-bg-primary/30 border border-border-subtle rounded-xl p-3">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={f.key} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                      placeholder="field_key" className="col-span-2 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2" />
                    <input value={f.name} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Tên hiển thị" className="col-span-3 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2" />
                    <select value={f.field_type} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, field_type: e.target.value } : x))}
                      className="col-span-3 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2">
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label className="col-span-2 text-xs text-text-secondary"><input type="checkbox" checked={f.required} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, required: e.target.checked } : x))} /> Bắt buộc</label>
                    <label className="col-span-1 text-xs text-text-secondary"><input type="checkbox" checked={f.encrypted} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, encrypted: e.target.checked } : x))} /> Mã hoá</label>
                    <button onClick={() => removeFieldAt(i)} className="col-span-1 p-2 text-red-400 hover:bg-bg-hover rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {(f.field_type === 'select' || f.field_type === 'multiselect') && (
                    <textarea
                      value={(f.options || []).join(', ')}
                      onChange={(e) => {
                        const opts = e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                        setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, options: opts } : x))
                      }}
                      placeholder="Danh sách lựa chọn, cách nhau dấu phẩy. Ví dụ: Production, Staging, Dev"
                      className="w-full min-h-16 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2 text-sm"
                    />
                  )}
                </div>
              ))}
              <button onClick={() => setFields((prev) => [...prev, emptyField()])}
                className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Thêm trường
              </button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
          <div className="p-4 border-t border-border-subtle flex justify-between">
            <button onClick={remove} disabled={!selectedId || !!selectedType?.is_builtin} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 disabled:opacity-40">Xóa loại</button>
            <button onClick={save} className="px-4 py-2 rounded-lg bg-accent-primary text-bg-primary">Lưu</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

