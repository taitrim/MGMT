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
import { AccessUserManagerModal } from '../components/features/AccessUserManagerModal'
import { AnimatePresence } from 'framer-motion'

export function Dashboard() {
  const { lock, extendSession, checkSession, storageInfo, loadStorageInfo, dbHealth, checkDbHealth, currentAccessUser } = useAuthStore()
  const {
    accounts,
    customers,
    accountTypes,
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
  const [showAccessUserModal, setShowAccessUserModal] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCustomerId, setBulkCustomerId] = useState('')
  const [bulkTag, setBulkTag] = useState('')
  const [bulkExpiryDays, setBulkExpiryDays] = useState(30)
  const isOwnerOrAdmin = !currentAccessUser || currentAccessUser.role === 'owner' || currentAccessUser.role === 'admin'
  const canCreateAccount = !currentAccessUser || currentAccessUser.role === 'owner' || currentAccessUser.role === 'admin' || currentAccessUser.can_create_account

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
  const allowedCategories = currentAccessUser?.category_permissions || []
  const canAccessAll = allowedCategories.includes('all') || allowedCategories.length === 0
  const visibleAccounts = canAccessAll
    ? accounts
    : accounts.filter((a) => (a.account_type_id ? allowedCategories.includes(a.account_type_id) : true))
  filteredAccounts = visibleAccounts

  if (activeCategory === 'favorites') {
    filteredAccounts = filteredAccounts.filter((a) => a.favorite)
  } else if (activeCategory === 'expiring') {
    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    filteredAccounts = filteredAccounts.filter((a) => a.has_expiry && a.expires_at && new Date(a.expires_at) >= now && new Date(a.expires_at) <= sevenDaysLater)
  } else if (activeCategory === 'expired') {
    const now = new Date()
    filteredAccounts = filteredAccounts.filter((a) => a.has_expiry && a.expires_at && new Date(a.expires_at) < now)
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
  const expiringByCustomer = customers.map((c) => ({
    id: c.id,
    name: c.name,
    count: accounts.filter((a) => a.customer_id === c.id && a.has_expiry && a.expires_at && new Date(a.expires_at) >= now && new Date(a.expires_at) <= sevenDaysLater).length,
  })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const typeDistribution = accounts.reduce<Record<string, number>>((acc, account) => {
    const key = account.account_type_id || 'other'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const topTypes = Object.entries(typeDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const maxTypeCount = topTypes.length > 0 ? Math.max(...topTypes.map((x) => x[1])) : 1
  const typeNameMap = new Map(accountTypes.map((t) => [t.id, t.name]))
  const typeColorMap = new Map(accountTypes.map((t) => [t.id, t.color || '#22c55e']))

  const toggleSelected = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const clearSelected = () => setSelectedIds(new Set())

  const applyBulkCustomer = async () => {
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await useVaultStore.getState().updateAccount(id, { customer_id: bulkCustomerId || null })
    }
    await fetchAccounts()
    clearSelected()
  }

  const applyBulkTag = async () => {
    if (!bulkTag.trim()) return
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      const account = accounts.find((a) => a.id === id)
      if (!account) continue
      const tags = Array.from(new Set([...(account.tags || []), bulkTag.trim()]))
      await useVaultStore.getState().updateAccount(id, { tags })
    }
    await fetchAccounts()
    clearSelected()
  }

  const applyBulkExpiry = async () => {
    const ids = Array.from(selectedIds)
    const expiresAt = new Date(Date.now() + bulkExpiryDays * 24 * 60 * 60 * 1000).toISOString()
    for (const id of ids) {
      await useVaultStore.getState().updateAccount(id, { has_expiry: true, expires_at: expiresAt })
    }
    await fetchAccounts()
    clearSelected()
  }

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
        onManageAccessUsers={() => setShowAccessUserModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        canManageAccessUsers={isOwnerOrAdmin}
        canManageSecurity={isOwnerOrAdmin}
        canCreateAccount={canCreateAccount}
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
          <div className="mb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-bg-secondary border border-border-subtle rounded-xl p-4">
              <p className="text-sm text-text-secondary mb-3">Tổng quan tài khoản theo loại</p>
              <div className="space-y-2">
                {topTypes.length === 0 && <p className="text-xs text-text-tertiary">Chưa có dữ liệu</p>}
                {topTypes.map(([typeId, count]) => (
                  <div key={typeId} className="space-y-1">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>{typeNameMap.get(typeId) || typeId}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{ backgroundColor: typeColorMap.get(typeId) || '#22c55e', width: `${Math.max(8, Math.round((count / maxTypeCount) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-subtle rounded-xl p-4">
              <p className="text-sm text-text-secondary mb-3">Trạng thái thời hạn</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg-tertiary rounded-lg p-3 border border-border-subtle">
                  <p className="text-xs text-text-tertiary">Hết hạn</p>
                  <p className="text-xl font-semibold text-red-400">{expiredCount}</p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 border border-border-subtle">
                  <p className="text-xs text-text-tertiary">Sắp hết hạn</p>
                  <p className="text-xl font-semibold text-amber-400">{expiringSoonCount}</p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 border border-border-subtle">
                  <p className="text-xs text-text-tertiary">Còn hạn / không hạn</p>
                  <p className="text-xl font-semibold text-emerald-400">{Math.max(0, accounts.length - expiredCount - expiringSoonCount)}</p>
                </div>
              </div>
            </div>
          </div>

          {expiringByCustomer.length > 0 && activeCategory !== 'customers' && (
            <div className="mb-4 bg-bg-secondary border border-border-subtle rounded-xl p-3">
              <p className="text-sm text-text-secondary mb-2">Sắp hết hạn theo khách hàng</p>
              <div className="flex flex-wrap gap-2">
                {expiringByCustomer.map((item) => (
                  <button key={item.id} onClick={() => { setActiveCategory('customers'); setSelectedCustomerId(item.id) }} className="px-2 py-1 text-xs rounded-lg bg-amber-500/10 text-amber-300">
                    {item.name}: {item.count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="mb-4 bg-bg-secondary border border-border-subtle rounded-xl p-3 space-y-2">
              <p className="text-sm text-text-secondary">Thao tác hàng loạt ({selectedIds.size} mục)</p>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={bulkCustomerId} onChange={(e) => setBulkCustomerId(e.target.value)} className="bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-sm">
                  <option value="">Không gán khách hàng</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={applyBulkCustomer} className="px-2 py-1 rounded bg-bg-tertiary text-text-secondary">Áp dụng khách hàng</button>
                <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="Thêm tag mới" className="bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-sm" />
                <button onClick={applyBulkTag} className="px-2 py-1 rounded bg-bg-tertiary text-text-secondary">Thêm tag</button>
                <select value={bulkExpiryDays} onChange={(e) => setBulkExpiryDays(Number(e.target.value))} className="bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-sm">
                  <option value={1}>1 ngày</option>
                  <option value={7}>1 tuần</option>
                  <option value={30}>1 tháng</option>
                  <option value={90}>3 tháng</option>
                  <option value={180}>6 tháng</option>
                  <option value={365}>1 năm</option>
                  <option value={730}>2 năm</option>
                </select>
                <button onClick={applyBulkExpiry} className="px-2 py-1 rounded bg-bg-tertiary text-text-secondary">Đặt thời hạn</button>
                <button onClick={clearSelected} className="px-2 py-1 rounded bg-red-500/20 text-red-300">Bỏ chọn</button>
              </div>
            </div>
          )}

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
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
            />
          ) : null}
        </main>
      </div>

      <AnimatePresence>
        {showCreateModal && <CreateAccountModal onClose={() => setShowCreateModal(false)} />}
        {showCustomerModal && <CustomerManagerModal onClose={() => setShowCustomerModal(false)} />}
        {showTypeModal && <AccountTypeManagerModal onClose={() => setShowTypeModal(false)} />}
        {showAccessUserModal && <AccessUserManagerModal onClose={() => setShowAccessUserModal(false)} />}
        {showSettingsModal && <AppSettingsModal onClose={() => setShowSettingsModal(false)} />}
      </AnimatePresence>
    </div>
  )
}
