import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { FieldDefinition, useVaultStore } from '../../stores/vaultStore'

interface Props {
  onClose: () => void
}

const emptyField = (): FieldDefinition => ({
  key: '',
  name: '',
  field_type: 'text',
  required: false,
  encrypted: true,
  options: null,
})

export function AccountTypeManagerModal({ onClose }: Props) {
  const { accountTypes, createAccountType, updateAccountType, deleteAccountType, getAccountTypeFieldUsageCount } = useVaultStore()
  const editableTypes = useMemo(() => accountTypes.filter((t) => !t.is_builtin), [accountTypes])
  const [selectedId, setSelectedId] = useState<string | null>(editableTypes[0]?.id || null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('#22c55e')
  const [fields, setFields] = useState<FieldDefinition[]>([emptyField()])
  const [error, setError] = useState<string | null>(null)

  const loadType = (id: string) => {
    const t = editableTypes.find((x) => x.id === id)
    if (!t) return
    setSelectedId(id)
    setName(t.name)
    setIcon(t.icon || '')
    setColor(t.color || '#22c55e')
    setFields(t.fields.length ? t.fields : [emptyField()])
  }

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
      setError('Vui long nhap ten loai tai khoan')
      return
    }
    const cleaned = fields
      .filter((f) => f.key.trim() && f.name.trim())
      .map((f) => ({ ...f, key: f.key.trim(), name: f.name.trim() }))
    if (cleaned.length === 0) {
      setError('Can it nhat 1 truong')
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
    await deleteAccountType(selectedId)
    resetNew()
  }

  const duplicateCurrent = () => {
    if (!selectedId) return
    setSelectedId(null)
    setName(`${name} Copy`)
    setFields(fields.map((f) => ({ ...f })))
    setError(null)
  }

  const removeFieldAt = async (index: number) => {
    const field = fields[index]
    if (!field) return
    if (selectedId && field.key.trim()) {
      const usage = await getAccountTypeFieldUsageCount(selectedId, field.key.trim())
      if (usage > 0) {
        const ok = window.confirm(
          `Truong "${field.name || field.key}" dang co du lieu o ${usage} tai khoan. Xoa truong nay co the mat lien ket du lieu. Ban co chac muon xoa khong?`
        )
        if (!ok) return
      }
    }
    setFields((prev) => prev.filter((_, idx) => idx !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl h-[85vh] bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex">
        <div className="w-72 border-r border-border-subtle p-4 space-y-2">
          <button onClick={resetNew} className="w-full px-3 py-2 rounded-lg bg-accent-primary text-bg-primary text-sm">+ New Type</button>
          <button onClick={duplicateCurrent} disabled={!selectedId} className="w-full px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Copy className="w-4 h-4" /> Duplicate
          </button>
          {editableTypes.map((t) => (
            <button key={t.id} onClick={() => loadType(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedId === t.id ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover'}`}>
              {t.name}
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
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type name" className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2" />
              <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon (optional)" className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2" />
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#22c55e" className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2" />
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={f.key} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                    placeholder="field_key" className="col-span-2 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2" />
                  <input value={f.name} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Field name" className="col-span-3 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2" />
                  <select value={f.field_type} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, field_type: e.target.value } : x))}
                    className="col-span-2 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-2">
                    {['text', 'textarea', 'password', 'url', 'number', 'email', 'date', 'sshkey'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="col-span-2 text-xs text-text-secondary"><input type="checkbox" checked={f.required} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, required: e.target.checked } : x))} /> Required</label>
                  <label className="col-span-2 text-xs text-text-secondary"><input type="checkbox" checked={f.encrypted} onChange={(e) => setFields((prev) => prev.map((x, idx) => idx === i ? { ...x, encrypted: e.target.checked } : x))} /> Encrypted</label>
                  <button onClick={() => removeFieldAt(i)} className="col-span-1 p-2 text-red-400 hover:bg-bg-hover rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setFields((prev) => [...prev, emptyField()])}
                className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add field
              </button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
          <div className="p-4 border-t border-border-subtle flex justify-between">
            <button onClick={remove} disabled={!selectedId} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 disabled:opacity-40">Delete Type</button>
            <button onClick={save} className="px-4 py-2 rounded-lg bg-accent-primary text-bg-primary">Save</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
