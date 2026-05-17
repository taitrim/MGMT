import { VaultStats } from '../../stores/vaultStore'
import {
  Shield,
  Plus,
  Server,
  Database,
  Key,
  Cloud,
  Terminal,
  Mail,
  Globe,
  FileKey,
  Folder,
  Star,
  AlertTriangle,
  Clock3,
  History,
  Settings,
  SlidersHorizontal,
  Router,
  Users,
  UserCircle2,
} from 'lucide-react'
import { useState } from 'react'
import { AuditLogModal } from '../features/AuditLogModal'
import { AnimatePresence } from 'framer-motion'
import { t, useI18nStore } from '../../stores/i18nStore'

interface SidebarProps {
  stats: VaultStats | null
  storageInfo: {
    mode: string
    db_path: string
  } | null
  dbHealth: {
    exists: boolean
    quick_ok: boolean
    integrity_ok: boolean
  } | null
  activeCategory: string
  onCategoryChange: (id: string) => void
  onCreateAccount: () => void
  onManageCustomers: () => void
  onManageTypes: () => void
  onManageAccessUsers: () => void
  onOpenSettings: () => void
  canManageAccessUsers?: boolean
  canManageSecurity?: boolean
  canCreateAccount?: boolean
}

const navItems = [
  { id: 'all', en: 'All Items', vi: 'Tất cả mục', icon: Folder },
  { id: 'favorites', en: 'Favorites', vi: 'Yêu thích', icon: Star },
  { id: 'expiring', en: 'Expiring Soon', vi: 'Sắp hết hạn', icon: Clock3 },
  { id: 'expired', en: 'Expired', vi: 'Đã hết hạn', icon: AlertTriangle },
  { id: 'my_accounts', en: 'My Accounts', vi: 'Tài khoản của tôi', icon: UserCircle2 },
  { id: 'customers', en: 'Customers', vi: 'Khách hàng', icon: Users },
  { id: 'server', en: 'Servers', vi: 'Máy chủ', icon: Server },
  { id: 'database', en: 'Databases', vi: 'Cơ sở dữ liệu', icon: Database },
  { id: 'ssh', en: 'SSH', vi: 'SSH', icon: Terminal },
  { id: 'website', en: 'Websites', vi: 'Website', icon: Globe },
  { id: 'router', en: 'Routers', vi: 'Router', icon: Router },
  { id: 'cloud', en: 'Cloud', vi: 'Dịch vụ mây', icon: Cloud },
  { id: 'email', en: 'Email', vi: 'Email', icon: Mail },
  { id: 'outlook', en: 'Outlook', vi: 'Outlook', icon: Mail },
  { id: 'api', en: 'API Keys', vi: 'Khóa API', icon: Key },
  { id: 'license', en: 'Licenses', vi: 'Bản quyền', icon: FileKey },
]

export function Sidebar({
  stats,
  storageInfo,
  dbHealth,
  activeCategory,
  onCategoryChange,
  onCreateAccount,
  onManageCustomers,
  onManageTypes,
  onManageAccessUsers,
  onOpenSettings,
  canManageAccessUsers = true,
  canManageSecurity = true,
  canCreateAccount = true,
}: SidebarProps) {
  const [showAuditModal, setShowAuditModal] = useState(false)
  const { language } = useI18nStore()

  return (
    <aside className="w-72 h-screen bg-bg-secondary/75 backdrop-blur-xl border-r border-border-subtle flex flex-col shadow-2xl">
      <div className="p-5 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-accent-primary/12 rounded-2xl flex items-center justify-center border border-white/20">
            <Shield className="w-5 h-5 text-accent-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-text-primary">SecureVault</h1>
            <p className="text-xs text-text-tertiary">{t(language, 'Password Manager', 'Quản lý mật khẩu')}</p>
            {dbHealth && (!dbHealth.exists || !dbHealth.quick_ok || !dbHealth.integrity_ok) && (
              <p className="text-[10px] text-red-400 mt-1">Cảnh báo: DB health check lỗi</p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onCategoryChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
                activeCategory === item.id
                  ? 'text-accent-primary bg-white/12 border border-white/25 shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/8'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeCategory === item.id ? 'text-accent-primary' : ''}`} />
              <span className="text-sm font-medium">{t(language, item.en, item.vi)}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-1">
          <p className="px-3 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">
            {t(language, 'Vault Management', 'Quản lý kho')}
          </p>
          <button
            onClick={onManageCustomers}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all text-left"
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{t(language, 'Customer Management', 'Quản lý khách hàng')}</span>
          </button>
          <button
            onClick={() => setShowAuditModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all text-left"
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">{t(language, 'Activity Log', 'Nhật ký hoạt động')}</span>
          </button>
          <button
            onClick={onManageTypes}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all text-left"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm font-medium">Mẫu trường tài khoản</span>
          </button>
          {canManageAccessUsers && (
            <button
              onClick={onManageAccessUsers}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all text-left"
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Phân quyền user</span>
            </button>
          )}
          {canManageSecurity && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all text-left"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">{t(language, 'App Settings', 'Thiết lập ứng dụng')}</span>
            </button>
          )}
        </div>
      </nav>

      {stats && (
        <div className="p-4 border-t border-border-subtle">
          <div className="bg-bg-tertiary/70 backdrop-blur rounded-2xl p-4 space-y-3 border border-white/20">
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">{t(language, 'Total Items', 'Tổng mục')}</span>
              <span className="text-text-primary font-medium">{stats.total_accounts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">{t(language, 'Favorites', 'Yêu thích')}</span>
              <span className="text-text-primary font-medium">{stats.favorite_accounts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">{t(language, 'Categories', 'Danh mục')}</span>
              <span className="text-text-primary font-medium">{stats.account_types}</span>
            </div>
          </div>
        </div>
      )}

      {canCreateAccount && (
        <div className="p-4 border-t border-border-subtle">
          <button
            onClick={onCreateAccount}
            className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-bg-primary font-semibold py-3 rounded-2xl transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>{t(language, 'New Item', 'Mục mới')}</span>
          </button>
        </div>
      )}

      <AnimatePresence>{showAuditModal && <AuditLogModal onClose={() => setShowAuditModal(false)} />}</AnimatePresence>
    </aside>
  )
}

