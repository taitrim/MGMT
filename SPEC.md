# SecureVault - Password Manager Desktop Application

## Project Overview

**Project Name:** SecureVault
**Type:** Desktop Application (Password Manager)
**Platform:** Windows (Cross-platform ready)
**Technology Stack:** Tauri v2, React, TypeScript, Rust, SQLite

### Core Philosophy
- Zero-knowledge local vault - All encryption happens locally
- Enterprise-grade security with production-ready architecture
- Premium UI/UX inspired by 1Password, Linear, Raycast

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │  Pages  │  │Components│  │ Hooks   │  │   State (Zustand)│  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘  │
│       └────────────┴────────────┴───────────────┘            │
│                           │ Tauri IPC (invoke)                │
├───────────────────────────┼───────────────────────────────────┤
│                     BACKEND (Rust)                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Tauri Commands                        │  │
│  └────────────────────────────┬────────────────────────────┘  │
│                                │                               │
│  ┌───────────┐  ┌─────────────┴────────────┐  ┌───────────┐  │
│  │ Commands  │  │      Services Layer      │  │  Utils    │  │
│  └─────┬─────┘  └─────────────┬─────────────┘  └─────┬─────┘  │
│        │                     │                     │        │
│  ┌─────┴─────────────────────┴─────────────────────┴─────┐   │
│  │                   Core Services                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │Security  │ │  Vault   │ │ Account  │ │  Search  │  │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └────────────────────────┬──────────────────────────────┘   │
│                           │                                   │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │                   Data Layer (SQLite)                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │  │
│  │  │Database │  │ Repos   │  │ Models  │  │ Migrations │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 1.2 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYER                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               MASTER PASSWORD FLOW                        │   │
│  │                                                           │   │
│  │  User Input ──► Argon2id KDF ──► Derived Key            │   │
│  │                    (Memory-safe)   │                      │   │
│  │                                   ▼                      │   │
│  │              ┌─────────────────────────┐                │   │
│  │              │   Master Key (in mem)   │                │   │
│  │              │   - Locked when idle    │                │   │
│  │              │   - Cleared on lock    │                │   │
│  │              └─────────────────────────┘                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               ENCRYPTION FLOW                             │   │
│  │                                                           │   │
│  │  Plain Text ──► AES-256-GCM ──► Encrypted Data          │   │
│  │                   + Nonce                                  │   │
│  │                   + Auth Tag                               │   │
│  │                                                           │   │
│  │  Encrypted Data ──► AES-256-GCM ──► Plain Text          │   │
│  │                      (with key)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               FIELD-LEVEL ENCRYPTION                      │   │
│  │                                                           │   │
│  │  Account Data                                            │   │
│  │  ├── name: encrypted                                      │   │
│  │  ├── username: encrypted                                 │   │
│  │  ├── password: encrypted (extra)                         │   │
│  │  ├── notes: encrypted                                    │   │
│  │  ├── custom_fields: encrypted                            │   │
│  │  └── attachments: encrypted                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 Core Tables

