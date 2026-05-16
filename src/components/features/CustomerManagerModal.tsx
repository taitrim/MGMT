import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'
import { Customer, useVaultStore } from '../../stores/vaultStore'
import { t, useI18nStore } from '../../stores/i18nStore'

interface CustomerManagerModalProps {
  onClose: () => void
}

export function CustomerManagerModal({ onClose }: CustomerManagerModalProps) {
  const { language } = useI18nStore()
  const { customers, fetchCustomers, createCustomer, deleteCustomer } = useVaultStore()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    if (!confirm(`${t(language, 'Delete customer', 'Xóa khách hàng')}: ${customer.name}?`)) return
    await deleteCustomer(customer.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden bg-bg-secondary border border-border-subtle rounded-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-xl font-semibold text-text-primary">{t(language, 'Customer Management', 'Quản lý khách hàng')}</h2>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-border-subtle space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(language, 'Customer name', 'Tên khách hàng')} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t(language, 'Contact', 'Liên hệ')} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t(language, 'Notes', 'Ghi chú')} className="bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-text-primary" />
          </div>
          <div className="flex items-center justify-between">
            {error ? <p className="text-sm text-red-400">{error}</p> : <div />}
            <button onClick={handleCreate} className="px-4 py-2 bg-accent-primary text-bg-primary rounded-xl flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t(language, 'Add customer', 'Thêm khách hàng')}
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto space-y-2">
          {customers.length === 0 ? (
            <p className="text-text-tertiary text-sm">{t(language, 'No customers yet', 'Chưa có khách hàng')}</p>
          ) : (
            customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-bg-tertiary rounded-xl p-3 border border-border-subtle">
                <div className="min-w-0">
                  <p className="text-text-primary font-medium truncate">{c.name}</p>
                  <p className="text-xs text-text-tertiary truncate">{c.contact || c.notes || '-'}</p>
                </div>
                <button onClick={() => handleDelete(c)} className="p-2 text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}

