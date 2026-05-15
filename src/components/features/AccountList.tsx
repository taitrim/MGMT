import { Account, useVaultStore } from '../../stores/vaultStore'
import { motion } from 'framer-motion'
import { Server, Database, Terminal, Globe, Cloud, Mail, Key, FileKey, Lock, Star, MoreHorizontal, Router } from 'lucide-react'
import { t, useI18nStore } from '../../stores/i18nStore'

interface AccountListProps {
  accounts: Account[]
  viewMode: 'grid' | 'list'
  onSelectAccount: (account: Account) => void
}

const getIcon = (typeId: string | null) => {
  switch (typeId) {
    case 'server': return Server
    case 'ssh': return Terminal
    case 'rdp': return Database
    case 'database': return Database
    case 'website': return Globe
    case 'hosting': return Cloud
    case 'cloud': return Cloud
    case 'vpn': return Lock
    case 'ftp': return Lock
    case 'email': return Mail
    case 'outlook': return Mail
    case 'router': return Router
    case 'api': return Key
    case 'license': return FileKey
    default: return Key
  }
}

const fallbackPalette = ['#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#84cc16', '#f43f5e']

const colorFromType = (typeId: string | null, explicitColor?: string | null) => {
  if (explicitColor) return explicitColor
  if (!typeId) return '#64748b'
  let hash = 0
  for (let i = 0; i < typeId.length; i += 1) hash = (hash << 5) - hash + typeId.charCodeAt(i)
  return fallbackPalette[Math.abs(hash) % fallbackPalette.length]
}

export function AccountList({ accounts, viewMode, onSelectAccount }: AccountListProps) {
  const { language } = useI18nStore()
  const { accountTypes } = useVaultStore()
  const typeColorMap = new Map(accountTypes.map((t) => [t.id, t.color]))
  const typeNameMap = new Map(accountTypes.map((t) => [t.id, t.name]))

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 bg-bg-tertiary rounded-2xl flex items-center justify-center mb-4">
          <Key className="w-8 h-8 text-text-tertiary" />
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-1">{t(language, 'No items yet', 'Chưa có mục nào')}</h3>
        <p className="text-text-secondary text-sm">{t(language, 'Create your first item to get started', 'Tạo mục đầu tiên để bắt đầu')}</p>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {accounts.map((account, index) => {
          const Icon = getIcon(account.account_type_id)
          const color = colorFromType(account.account_type_id, account.account_type_id ? typeColorMap.get(account.account_type_id) : null)

          return (
            <motion.button
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectAccount(account)}
              className="group bg-bg-secondary border border-border-subtle hover:border-border-default rounded-xl p-4 text-left transition-all hover:shadow-lg hover:shadow-black/5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ color, backgroundColor: `${color}22` }}>
                  <Icon className="w-5 h-5" />
                </div>
                {account.favorite && <Star className="w-4 h-4 text-accent-primary fill-accent-primary" />}
              </div>
              <h3 className="font-medium text-text-primary truncate mb-1 group-hover:text-accent-primary transition-colors">
                {account.name}
              </h3>
              <p className="text-xs text-text-tertiary truncate">
                {(account.account_type_id && typeNameMap.get(account.account_type_id)) || account.account_type_id || 'Login'}
              </p>
              {account.has_expiry && account.expires_at && (
                <p className="text-[10px] text-amber-400 mt-1">Hết hạn: {new Date(account.expires_at).toLocaleDateString()}</p>
              )}
            </motion.button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {accounts.map((account, index) => {
        const Icon = getIcon(account.account_type_id)
        const color = colorFromType(account.account_type_id, account.account_type_id ? typeColorMap.get(account.account_type_id) : null)

        return (
          <motion.button
            key={account.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectAccount(account)}
            className="w-full group flex items-center gap-4 bg-bg-secondary border border-border-subtle hover:border-border-default rounded-xl p-4 text-left transition-all"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ color, backgroundColor: `${color}22` }}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-text-primary truncate group-hover:text-accent-primary transition-colors">{account.name}</h3>
              <p className="text-xs text-text-tertiary truncate">
                {(account.account_type_id && typeNameMap.get(account.account_type_id)) || account.account_type_id || 'Login'}
              </p>
              {account.has_expiry && account.expires_at && (
                <p className="text-[10px] text-amber-400 mt-1">Hết hạn: {new Date(account.expires_at).toLocaleDateString()}</p>
              )}
            </div>
            {account.favorite && <Star className="w-4 h-4 text-accent-primary fill-accent-primary shrink-0" />}
            <MoreHorizontal className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        )
      })}
    </div>
  )
}

