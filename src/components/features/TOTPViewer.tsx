import { useState, useEffect } from 'react'
import { Shield, Copy, RefreshCw } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { copyToClipboardSecure } from '../../utils/clipboard'
import { t, useI18nStore } from '../../stores/i18nStore'

interface TOTPViewerProps {
  accountId: string
}

export function TOTPViewer({ accountId }: TOTPViewerProps) {
  const { getTotp } = useVaultStore()
  const { language } = useI18nStore()
  const [code, setCode] = useState<string>('------')
  const [timeLeft, setTimeLeft] = useState<number>(30)
  const [isCopied, setIsCopied] = useState(false)

  const refreshTotp = async () => {
    const newCode = await getTotp(accountId)
    if (newCode) setCode(newCode)
  }

  useEffect(() => {
    refreshTotp()
    
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000)
      return 30 - (now % 30)
    }

    setTimeLeft(calculateTimeLeft())

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)
      if (remaining === 30) {
        refreshTotp()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [accountId])

  const handleCopy = async () => {
    const success = await copyToClipboardSecure(code)
    if (success) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  return (
    <div className="bg-bg-tertiary rounded-xl p-4 flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent-primary/10 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent-primary" />
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-0.5">{t(language, 'One-time Password', 'Ma xac thuc mot lan')}</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold tracking-wider text-accent-primary">
              {code.slice(0, 3)} {code.slice(3)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center w-8 h-8">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              className="text-bg-secondary"
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              strokeDasharray={88}
              strokeDashoffset={88 - (timeLeft / 30) * 88}
              className="text-accent-primary transition-all duration-1000"
            />
          </svg>
          <span className="absolute text-[10px] font-medium text-text-secondary">{timeLeft}</span>
        </div>

        <button
          onClick={handleCopy}
          className={`p-2 rounded-lg transition-all ${
            isCopied
              ? 'bg-accent-primary text-bg-primary'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
          }`}
        >
          {isCopied ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
