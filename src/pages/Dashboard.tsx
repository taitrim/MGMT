import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useVaultStore } from '../stores/vaultStore'
import { Sidebar } from '../components/layout/Sidebar'
import { Header } from '../components/layout/Header'
import { AccountList } from '../components/features/AccountList'
import { AccountDetail } from '../components/features/AccountDetail'
import { CreateAccountModal } from '../components/features/CreateAccountModal'
import { CustomerManagerModal } from '../components/features/CustomerManagerModal'
import { CustomerDetailPanel } from '../components/features/CustomerDetailPanel'
import { AccountTypeManagerModal } from '../components/features/AccountTypeManagerModal'
import { AppSettingsModal } from '../components/features/AppSettingsModal'
import { AnimatePresence } from 'framer-motion'

export function Dashboard() {
  const { lock, extendSession, checkSession, storageInfo, loadStorageInfo, dbHealth, checkDbHealth } = useAuthStore()
  const {
    accounts,
    customers,
    selectedAccount,
    fetchAccounts,
    fetchAccountTypes,
    fetchCustomers,
    fetchStats,
    searchAccounts,
    stats,
  } = useVaultStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  useEffect(() => {
    fetchAccounts()
    fetchAccountTypes()
    fetchCustomers()
    fetchStats()
    loadStorageInfo()
    checkDbHealth()

    const interval = setInterval(() => {
      extendSession()
    }, 5 * 60 * 1000)

    const sessionCheck = setInterval(() => {
      checkSession()
    }, 30 * 1000)

    return () => {
      clearInterval(interval)
      clearInterval(sessionCheck)
    }
  }, [fetchAccounts, fetchAccountTypes, fetchCustomers, fetchStats, extendSession, checkSession, loadStorageInfo, checkDbHealth])

  useEffect(() => {
    if (activeCategory === 'customers' && !selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id)
    }
  }, [activeCategory, selectedCustomerId, customers])

  let filteredAccounts = accounts

  if (activeCategory === 'favorites') {
    filteredAccounts = filteredAccounts.filter((a) => a.favorite)
  } else if (activeCategory === 'my_accounts') {
    filteredAccounts = filteredAccounts.filter((a) => !a.customer_id)
  } else if (activeCategory === 'customers') {
    filteredAccounts = selectedCustomerId
      ? filteredAccounts.filter((a) => a.customer_id === selectedCustomerId)
      : filteredAccounts.filter((a) => !!a.customer_id)
  } else if (activeCategory !== 'all') {
    filteredAccounts = filteredAccounts.filter((a) => a.account_type_id === activeCategory)
  }

  const customerAccounts =
    activeCategory === 'customers'
      ? (selectedCustomerId
          ? filteredAccounts.filter((a) => a.customer_id === selectedCustomerId)
          : [])
      : []

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        await fetchAccounts()
        return
      }
      await searchAccounts(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchAccounts, fetchAccounts])

  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const expiredCount = accounts.filter((a) => a.has_expiry && a.expires_at && new Date(a.expires_at) < now).length
  const expiringSoonCount = accounts.filter((a) => a.has_expiry && a.expires_at && new Date(a.expires_at) >= now && new Date(a.expires_at) <= sevenDaysLater).length

  return (
    <div className="h-screen w-screen flex bg-bg-primary overflow-hidden">
      <Sidebar
        stats={stats}
        storageInfo={storageInfo}
        dbHealth={dbHealth}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onCreateAccount={() => setShowCreateModal(true)}
        onManageCustomers={() => setShowCustomerModal(true)}
        onManageTypes={() => setShowTypeModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onLock={lock}
          expiringSoonCount={expiringSoonCount}
          expiredCount={expiredCount}
        />

        <main className="flex-1 overflow-auto p-6">
          {activeCategory === 'customers' && !selectedAccount && (
            <CustomerDetailPanel
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
              accounts={customerAccounts}
              onSelectAccount={(account) => useVaultStore.getState().selectAccount(account)}
            />
          )}

          {selectedAccount ? (
            <AccountDetail account={selectedAccount} onClose={() => useVaultStore.getState().selectAccount(null)} />
          ) : activeCategory !== 'customers' ? (
            <AccountList
              accounts={filteredAccounts}
              viewMode={viewMode}
              onSelectAccount={(account) => useVaultStore.getState().selectAccount(account)}
            />
          ) : null}
        </main>
      </div>

      <AnimatePresence>
        {showCreateModal && <CreateAccountModal onClose={() => setShowCreateModal(false)} />}
        {showCustomerModal && <CustomerManagerModal onClose={() => setShowCustomerModal(false)} />}
        {showTypeModal && <AccountTypeManagerModal onClose={() => setShowTypeModal(false)} />}
        {showSettingsModal && <AppSettingsModal onClose={() => setShowSettingsModal(false)} />}
      </AnimatePresence>
    </div>
  )
}
