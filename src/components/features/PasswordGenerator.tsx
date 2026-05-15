import { useState } from 'react'
import { RefreshCw, Copy, Check, Shield } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { copyToClipboardSecure } from '../../utils/clipboard'
import { t, useI18nStore } from '../../stores/i18nStore'

interface PasswordGeneratorProps {
  onGenerate?: (password: string) => void
}

export function PasswordGenerator({ onGenerate }: PasswordGeneratorProps) {
  const { generatePassword } = useVaultStore()
  const { language } = useI18nStore()
  const [password, setPassword] = useState('')
  const [length, setLength] = useState(16)
  const [includeSpecial, setIncludeSpecial] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    const newPassword = await generatePassword(length, includeSpecial)
    setPassword(newPassword)
    if (onGenerate) onGenerate(newPassword)
    setIsGenerating(false)
  }

  const handleCopy = async () => {
    if (!password) return
    const success = await copyToClipboardSecure(password)
    if (success) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  return (
    <div className="bg-bg-tertiary rounded-2xl p-6 border border-border-subtle">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">{t(language, 'Password Generator', 'Tạo mật khẩu')}</h3>
          <p className="text-xs text-text-tertiary">{t(language, 'Create secure, complex passwords', 'Tạo mật khẩu manh va an toan')}</p>
        </div>
      </div>

      <div className="relative group mb-6">
        <input
          type="text"
          value={password}
          readOnly
          placeholder={t(language, 'Click generate to start...', 'Bam tao de bat dau...')}
          className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-4 pr-24 font-mono text-lg text-text-primary focus:ring-2 focus:ring-accent-primary focus:border-transparent outline-none transition-all"
        />
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="p-2.5 text-text-tertiary hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCopy}
            disabled={!password}
            className={`p-2.5 rounded-lg transition-all ${
              isCopied
                ? 'bg-accent-primary text-bg-primary'
                : 'text-text-tertiary hover:text-accent-primary hover:bg-accent-primary/10'
            } disabled:opacity-50`}
          >
            {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-text-secondary">{t(language, 'Password Length', 'Độ dài mật khẩu')}</label>
            <span className="text-sm font-bold text-accent-primary">{length}</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full h-1.5 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-primary"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-bg-primary/50 rounded-xl border border-border-subtle">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">{t(language, 'Special Characters', 'Ky tu dac biet')}</span>
            <span className="text-xs text-text-tertiary">{t(language, 'Include !@#$%^&* symbols', 'Bao gom ky tu !@#$%^&*')}</span>
          </div>
          <button
            onClick={() => setIncludeSpecial(!includeSpecial)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              includeSpecial ? 'bg-accent-primary' : 'bg-bg-secondary'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                includeSpecial ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

