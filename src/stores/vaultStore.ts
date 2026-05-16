import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface Account {
  id: string
  vault_id: string
  customer_id: string | null
  account_type_id: string | null
  name: string
  favorite: boolean
  tags: string[]
  has_expiry: boolean
  expires_at: string | null
  updated_by_access_user_id: string | null
  updated_by_access_user_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  is_deleted: boolean
}

export interface AccountType {
  id: string
  vault_id: string
  name: string
  icon: string | null
  color: string | null
  fields: FieldDefinition[]
  created_at: string
  is_builtin: boolean
  is_deleted: boolean
}

export interface FieldDefinition {
  key: string
  name: string
  field_type: string
  required: boolean
  encrypted: boolean
  options: string[] | null
}

export interface FieldValue {
  id: string
  account_id: string
  field_key: string
  field_type: string
  value: string
}

export interface VaultStats {
  total_accounts: number
  favorite_accounts: number
  account_types: number
  tags: number
  attachments: number
}

export interface ImportDryRunResult {
  version: number
  algorithm: string
  checksum_valid: boolean
  sqlite_valid: boolean
  bytes: number
}

export interface Customer {
  id: string
  vault_id: string
  name: string
  contact: string | null
  notes: string | null
  created_at: string
  is_deleted: boolean
}

export interface AccessUser {
  id: string
  vault_id: string
  name: string
  email: string | null
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  is_active: boolean
  category_permissions: string[]
  can_view_password: boolean
  can_create_account: boolean
  created_at: string
}

interface VaultState {
  accounts: Account[]
  accountTypes: AccountType[]
  customers: Customer[]
  accessUsers: AccessUser[]
  selectedAccount: Account | null
  stats: VaultStats | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  fetchAccounts: () => Promise<void>
  fetchAccountTypes: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchCustomers: () => Promise<void>
  createCustomer: (name: string, contact?: string, notes?: string) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  fetchAccessUsers: () => Promise<void>
  createAccessUser: (
    name: string,
    email: string | null,
    role: AccessUser['role'],
    password: string,
    categoryPermissions?: string[],
    canViewPassword?: boolean,
    canCreateAccount?: boolean
  ) => Promise<void>
  updateAccessUser: (user: AccessUser) => Promise<void>
  deleteAccessUser: (id: string) => Promise<void>
  changeAccessUserPassword: (id: string, newPassword: string) => Promise<void>
  createAccount: (name: string, customerId: string | null, typeId: string | null, fields: FieldValue[], hasExpiry?: boolean, expiresAt?: string | null) => Promise<void>
  updateAccount: (id: string, updates: Partial<Account>, fields?: FieldValue[]) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  selectAccount: (account: Account | null) => void
  getAccountFields: (accountId: string) => Promise<FieldValue[]>
  searchAccounts: (query: string) => Promise<void>
  generatePassword: (length: number, includeSpecial: boolean) => Promise<string>
  setSearchQuery: (query: string) => void
  getTotp: (accountId: string) => Promise<string>
  saveTotp: (accountId: string, secret: string, issuer?: string) => Promise<void>
  createAccountType: (name: string, icon: string | null, color: string | null, fields: FieldDefinition[]) => Promise<void>
  updateAccountType: (id: string, name: string, icon: string | null, color: string | null, fields: FieldDefinition[]) => Promise<void>
  deleteAccountType: (id: string) => Promise<void>
  getAccountTypeFieldUsageCount: (accountTypeId: string, fieldKey: string) => Promise<number>
  exportAccountTypeTemplates: (destPath: string) => Promise<void>
  importAccountTypeTemplates: (srcPath: string) => Promise<number>
  exportVault: (destPath: string) => Promise<void>
  importVault: (srcPath: string) => Promise<void>
  importVaultDryRun: (srcPath: string) => Promise<ImportDryRunResult>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  accounts: [],
  accountTypes: [],
  customers: [],
  accessUsers: [],
  selectedAccount: null,
  stats: null,
  isLoading: false,
  error: null,
  searchQuery: '',

  fetchAccounts: async () => {
    try {
      set({ isLoading: true })
      const accounts = await invoke<Account[]>('get_accounts')
      set({ accounts, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: String(error) })
    }
  },

  fetchAccountTypes: async () => {
    try {
      const types = await invoke<AccountType[]>('get_account_types')
      set({ accountTypes: types })
    } catch (error) {
      console.error('Failed to fetch account types:', error)
    }
  },

