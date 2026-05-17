import { Search, Grid3X3, List, Lock, Command, Key } from 'lucide-react'
import { useState } from 'react'
import { PasswordGenerator } from '../features/PasswordGenerator'
import { AnimatePresence, motion } from 'framer-motion'
import { t, useI18nStore } from '../../stores/i18nStore'

interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onLock: () => void
  expiringSoonCount: number
  expiredCount: number
}

export function Header({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onLock,
  expiringSoonCount,
  expiredCount,
}: HeaderProps) {
  const [showGenerator, setShowGenerator] = useState(false)
  const { language, toggleLanguage } = useI18nStore()

  return (
    <header className="h-16 bg-bg-secondary/95 backdrop-blur border-b border-border-subtle flex items-center justify-between px-6 shadow-sm">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(language, 'Search items...', 'Tìm mục...')}
            className="w-full bg-bg-tertiary border border-border-subtle rounded-xl pl-10 pr-12 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-text-tertiary">
            <Command className="w-3 h-3" />
            <span className="text-xs">K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex bg-bg-tertiary rounded-lg p-1 border border-border-subtle">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={toggleLanguage}
          className="px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors border border-border-subtle"
          title={t(language, 'Switch language', 'Chuyển ngôn ngữ')}
        >
          {language === 'en' ? 'VI' : 'EN'}
        </button>

        <button
          onClick={() => setShowGenerator(true)}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors border border-transparent hover:border-border-subtle"
          title={t(language, 'Password Generator', 'Tạo mật khẩu')}
        >
          <Key className="w-5 h-5" />
        </button>

        <button
          onClick={onLock}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors border border-transparent hover:border-border-subtle"
          title={t(language, 'Lock vault', 'Khóa kho')}
        >
          <Lock className="w-5 h-5" />
        </button>

        {(expiringSoonCount > 0 || expiredCount > 0) && (
          <div className="ml-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">
            {expiredCount > 0 ? `${expiredCount} hết hạn` : `${expiringSoonCount} sắp hết hạn`}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showGenerator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGenerator(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg"
            >
              <PasswordGenerator />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  )
}
