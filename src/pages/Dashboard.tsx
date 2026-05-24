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
import { AnimatePresence, motion } from 'framer-motion'
import { SearchableSelect } from '../components/common/SearchableSelect'

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
    exportVaultVersioned,
    stats,
    isLoading,
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
  const [filterTag, setFilterTag] = useState('')
  const [filterUpdater, setFilterUpdater] = useState('')
  const [filterExpiryState, setFilterExpiryState] = useState<'all' | 'expired' | 'expiring_30' | 'active'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const isOwnerOrAdmin = !currentAccessUser || currentAccessUser.role === 'owner' || currentAccessUser.role === 'admin'
  const canCreateAccount = !currentAccessUser || currentAccessUser.role === 'owner' || currentAccessUser.role === 'admin' || currentAccessUser.can_create_account
  const categoryTypeIds = new Set(accountTypes.map((t) => t.id))
  const createInitialTypeId = categoryTypeIds.has(activeCategory) ? activeCategory : null
  const createInitialCustomerId = activeCategory === 'customers' ? (selectedCustomerId || null) : null

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
    const enabled = localStorage.getItem('auto_backup_enabled') === '1'
    const backupDir = (localStorage.getItem('auto_backup_dir') || '').trim()
    const minutes = Math.max(10, Number(localStorage.getItem('auto_backup_minutes') || '60'))
    if (!enabled || !backupDir) return
    const interval = setInterval(async () => {
      try {
        await exportVaultVersioned(backupDir, 10)
      } catch (e) {
        console.error('Auto backup failed:', e)
      }
    }, minutes * 60 * 1000)
    return () => clearInterval(interval)
  }, [exportVaultVersioned])

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

  const availableTags = Array.from(new Set(visibleAccounts.flatMap((a) => a.tags || []).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const availableUpdaters = Array.from(new Set(visibleAccounts.map((a) => a.updated_by_access_user_name || 'Master'))).sort((a, b) => a.localeCompare(b))

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

  if (filterTag) {
    filteredAccounts = filteredAccounts.filter((a) => (a.tags || []).includes(filterTag))
  }
  if (filterUpdater) {
    filteredAccounts = filteredAccounts.filter((a) => (a.updated_by_access_user_name || 'Master') === filterUpdater)
  }
  if (filterExpiryState !== 'all') {
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    filteredAccounts = filteredAccounts.filter((a) => {
      if (!a.has_expiry || !a.expires_at) return filterExpiryState === 'active'
      const d = new Date(a.expires_at)
      if (filterExpiryState === 'expired') return d < now
      if (filterExpiryState === 'expiring_30') return d >= now && d <= thirtyDaysLater
      return d > now
    })
  }
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
  const customerNameMap = new Map(customers.map((c) => [c.id, c.name]))
  const totalItems = filteredAccounts.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedAccounts = filteredAccounts.slice((safePage - 1) * pageSize, safePage * pageSize)
  const groupedAccounts = pagedAccounts.reduce<Record<string, Record<string, typeof pagedAccounts>>>((acc, item) => {
    const customerKey = item.customer_id ? (customerNameMap.get(item.customer_id) || 'Khách hàng khác') : 'Tài khoản cá nhân'
    const typeKey = item.account_type_id || 'other'
    if (!acc[customerKey]) acc[customerKey] = {}
    if (!acc[customerKey][typeKey]) acc[customerKey][typeKey] = []
    acc[customerKey][typeKey].push(item)
    return acc
  }, {})
  const groupedCustomerEntries = Object.entries(groupedAccounts).sort((a, b) => a[0].localeCompare(b[0]))

  const toggleSelected = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const clearSelected = () => setSelectedIds(new Set())

  useEffect(() => {
    setCurrentPage(1)
  }, [activeCategory, searchQuery, filterTag, filterUpdater, filterExpiryState, pageSize, selectedCustomerId])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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
            <div className="surface-card p-4">
              <p className="text-sm text-text-secondary mb-3">Tổng quan tài khoản theo loại</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {topTypes.length === 0 && <p className="text-xs text-text-tertiary">Chưa có dữ liệu</p>}
                {topTypes.map(([typeId, count]) => (
                  <div key={typeId} className="soft-chip p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary truncate pr-2">{typeNameMap.get(typeId) || typeId}</span>
                      <span className="text-text-primary font-semibold">{count}</span>
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

            <div className="surface-card p-4">
              <p className="text-sm text-text-secondary mb-3">Trạng thái thời hạn</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="soft-chip p-3">
                  <p className="text-xs text-text-tertiary">Hết hạn</p>
                  <p className="text-xl font-semibold text-red-400">{expiredCount}</p>
                </div>
                <div className="soft-chip p-3">
                  <p className="text-xs text-text-tertiary">Sắp hết hạn</p>
                  <p className="text-xl font-semibold text-amber-400">{expiringSoonCount}</p>
                </div>
                <div className="soft-chip p-3">
                  <p className="text-xs text-text-tertiary">Còn hạn / không hạn</p>
                  <p className="text-xl font-semibold text-emerald-400">{Math.max(0, accounts.length - expiredCount - expiringSoonCount)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 surface-card p-3">
            <p className="text-sm text-text-secondary mb-2">Bộ lọc nâng cao</p>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="min-w-48">
                <SearchableSelect
                  value={filterTag}
                  onChange={setFilterTag}
                  options={[{ value: '', label: 'Tất cả tag' }, ...availableTags.map((tag) => ({ value: tag, label: tag }))]}
                  placeholder="Tất cả tag"
                  searchPlaceholder="Tìm tag..."
                />
              </div>
              <div className="min-w-56">
                <SearchableSelect
                  value={filterUpdater}
                  onChange={setFilterUpdater}
                  options={[
                    { value: '', label: 'Tất cả người cập nhật' },
                    ...availableUpdaters.map((u) => ({ value: u, label: u })),
                  ]}
                  placeholder="Tất cả người cập nhật"
                  searchPlaceholder="Tìm người cập nhật..."
                  emptyText="Không có kết quả"
                  className=""
                />
              </div>
              <div className="min-w-64">
                <SearchableSelect
                  value={filterExpiryState}
                  onChange={(v) => setFilterExpiryState(v as 'all' | 'expired' | 'expiring_30' | 'active')}
                  options={[
                    { value: 'all', label: 'Mọi trạng thái hạn' },
                    { value: 'expired', label: 'Đã hết hạn' },
                    { value: 'expiring_30', label: 'Sắp hết hạn (30 ngày)' },
                    { value: 'active', label: 'Còn hạn / không hạn' },
                  ]}
                  searchPlaceholder="Tìm trạng thái..."
                />
              </div>
              <button onClick={() => { setFilterTag(''); setFilterUpdater(''); setFilterExpiryState('all') }} className="px-2 py-1 rounded soft-chip text-text-secondary hover:text-text-primary">
                Xóa lọc
              </button>
            </div>
          </div>

          {expiringByCustomer.length > 0 && activeCategory !== 'customers' && (
            <div className="mb-4 surface-card p-3">
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
            <div className="mb-4 surface-card p-3 space-y-2">
              <p className="text-sm text-text-secondary">Thao tác hàng loạt ({selectedIds.size} mục)</p>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="min-w-56">
                  <SearchableSelect
                    value={bulkCustomerId}
                    onChange={setBulkCustomerId}
                    options={[
                      { value: '', label: 'Không gán khách hàng' },
                      ...customers.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    placeholder="Không gán khách hàng"
                    searchPlaceholder="Tìm khách hàng..."
                    emptyText="Không có khách hàng"
                  />
                </div>
                <button onClick={applyBulkCustomer} className="px-2 py-1 rounded bg-bg-tertiary text-text-secondary">Áp dụng khách hàng</button>
                <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="Thêm tag mới" className="bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-sm" />
                <button onClick={applyBulkTag} className="px-2 py-1 rounded bg-bg-tertiary text-text-secondary">Thêm tag</button>
                <div className="min-w-48">
                  <SearchableSelect
                    value={String(bulkExpiryDays)}
                    onChange={(v) => setBulkExpiryDays(Number(v))}
                    options={[
                      { value: '1', label: '1 ngày' },
                      { value: '7', label: '1 tuần' },
                      { value: '30', label: '1 tháng' },
                      { value: '90', label: '3 tháng' },
                      { value: '180', label: '6 tháng' },
                      { value: '365', label: '1 năm' },
                      { value: '730', label: '2 năm' },
                    ]}
                    searchPlaceholder="Tìm mốc thời gian..."
                  />
                </div>
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
              onOpenManageCustomers={() => setShowCustomerModal(true)}
            />
          )}

          {isLoading && !selectedAccount ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="surface-card p-4 space-y-3 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-bg-tertiary" />
                  <div className="h-4 w-2/3 rounded bg-bg-tertiary" />
                  <div className="h-3 w-1/2 rounded bg-bg-tertiary" />
                  <div className="h-3 w-4/5 rounded bg-bg-tertiary" />
                </div>
              ))}
            </motion.div>
          ) : activeCategory !== 'customers' ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}-${filterTag}-${filterUpdater}-${filterExpiryState}-${viewMode}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <div className="space-y-4">
                  {groupedCustomerEntries.map(([customerName, typeGroups]) => (
                    <div key={customerName} className="surface-card p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-text-primary">{customerName}</h3>
                        <span className="text-xs text-text-tertiary">
                          {Object.values(typeGroups).reduce((sum, arr) => sum + arr.length, 0)} mục
                        </span>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(typeGroups)
                          .sort((a, b) => (typeNameMap.get(a[0]) || a[0]).localeCompare(typeNameMap.get(b[0]) || b[0]))
                          .map(([typeId, items]) => (
                            <div key={`${customerName}-${typeId}`} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: typeColorMap.get(typeId) || '#22c55e' }}
                                />
                                <p className="text-xs font-medium text-text-secondary">
                                  {typeNameMap.get(typeId) || (typeId === 'other' ? 'Khác' : typeId)}
                                </p>
                                <span className="text-[11px] text-text-tertiary">({items.length})</span>
                              </div>
                              <AccountList
                                accounts={items}
                                viewMode={viewMode}
                                onSelectAccount={(account) => useVaultStore.getState().selectAccount(account)}
                                selectedIds={selectedIds}
                                onToggleSelected={toggleSelected}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null}

          {!isLoading && !selectedAccount && activeCategory !== 'customers' && totalItems > 0 && (
            <div className="mt-4 surface-card p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-secondary">
                Hiển thị {Math.min((safePage - 1) * pageSize + 1, totalItems)} - {Math.min(safePage * pageSize, totalItems)} / {totalItems}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-secondary">Giới hạn:</label>
                <SearchableSelect
                  value={String(pageSize)}
                  onChange={(v) => setPageSize(Number(v))}
                  options={[
                    { value: '12', label: '12 / trang' },
                    { value: '24', label: '24 / trang' },
                    { value: '48', label: '48 / trang' },
                    { value: '96', label: '96 / trang' },
                  ]}
                  searchPlaceholder="Chọn giới hạn..."
                  className="w-36"
                />
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-subtle text-text-secondary disabled:opacity-50"
                >
                  Trước
                </button>
                <span className="text-sm text-text-secondary">Trang {safePage}/{totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-subtle text-text-secondary disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {selectedAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                useVaultStore.getState().selectAccount(null)
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-7xl max-h-[94vh] overflow-y-auto"
            >
              <AccountDetail account={selectedAccount} onClose={() => useVaultStore.getState().selectAccount(null)} />
            </motion.div>
          </div>
        )}
        {showCreateModal && (
          <CreateAccountModal
            initialTypeId={createInitialTypeId}
            initialCustomerId={createInitialCustomerId}
            onClose={() => setShowCreateModal(false)}
          />
        )}
        {showCustomerModal && <CustomerManagerModal onClose={() => setShowCustomerModal(false)} />}
        {showTypeModal && <AccountTypeManagerModal onClose={() => setShowTypeModal(false)} />}
        {showAccessUserModal && <AccessUserManagerModal onClose={() => setShowAccessUserModal(false)} />}
        {showSettingsModal && <AppSettingsModal onClose={() => setShowSettingsModal(false)} />}
      </AnimatePresence>
    </div>
  )
}
