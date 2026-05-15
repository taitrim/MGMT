import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Shield, Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { t, useI18nStore } from '../stores/i18nStore'

interface SetupScreenProps {
  onComplete?: () => void
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const { setup, error, isLoading } = useAuthStore()
  const { language } = useI18nStore()
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: '', color: '' }
    let score = 0
    if (password.length >= 12) score++
    if (password.length >= 16) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 2) return { score, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' }
    return { score, label: 'Strong', color: 'bg-accent-primary' }
  }

  const strength = getPasswordStrength()

  const isValid = displayName.length >= 2 &&
    password.length >= 12 &&
    password === confirmPassword &&
    strength.score >= 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      await setup(displayName, password)
      onComplete?.()
    } catch (err) {
      // Error is handled by the store
    }
  }

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
            <h1 className="text-2xl font-semibold text-text-primary">{t(language, 'Create Your Vault', 'Tạo kho của bạn')}</h1>
            <p className="text-text-secondary text-sm mt-1">{t(language, 'Set up your master password to get started', 'Tạo mật khẩu chính để bắt đầu')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-text-secondary text-sm mb-1.5 block">{t(language, 'Display Name', 'Tên hiển thị')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t(language, 'Your name', 'Tên của bạn')}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="text-text-secondary text-sm mb-1.5 block">{t(language, 'Master Password', 'Mật khẩu chính')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t(language, 'Minimum 12 characters', 'Tối thiểu 12 ký tự')}
                  className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 pr-12 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.score ? strength.color : 'bg-bg-tertiary'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strength.score >= 3 ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-text-secondary text-sm mb-1.5 block">{t(language, 'Confirm Password', 'Xác nhận mật khẩu')}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t(language, 'Confirm your password', 'Nhập lại mật khẩu')}
                className={`w-full bg-bg-tertiary border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 transition-all ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-border-subtle focus:border-accent-primary focus:ring-accent-primary/20'
                }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{t(language, 'Passwords do not match', 'Mật khẩu không khớp')}</p>
              )}
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
              disabled={isLoading || !isValid}
              className="w-full bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg-primary font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t(language, 'Creating Vault...', 'Đang tạo kho...')}
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {t(language, 'Create Vault', 'Tạo kho')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-subtle">
            <p className="text-xs text-text-tertiary text-center">
              {t(language, 'Your master password cannot be recovered. Store it safely.', 'Mật khẩu chính không thể khôi phục. Hãy lưu an toàn.')}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

