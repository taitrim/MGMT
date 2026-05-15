import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { t, useI18nStore } from '../stores/i18nStore'

export function LockScreen() {
  const { unlock, error, isLoading, hasUser } = useAuthStore()
  const { language } = useI18nStore()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    try {
      await unlock(password)
    } catch (err) {
      // Error is handled by the store
    }
  }

  if (hasUser) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-accent-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-accent-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-text-primary">{t(language, 'Welcome Back', 'Chào mừng quay lại')}</h1>
              <p className="text-text-secondary text-sm mt-1">{t(language, 'Enter your master password to unlock', 'Nhập mật khẩu chính để mở khóa')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t(language, 'Master password', 'Mật khẩu chính')}
                  className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 pr-12 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg-primary font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t(language, 'Unlocking...', 'Đang mở khóa...')}
                  </>
                ) : (
                  t(language, 'Unlock Vault', 'Mở khóa kho')
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border-subtle">
              <p className="text-xs text-text-tertiary text-center">
                {t(language, 'SecureVault keeps your passwords safe with AES-256 encryption', 'SecureVault bảo vệ mật khẩu bằng mã hóa AES-256')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return null
}