  fetchStats: async () => {
    try {
      const stats = await invoke<VaultStats>('get_vault_stats')
      set({ stats })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  },

  fetchCustomers: async () => {
    try {
      const customers = await invoke<Customer[]>('get_customers')
      set({ customers })
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  },

  createCustomer: async (name: string, contact?: string, notes?: string) => {
    try {
      await invoke('create_customer', {
        request: { name, contact: contact || null, notes: notes || null }
      })
      await get().fetchCustomers()
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  deleteCustomer: async (id: string) => {
    try {
      await invoke('delete_customer', { id })
      await Promise.all([get().fetchCustomers(), get().fetchAccounts()])
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  fetchAccessUsers: async () => {
    try {
      const accessUsers = await invoke<AccessUser[]>('get_access_users')
      set({ accessUsers })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  createAccessUser: async (
    name: string,
    email: string | null,
    role: AccessUser['role'],
    password: string,
    categoryPermissions: string[] = [],
    canViewPassword = false,
    canCreateAccount = false
  ) => {
    await invoke('create_access_user', {
      request: {
        name,
        email,
        role,
        password,
        category_permissions: categoryPermissions,
        can_view_password: canViewPassword,
        can_create_account: canCreateAccount
      }
    })
    await get().fetchAccessUsers()
  },

  updateAccessUser: async (user: AccessUser) => {
    await invoke('update_access_user', {
      request: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        category_permissions: user.category_permissions,
        can_view_password: user.can_view_password,
        can_create_account: user.can_create_account,
      }
    })
    await get().fetchAccessUsers()
  },

  deleteAccessUser: async (id: string) => {
    await invoke('delete_access_user', { id })
    await get().fetchAccessUsers()
  },

  changeAccessUserPassword: async (id: string, newPassword: string) => {
    await invoke('change_access_user_password', {
      request: { id, new_password: newPassword }
    })
  },

  createAccount: async (name: string, customerId: string | null, typeId: string | null, fields: FieldValue[], hasExpiry = false, expiresAt = null) => {
    try {
      set({ isLoading: true })
      await invoke('create_account', {
        request: {
          name,
          customer_id: customerId,
          account_type_id: typeId,
          has_expiry: hasExpiry,
          expires_at: expiresAt,
          fields: fields.map(f => ({
            field_key: f.field_key,
            field_type: f.field_type,
            value: f.value
          }))
        }
      })
      await get().fetchAccounts()
      await get().fetchStats()
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      throw error
    }
  },

  updateAccount: async (id: string, updates: Partial<Account>, fields?: FieldValue[]) => {
    try {
      set({ isLoading: true })
      await invoke('update_account', {
        request: {
          id,
          name: updates.name,
          customer_id: updates.customer_id,
          favorite: updates.favorite,
          tags: updates.tags,
          has_expiry: updates.has_expiry,
          expires_at: updates.expires_at,
          fields: fields?.map(f => ({
            field_key: f.field_key,
            field_type: f.field_type,
            value: f.value
          }))
        }
      })
      await get().fetchAccounts()
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      throw error
    }
  },

  deleteAccount: async (id: string) => {
    try {
      set({ isLoading: true })
      await invoke('delete_account', { id })
      await get().fetchAccounts()
      await get().fetchStats()
      set({ selectedAccount: null })
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      throw error
    }
  },

  selectAccount: (account: Account | null) => {
    set({ selectedAccount: account })
  },

  getAccountFields: async (accountId: string) => {
    try {
      return await invoke<FieldValue[]>('get_account_fields', { accountId })
    } catch (error) {
      console.error('Failed to get account fields:', error)
      return []
    }
  },

  searchAccounts: async (query: string) => {
    try {
      if (!query.trim()) {
        await get().fetchAccounts()
        return
      }
      const accounts = await invoke<Account[]>('search_accounts', { query })
      set({ accounts })
    } catch (error) {
      console.error('Search failed:', error)
    }
  },

  generatePassword: async (length: number, includeSpecial: boolean) => {
    try {
      return await invoke<string>('generate_password', { length, includeSpecial })
    } catch (error) {
      console.error('Password generation failed:', error)
      return ''
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    if (query.trim()) {
      get().searchAccounts(query)
    } else {
      get().fetchAccounts()
    }
  },

  getTotp: async (accountId: string) => {
    try {
      return await invoke<string>('get_totp', { accountId })
    } catch (error) {
      console.error('Failed to get TOTP:', error)
      return ''
    }
  },

  saveTotp: async (accountId: string, secret: string, issuer?: string) => {
    try {
      await invoke('save_totp', { accountId, secret, issuer })
    } catch (error) {
      console.error('Failed to save TOTP:', error)
      throw error
    }
  },

  createAccountType: async (name: string, icon: string | null, color: string | null, fields: FieldDefinition[]) => {
    try {
      set({ isLoading: true })
      await invoke('create_account_type', { name, icon, color, fields })
      await get().fetchAccountTypes()
      set({ isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      throw error
    }
  },

  updateAccountType: async (id: string, name: string, icon: string | null, color: string | null, fields: FieldDefinition[]) => {
    try {
      await invoke('update_account_type', {
        request: { id, name, icon, color, fields }
      })
      await get().fetchAccountTypes()
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  deleteAccountType: async (id: string) => {
    try {
      await invoke('delete_account_type', { id })
      await get().fetchAccountTypes()
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  getAccountTypeFieldUsageCount: async (accountTypeId: string, fieldKey: string) => {
    try {
      return await invoke<number>('get_account_type_field_usage_count', {
        accountTypeId,
        fieldKey
      })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  exportAccountTypeTemplates: async (destPath: string) => {
    try {
      await invoke('export_account_type_templates', { destPath })
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  importAccountTypeTemplates: async (srcPath: string) => {
    try {
      const imported = await invoke<number>('import_account_type_templates', { srcPath })
      await get().fetchAccountTypes()
      return imported
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  exportVault: async (destPath: string) => {
    try {
      await invoke('export_vault', { destPath })
    } catch (error) {
      console.error('Export failed:', error)
      throw error
    }
  },

  importVault: async (srcPath: string) => {
    try {
      const dryRun = await get().importVaultDryRun(srcPath)
      const ok = window.confirm(
        `Backup hợp lệ (${dryRun.bytes} bytes, ${dryRun.algorithm}). Tiếp tục ghi đè vault hiện tại?`
      )
      if (!ok) return
      await invoke('import_vault', { srcPath })
    } catch (error) {
      console.error('Import failed:', error)
      throw error
    }
  },

  importVaultDryRun: async (srcPath: string) => {
    try {
      return await invoke<ImportDryRunResult>('import_vault_dry_run', { srcPath })
    } catch (error) {
      console.error('Import dry-run failed:', error)
      throw error
    }
  }
}))
