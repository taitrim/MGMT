import { useMemo, useState } from 'react'
import { Customer, Account, useVaultStore } from '../../stores/vaultStore'
import { Building2, Mail, Plus, StickyNote, Users } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'
import { AccountList } from './AccountList'

interface CustomerDetailPanelProps {
  customers: Customer[]
  selectedCustomerId: string
  onSelectCustomer: (id: string) => void
  accounts: Account[]
  onSelectAccount: (account: Account) => void
  onOpenManageCustomers: () => void
}

export function CustomerDetailPanel({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  accounts,
  onSelectAccount,
  onOpenManageCustomers,
}: CustomerDetailPanelProps) {
  const { language } = useI18nStore()
  const { accountTypes } = useVaultStore()
  const [customerQuery, setCustomerQuery] = useState('')
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null
  const typeNameMap = new Map(accountTypes.map((t) => [t.id, t.name]))
  const typeColorMap = new Map(accountTypes.map((t) => [t.id, t.color || '#22c55e']))

  const typeStats = accounts.reduce<Record<string, number>>((acc, account) => {
    const key = account.account_type_id || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.contact || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    )
  }, [customers, customerQuery])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full">
      <section className="xl:col-span-1 bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{t(language, 'Customers', 'Khách hàng')}</h3>
            <button
              onClick={onOpenManageCustomers}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25"
            >
              <Plus className="w-3 h-3" />
              {t(language, 'Add customer', 'Thêm khách hàng')}
            </button>
          </div>
        </div>
        <div className="p-3 space-y-2 overflow-auto">
          <input
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder={t(language, 'Search customer...', 'Tìm khách hàng...')}
            className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary"
          />
          {customers.length === 0 ? (
            <p className="text-sm text-text-tertiary">{t(language, 'No customers yet', 'Chua có khách hàng')}</p>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer(customer.id)}
                className={`w-full text-left rounded-xl p-3 border transition-colors ${
                  selectedCustomerId === customer.id
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-subtle bg-bg-tertiary hover:border-border-default'
                }`}
              >
                <p className="text-sm font-medium text-text-primary truncate">{customer.name}</p>
                <p className="text-xs text-text-tertiary truncate">{customer.contact || customer.notes || '-'}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="xl:col-span-2 bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex flex-col">
        {!selectedCustomer ? (
          <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
            {t(language, 'Select a customer to view accounts', 'Ch?n khách hàng d? xem tài kho?n')}
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border-subtle space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent-primary" />
                <h3 className="text-lg font-semibold text-text-primary">{selectedCustomer.name}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3">
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {t(language, 'Accounts', 'Tài kho?n')}
                  </p>
                  <p className="text-xl font-semibold text-text-primary">{accounts.length}</p>
                </div>
                <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3">
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {t(language, 'Contact', 'Liên h?')}
                  </p>
                  <p className="text-sm text-text-primary truncate">{selectedCustomer.contact || '-'}</p>
                </div>
                <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3">
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    {t(language, 'Notes', 'Ghi chú')}
                  </p>
                  <p className="text-sm text-text-primary truncate">{selectedCustomer.notes || '-'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(typeStats).length === 0 ? (
                  <span className="text-xs text-text-tertiary">{t(language, 'No account data', 'Không có d? li?u tài kho?n')}</span>
                ) : (
                  Object.entries(typeStats).map(([typeId, count]) => (
                    <span
                      key={typeId}
                      className="px-2 py-1 rounded-lg text-xs border"
                      style={{
                        borderColor: `${typeColorMap.get(typeId) || '#22c55e'}66`,
                        backgroundColor: `${typeColorMap.get(typeId) || '#22c55e'}1a`,
                        color: typeColorMap.get(typeId) || '#22c55e',
                      }}
                    >
                      {typeNameMap.get(typeId) || typeId}: {count}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <AccountList accounts={accounts} viewMode="list" onSelectAccount={onSelectAccount} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
