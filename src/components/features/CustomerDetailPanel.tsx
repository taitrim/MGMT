import { Customer, Account, useVaultStore } from '../../stores/vaultStore'
import { Building2, Mail, StickyNote, Users } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'
import { AccountList } from './AccountList'

interface CustomerDetailPanelProps {
  customers: Customer[]
  selectedCustomerId: string
  onSelectCustomer: (id: string) => void
  accounts: Account[]
  onSelectAccount: (account: Account) => void
}

export function CustomerDetailPanel({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  accounts,
  onSelectAccount,
}: CustomerDetailPanelProps) {
  const { language } = useI18nStore()
  const { accountTypes } = useVaultStore()
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null
  const typeNameMap = new Map(accountTypes.map((t) => [t.id, t.name]))
  const typeColorMap = new Map(accountTypes.map((t) => [t.id, t.color || '#22c55e']))

  const typeStats = accounts.reduce<Record<string, number>>((acc, account) => {
    const key = account.account_type_id || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full">
      <section className="xl:col-span-1 bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-text-primary">{t(language, 'Customers', 'Khách hàng')}</h3>
        </div>
        <div className="p-3 space-y-2 overflow-auto">
          {customers.length === 0 ? (
            <p className="text-sm text-text-tertiary">{t(language, 'No customers yet', 'Chưa có khách hàng')}</p>
          ) : (
            customers.map((customer) => (
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
            {t(language, 'Select a customer to view accounts', 'Chọn khách hàng để xem tài khoản')}
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
                    {t(language, 'Accounts', 'Tài khoản')}
                  </p>
                  <p className="text-xl font-semibold text-text-primary">{accounts.length}</p>
                </div>
                <div className="bg-bg-tertiary border border-border-subtle rounded-xl p-3">
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {t(language, 'Contact', 'Liên hệ')}
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
                  <span className="text-xs text-text-tertiary">{t(language, 'No account data', 'Không có dữ liệu tài khoản')}</span>
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
