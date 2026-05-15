import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { LockScreen } from './pages/LockScreen'
import { Dashboard } from './pages/Dashboard'
import { SetupScreen } from './pages/SetupScreen'
import { listen } from '@tauri-apps/api/event'
import { t, useI18nStore } from './stores/i18nStore'

function App() {
  const { isUnlocked, isLoading, hasUser, checkStatus, lock } = useAuthStore()
  const { language } = useI18nStore()

  useEffect(() => {
    checkStatus()
    const unlistenPromise = listen('lock-vault', () => { lock() })
    return () => { unlistenPromise.then(fn => fn()) }
  }, [checkStatus, lock])

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">{t(language, 'Loading...', 'Đang tải...')}</span>
        </div>
      </div>
    )
  }

  if (!hasUser) {
    return <SetupScreen />
  }

  return isUnlocked ? <Dashboard /> : <LockScreen />
}

export default App

