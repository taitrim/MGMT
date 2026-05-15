import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

interface User {
  id: string
  email: string | null
  display_name: string
}

interface AppStorageInfo {
  mode: string
  db_path: string
}

interface DbHealthInfo {
  db_path: string
  exists: boolean
  quick_ok: boolean
  integrity_ok: boolean
  page_count: number
}

interface AuthState {
  isUnlocked: boolean
  isLoading: boolean
  hasUser: boolean
  user: User | null
  storageInfo: AppStorageInfo | null
  dbHealth: DbHealthInfo | null
  error: string | null
  checkStatus: () => Promise<void>
  loadStorageInfo: () => Promise<void>
  checkDbHealth: () => Promise<void>
  setStoragePath: (dbPath: string) => Promise<void>
  openDataDirectory: () => Promise<void>
  checkSession: () => Promise<void>
  setup: (displayName: string, password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => Promise<void>
  extendSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isUnlocked: false,
  isLoading: true,
  hasUser: false,
  user: null,
  storageInfo: null,
  dbHealth: null,
  error: null,

  checkStatus: async () => {
    try {
      set({ isLoading: true })
      const hasUser = await invoke<boolean>('check_has_user')
      const unlocked = await invoke<boolean>('is_unlocked')
      set({ hasUser, isUnlocked: unlocked, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: String(error) })
    }
  },

  loadStorageInfo: async () => {
    try {
      const storageInfo = await invoke<AppStorageInfo>('get_app_storage_info')
      set({ storageInfo })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  setStoragePath: async (dbPath: string) => {
    await invoke('set_app_storage_path', { dbPath })
    await get().loadStorageInfo()
  },

  checkDbHealth: async () => {
    try {
      const dbHealth = await invoke<DbHealthInfo>('run_db_health_check')
      set({ dbHealth })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  openDataDirectory: async () => {
    await invoke('open_app_data_directory')
  },

  checkSession: async () => {
    try {
      const unlocked = await invoke<boolean>('is_unlocked')
      if (!unlocked && get().isUnlocked) {
        set({ isUnlocked: false, user: null })
      }
    } catch {
      set({ isUnlocked: false, user: null })
    }
  },

  setup: async (displayName: string, password: string) => {
    try {
      set({ isLoading: true, error: null })
      await invoke('setup_vault', {
        request: { display_name: displayName, master_password: password }
      })
      set({ isUnlocked: true, hasUser: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      throw error
    }
  },

  unlock: async (password: string) => {
    try {
      set({ isLoading: true, error: null })
      const user = await invoke<User>('unlock_vault', {
        request: { master_password: password }
      })
      set({ isUnlocked: true, user, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      throw error
    }
  },

  lock: async () => {
    try {
      await invoke('lock_vault')
      set({ isUnlocked: false, user: null })
    } catch (error) {
      console.error('Lock error:', error)
    }
  },

  extendSession: async () => {
    try {
      await invoke('extend_session')
    } catch (error) {
      console.error('Session extend error:', error)
    }
  }
}))