```sql
-- Users table (single user for local vault)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    master_key_hash TEXT NOT NULL,  -- Argon2id hash
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_unlocked_at DATETIME,
    failed_attempts INTEGER DEFAULT 0,
    locked_until DATETIME
);

-- Vaults (encrypted container)
CREATE TABLE vaults (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_default BOOLEAN DEFAULT FALSE
);

-- Account Types (templates)
CREATE TABLE account_types (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id),
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    fields JSON NOT NULL,  -- Field definitions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_builtin BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Accounts
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id),
    account_type_id TEXT REFERENCES account_types(id),
    name TEXT NOT NULL,  -- Encrypted
    favorite BOOLEAN DEFAULT FALSE,
    tags JSON,  -- Encrypted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Field Values (encrypted)
CREATE TABLE field_values (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    field_key TEXT NOT NULL,
    field_type TEXT NOT NULL,
    value_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted
    value_nonce TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id),
    name TEXT NOT NULL,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attachments
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    filename TEXT NOT NULL,
    mime_type TEXT,
    data_encrypted BLOB NOT NULL,  -- AES-256-GCM encrypted
    data_nonce TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TOTP Secrets
CREATE TABLE totp_secrets (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    secret_encrypted TEXT NOT NULL,
    secret_nonce TEXT NOT NULL,
    algorithm TEXT DEFAULT 'SHA1',
    digits INTEGER DEFAULT 6,
    period INTEGER DEFAULT 30,
    issuer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSON,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Password History
CREATE TABLE password_history (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    field_key TEXT NOT NULL,
    value_encrypted TEXT NOT NULL,
    value_nonce TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Backup History
CREATE TABLE backup_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Indexes

```sql
-- Performance indexes
CREATE INDEX idx_accounts_vault ON accounts(vault_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);
CREATE INDEX idx_accounts_favorite ON accounts(favorite);
CREATE INDEX idx_field_values_account ON field_values(account_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

## 3. UI/UX Design

### 3.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Title Bar (Custom)                           [─] [□] [×]      │
├──────────┬──────────────────────────────────────────────────────┤
│          │  ┌─────────────────────────────────────────────┐   │
│ Sidebar  │  │ Search Bar (Ctrl+K)                         │   │
│          │  └─────────────────────────────────────────────┘   │
│ ┌──────┐ │  ┌─────────────────────────────────────────────┐   │
│ │Vaults│ │  │                                             │   │
│ │  ▼   │ │  │              MAIN CONTENT                   │   │
│ │      │ │  │                                             │   │
│ │All   │ │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │   │
│ │Favs  │ │  │  │     │ │     │ │     │ │     │           │   │
│ │Srv   │ │  │  │Acc 1│ │Acc 2│ │Acc 3│ │Acc 4│           │   │
│ │DB    │ │  │  └─────┘ └─────┘ └─────┘ └─────┘           │   │
│ │SSH   │ │  │                                             │   │
│ │...   │ │  │                                             │   │
│ └──────┘ │  └─────────────────────────────────────────────┘   │
│          │  ┌─────────────────────────────────────────────┐   │
│ + New   │  │ Status Bar                                    │   │
└──────────┴──┴─────────────────────────────────────────────┴──┘
```

### 3.2 Color Palette

```css
/* Dark Theme (Primary) */
--bg-primary: #0a0a0b;
--bg-secondary: #111113;
--bg-tertiary: #18181b;
--bg-elevated: #1c1c1f;
--bg-hover: #27272a;

--text-primary: #fafafa;
--text-secondary: #a1a1aa;
--text-tertiary: #71717a;

--accent-primary: #10b981;      /* Emerald */
--accent-primary-hover: #34d399;
--accent-secondary: #6366f1;   /* Indigo */

--border-subtle: #27272a;
--border-default: #3f3f46;

--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;

/* Light Theme */
--light-bg-primary: #ffffff;
--light-bg-secondary: #f4f4f5;
--light-text-primary: #18181b;
--light-text-secondary: #71717a;
```

### 3.3 Typography

```css
--font-display: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */
```

### 3.4 Component Design

**Buttons:**
- Primary: Emerald background, white text, 8px radius
- Secondary: Transparent, border, subtle hover
- Ghost: No border, hover background
- Destructive: Red variant for dangerous actions

**Cards:**
- Rounded corners (12px)
- Subtle border
- Soft shadow on hover
- Glassmorphism effect for modals

**Inputs:**
- Dark background (#1c1c1f)
- Focus ring (emerald)
- Clear placeholder text
- Password visibility toggle

**Sidebar:**
- Fixed width (240px)
- Collapsible to 64px (icon only)
- Hover effects
- Active state indicator

---

## 4. Feature Specifications

### 4.1 Authentication

**Master Password:**
- Minimum 12 characters
- Strength meter display
- Argon2id with:
  - Memory: 64MB
  - Iterations: 3
  - parallelism: 4
  - Salt: 32 bytes random

**Auto-Lock:**
- Configurable timeout (1, 5, 15, 30 min)
- On system sleep/lock
- On window minimize (optional)

**Brute Force Protection:**
- Max 5 failed attempts
- Exponential backoff
- Lockout period increases

### 4.2 Account Management

**Dynamic Account Types:**
- Pre-built: Server, SSH, RDP, Database, Website, Hosting, Cloud, VPN, FTP, Email, API, License, Custom
- Custom type builder
- Field types:
  - text, textarea, password, url, number
  - checkbox, date, email, select, multi-select
  - tags, file, totp, ssh-key

**Account Operations:**
- Create, Read, Update, Delete
- Duplicate account
- Move to vault
- Merge accounts
- Bulk operations

### 4.3 Security Features

**Clipboard:**
- Auto-clear after 30 seconds
- Copy notification
- Clear all on lock

**Encryption:**
- AES-256-GCM for all sensitive data
- Per-field encryption
- Encrypted attachments

**Audit Log:**
- All actions timestamped
- Viewable in activity timeline
- Exportable

### 4.4 Desktop Integration

**System Tray:**
- Icon in system tray
- Quick access menu
- Lock vault
- Open app
- Quit

**Global Shortcuts:**
- Ctrl+Shift+V: Quick paste last password
- Ctrl+Shift+U: Unlock vault
- Configurable

**Notifications:**
- Clipboard cleared
- Auto-lock warning
- Backup reminders

---

## 5. Technical Specifications

### 5.1 Backend Modules (Rust)

```
src-tauri/src/
├── main.rs                 # Entry point
├── lib.rs                  # Module exports
├── commands/               # Tauri commands
│   ├── mod.rs
│   ├── auth.rs            # Authentication commands
│   ├── vault.rs           # Vault operations
│   ├── account.rs         # Account CRUD
│   ├── search.rs          # Search functionality
│   ├── backup.rs          # Backup/restore
│   └── settings.rs        # Settings management
├── services/              # Business logic
│   ├── mod.rs
│   ├── crypto.rs          # Encryption service
│   ├── vault.rs           # Vault service
│   ├── account.rs         # Account service
│   ├── search.rs          # Search service
│   ├── backup.rs          # Backup service
│   └── totp.rs            # TOTP generator
├── database/              # Database layer
│   ├── mod.rs
│   ├── connection.rs      # SQLite connection
│   ├── migrations.rs      # Schema migrations
│   └── schema.rs          # Table definitions
├── repositories/          # Data access
│   ├── mod.rs
│   ├── user_repo.rs
│   ├── vault_repo.rs
│   ├── account_repo.rs
│   └── field_repo.rs
├── models/                # Domain models
│   ├── mod.rs
│   ├── user.rs
│   ├── vault.rs
│   ├── account.rs
│   └── field.rs
├── security/              # Security utilities
│   ├── mod.rs
│   ├── keyring.rs         # Key management
│   ├── session.rs         # Session management
│   └── audit.rs           # Audit logging
└── utils/                 # Utilities
    ├── mod.rs
    └── error.rs           # Error handling
```

### 5.2 Frontend Architecture (React)

```
frontend/src/
├── main.tsx               # Entry point
├── App.tsx                # Root component
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── forms/            # Form components
│   └── features/         # Feature-specific
├── pages/                # Route pages
│   ├── LockScreen.tsx
│   ├── Dashboard.tsx
│   ├── VaultView.tsx
│   ├── AccountDetail.tsx
│   ├── Settings.tsx
│   └── Backup.tsx
├── hooks/                 # Custom hooks
│   ├── useVault.ts
│   ├── useAuth.ts
│   ├── useSearch.ts
│   └── useKeyboard.ts
├── stores/                # State management
│   ├── authStore.ts
│   ├── vaultStore.ts
│   └── settingsStore.ts
├── services/              # API services
│   ├── api.ts
│   └── tauri.ts
├── types/                 # TypeScript types
├── utils/                 # Utilities
└── styles/               # Global styles
```

---

## 6. Build & Packaging

### 6.1 Build Targets

- **Portable:** Single .exe file, no installation
- **MSI:** Windows Installer
- **NSIS:** EXE installer with options

### 6.2 Build Configuration

```json
{
  "productName": "SecureVault",
  "version": "1.0.0",
  "identifier": "com.securevault.app",
  "build": {
    "devtools": true
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "windows": {
      "certificate": null
    }
  }
}
```

---

## 7. Development Phases

### Phase 1: Foundation
- Project setup (Tauri + React)
- Database schema & migrations
- Basic encryption service
- Error handling & logging

### Phase 2: Authentication
- Master password setup/unlock
- Session management
- Auto-lock functionality
- Brute force protection

### Phase 3: Core Features
- Vault management
- Account CRUD
- Field system
- Search & filter

### Phase 4: Advanced Features
- TOTP integration
- Attachment support
- Backup & restore
- Import/Export

### Phase 5: Desktop Integration
- System tray
- Global shortcuts
- Notifications
- Auto-start

### Phase 6: Polish & Release
- UI refinements
- Performance optimization
- Production build
- Testing

---

## 8. Acceptance Criteria

1. Application builds successfully on Windows
2. Master password encrypts/decrypts vault correctly
3. Accounts can be created, viewed, edited, deleted
4. Field-level encryption works for sensitive data
5. Search returns accurate results
6. Auto-lock triggers after timeout
7. Clipboard clears after timeout
8. System tray shows/hides correctly
9. Global shortcuts work when app is minimized
10. Backup/restore preserves all data
11. UI matches design specifications
12. No sensitive data in logs or memory after lock