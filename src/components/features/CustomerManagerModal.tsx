import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Trash2, Save, Pencil } from 'lucide-react'
import { Customer, useVaultStore } from '../../stores/vaultStore'
import { t, useI18nStore } from '../../stores/i18nStore'

interface CustomerManagerModalProps {
  onClose: () => void
}

export function CustomerManagerModal({ onClose }: CustomerManagerModalProps) {
  const { language } = useI18nStore()
  const { customers, fetchCustomers, createCustomer, updateCustomer, deleteCustomer } = useVaultStore()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingContact, setEditingContact] = useState('')
  const [editingNotes, setEditingNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t(language, 'Customer name is required', 'Tên khách hàng là bắt buộc'))
      return
    }
    try {
      await createCustomer(name.trim(), contact.trim() || undefined, notes.trim() || undefined)
      setName('')
      setContact('')
      setNotes('')
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (customer: Customer) => {
    setDeleteTarget(customer)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteCustomer(deleteTarget.id)
    setDeleteTarget(null)
  }

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id)
    setEditingName(customer.name)
    setEditingContact(customer.contact || '')
    setEditingNotes(customer.notes || '')
  }

  const saveEdit = async () => {
    if (!editingId) return
    if (!editingName.trim()) {
      setError(t(language, 'Customer name is required', 'Tên khách hàng là bắt buộc'))
      return
    }
    try {
      await updateCustomer(editingId, editingName.trim(), editingContact.trim() || undefined, editingNotes.trim() || undefined)
      setEditingId(null)
      setEditingName('')
      setEditingContact('')
      setEditingNotes('')
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden modal-panel border border-border-subtle rounded-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-gradient-to-r from-sky-500/10 via-emerald-500/5 to-violet-500/10">
          <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Customer Management', 'Quản lý khách hàng')}</h2>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-border-subtle space-y-3 premium-section section-sky mx-4 mt-4 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(language, 'Customer name', 'Tên khách hàng')} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t(language, 'Contact', 'Liên hệ')} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t(language, 'Notes', 'Ghi chú')} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <button onClick={handleCreate} className="px-4 py-2 bg-accent-primary text-bg-primary rounded-xl flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              {t(language, 'Add customer', 'Thêm khách hàng')}
            </button>
          </div>
          <div className="flex items-center justify-between">
            {error ? <p className="text-sm text-red-400">{error}</p> : <div />}
            <div />
          </div>
        </div>

        <div className="p-6 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {customers.length === 0 ? (
            <p className="text-text-tertiary text-sm">{t(language, 'No customers yet', 'Chưa có khách hàng')}</p>
          ) : (
            customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-bg-tertiary rounded-xl p-3 border border-border-subtle h-fit">
                {editingId === c.id ? (
                  <div className="w-full space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
                      <input value={editingContact} onChange={(e) => setEditingContact(e.target.value)} className="bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
                      <input value={editingNotes} onChange={(e) => setEditingNotes(e.target.value)} className="bg-bg-primary border border-border-subtle rounded-lg px-2 py-1 text-sm text-text-primary" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-text-secondary">{t(language, 'Cancel', 'Hủy')}</button>
                      <button onClick={saveEdit} className="px-2 py-1 text-xs rounded bg-accent-primary text-bg-primary flex items-center gap-1">
                        <Save className="w-3 h-3" />
                        {t(language, 'Save', 'Lưu')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="text-text-primary font-medium truncate">{c.name}</p>
                      <p className="text-xs text-text-tertiary truncate">{c.contact || c.notes || '-'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(c)} className="p-2 text-amber-400 hover:text-amber-300">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-2 text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md modal-panel border border-border-subtle rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
                <Trash2 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-semibold text-text-primary">{t(language, 'Delete customer', 'Xóa khách hàng')}</h3>
            </div>
            <p className="text-sm text-text-secondary">{deleteTarget.name}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-2 rounded-xl bg-bg-tertiary text-text-secondary">{t(language, 'Cancel', 'Hủy')}</button>
              <button onClick={confirmDelete} className="px-3 py-2 rounded-xl bg-red-500 text-white">{t(language, 'Delete', 'Xóa')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

