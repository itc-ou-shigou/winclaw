# GRC Dashboard Internationalization (i18n) Design

## Document Info

| Key | Value |
|-----|-------|
| **Version** | 1.1 |
| **Created** | 2026-03-09 |
| **Status** | Design Review |
| **Related** | GRC_AI_Employee_Office_Console_Plan.md |

---

## 1. Overview

### 1.1 Purpose

GRC Dashboard currently has all UI text hardcoded in English. This design adds internationalization (i18n) support for **4 languages**:

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English |
| `zh` | Chinese (Simplified) | 简体中文 |
| `ja` | Japanese | 日本語 |
| `ko` | Korean | 한국어 |

### 1.2 Scope

**In Scope:**
- Dashboard frontend (React SPA) — all UI text, labels, buttons, tooltips, error messages, placeholders
- Server-side API error messages — standardized error codes with client-side translation
- Date/time formatting (locale-aware)
- Number formatting (locale-aware)
- Settings page with language selector (`/settings`)
- Login page language switcher (compact dropdown)
- Browser language auto-detection (default = browser language; fallback = English)
- User language preference persistence (localStorage + user profile)

**Out of Scope (Phase 1):**
- Right-to-left (RTL) layout support (Arabic, Hebrew)
- Server-side log messages (remain English for debugging)
- WinClaw client i18n (separate project)
- Database content translation (user-generated content like topics, task titles)
- PDF/export localization

### 1.3 Design Principles

1. **Key-based translation** — All strings referenced by hierarchical keys (e.g., `sidebar.auth.users`)
2. **Namespace separation** — Translation files split by feature module for maintainability
3. **Fallback chain** — Missing translation falls back: `zh` → `en` (English as base language)
4. **Server error codes** — API returns error codes (not messages); frontend translates to user language
5. **Zero runtime overhead** — Language bundles loaded on demand (lazy loading)
6. **Type safety** — TypeScript types generated from English base file

---

## 2. Technology Selection

### 2.1 Library: i18next + react-i18next

| Criteria | i18next | react-intl | Alternative |
|----------|---------|------------|-------------|
| React integration | react-i18next (mature) | Native (FormatJS) | — |
| Bundle size | ~40KB (with tree-shaking) | ~35KB | — |
| Namespace support | Built-in | Manual | — |
| Lazy loading | Built-in plugin | Manual | — |
| Interpolation | `{{variable}}` syntax | ICU MessageFormat | — |
| Pluralization | Built-in (incl. CJK rules) | ICU-based | — |
| TypeScript support | Excellent (typed keys) | Good | — |
| Community & ecosystem | Largest | Large | — |

**Decision: i18next + react-i18next**

Rationale:
- Industry standard for React i18n
- Built-in namespace support (perfect for modular GRC architecture)
- Lazy-loading plugins for code splitting
- Excellent TypeScript integration with typed translation keys
- CJK (Chinese/Japanese/Korean) pluralization rules supported natively

### 2.2 New Dependencies

```json
{
  "dependencies": {
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "i18next-browser-languagedetector": "^8.0.0",
    "i18next-http-backend": "^3.0.0"
  },
  "devDependencies": {
    "i18next-parser": "^9.0.0"
  }
}
```

| Package | Purpose |
|---------|---------|
| `i18next` | Core i18n framework |
| `react-i18next` | React hooks & components (`useTranslation`, `<Trans>`) |
| `i18next-browser-languagedetector` | Auto-detect user language from browser/localStorage |
| `i18next-http-backend` | Lazy-load translation JSON files on demand |
| `i18next-parser` (dev) | Extract translation keys from source code |

---

## 3. Architecture

### 3.1 High-Level Architecture

```
Browser
├── Language Detector (browser lang / localStorage / user preference)
├── i18next Instance
│   ├── Backend Plugin → /locales/{lang}/{namespace}.json
│   ├── Fallback: missing key → en namespace
│   └── Interpolation Engine ({{variable}}, plurals, formatting)
├── React Context (I18nextProvider)
│   └── useTranslation(namespace) hook in each component
└── Language Switcher Component
    └── Updates localStorage + i18next.changeLanguage()

GRC Server
├── API Error Responses → { error: "code", message: "english fallback" }
├── User Profile → preferred_language field
└── GET /api/v1/admin/auth/me → returns user.preferredLanguage
```

### 3.2 Translation File Structure

```
dashboard/
├── public/
│   └── locales/
│       ├── en/
│       │   ├── common.json        # Shared: buttons, status, pagination, errors
│       │   ├── auth.json          # Login, registration, auth pages
│       │   ├── sidebar.json       # Navigation labels
│       │   ├── overview.json      # Overview page
│       │   ├── users.json         # User management
│       │   ├── apikeys.json       # API Keys management
│       │   ├── skills.json        # Skills pages
│       │   ├── evolution.json     # Evolution (Assets, Nodes, Pipeline)
│       │   ├── update.json        # Update (Releases, Stats)
│       │   ├── telemetry.json     # Telemetry Insights
│       │   ├── community.json     # Community (Channels, Topics, Moderation)
│       │   ├── employees.json     # Employees, Org Chart
│       │   ├── roles.json         # Role Templates, Editor, Assign
│       │   ├── tasks.json         # Task Board, Stats, Expenses
│       │   ├── strategy.json      # Strategy Management
│       │   ├── agents.json        # A2A Agent Cards
│       │   ├── meetings.json      # Meetings, Create, Live, Triggers
│       │   ├── relay.json         # A2A Relay Log
│       │   ├── platform.json      # Platform Values
│       │   └── settings.json      # Settings page
│       ├── zh/
│       │   └── (same files)
│       ├── ja/
│       │   └── (same files)
│       └── ko/
│           └── (same files)
└── src/
    └── i18n/
        ├── index.ts               # i18next initialization & config
        ├── types.ts               # TypeScript type definitions for keys
        └── LoginLanguageSwitcher.tsx  # Compact language selector for login page
```

### 3.3 Namespace Strategy

Each namespace maps to a feature module, loaded on demand when the user navigates to that page:

| Namespace | Always Loaded | Pages |
|-----------|--------------|-------|
| `common` | Yes | All pages (shared strings) |
| `sidebar` | Yes | All pages (navigation) |
| `auth` | On login page | Login, Registration |
| `overview` | On navigate | Overview |
| `users` | On navigate | Users management |
| `apikeys` | On navigate | API Keys management |
| `skills` | On navigate | Skills, Skill Stats |
| `evolution` | On navigate | Assets, Asset Detail, Nodes, Pipeline |
| `update` | On navigate | Releases, Update Stats |
| `telemetry` | On navigate | Insights |
| `community` | On navigate | Channels, Topics, Post Detail, Moderation |
| `employees` | On navigate | Employee List, Org Chart |
| `roles` | On navigate | Role Templates, Role Editor, Role Create, Role Assign |
| `tasks` | On navigate | Task Board, Task Detail, Task Create, Task Stats, Expenses |
| `strategy` | On navigate | Strategy Management (6 tabs) |
| `agents` | On navigate | A2A Agent Cards, Agent Detail |
| `meetings` | On navigate | Meeting List, Create, Detail, Live, Auto Triggers |
| `relay` | On navigate | Relay Log |
| `platform` | On navigate | Platform Values |
| `settings` | On navigate | Settings (Language, etc.) |

---

## 4. Translation Key Catalog

### 4.1 Naming Convention

```
{namespace}.{section}.{element}
```

Rules:
- All keys in **camelCase**
- Hierarchical nesting with `.` separator
- Dynamic values use `{{variable}}` interpolation
- Plural forms use `_one` / `_other` suffixes (i18next convention)

### 4.2 common.json (Shared Strings)

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "close": "Close",
    "back": "Back",
    "next": "Next",
    "previous": "Previous",
    "submit": "Submit",
    "approve": "Approve",
    "reject": "Reject",
    "clone": "Clone",
    "view": "View",
    "refresh": "Refresh",
    "cleanup": "Cleanup",
    "revoke": "Revoke",
    "remove": "Remove",
    "flag": "Flag",
    "saving": "Saving...",
    "processing": "Processing...",
    "loading": "Loading...",
    "deleting": "Deleting...",
    "creating": "Creating..."
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "pageOf": "Page {{page}} of {{totalPages}}",
    "showing": "Showing {{from}}-{{to}} of {{total}}"
  },
  "table": {
    "noData": "No data found.",
    "id": "ID",
    "name": "Name",
    "status": "Status",
    "actions": "Actions",
    "created": "Created",
    "updated": "Updated"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "online": "Online",
    "offline": "Offline",
    "busy": "Busy",
    "pending": "Pending",
    "completed": "Completed",
    "cancelled": "Cancelled",
    "failed": "Failed",
    "approved": "Approved",
    "rejected": "Rejected",
    "banned": "Banned",
    "draft": "Draft",
    "inProgress": "In Progress",
    "blocked": "Blocked",
    "review": "Review",
    "published": "Published",
    "archived": "Archived",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "scheduled": "Scheduled",
    "concluded": "Concluded",
    "paused": "Paused"
  },
  "errors": {
    "unexpected": "An unexpected error occurred.",
    "networkError": "Network error. Please check your connection.",
    "unauthorized": "You are not authorized to perform this action.",
    "forbidden": "Access denied.",
    "notFound": "{{resource}} not found.",
    "validationFailed": "Request validation failed.",
    "serverError": "Server error. Please try again later.",
    "adminRequired": "This endpoint requires admin privileges.",
    "rateLimited": "Too many requests. Please try again later."
  },
  "time": {
    "daysAgo": "{{count}}d ago",
    "hoursAgo": "{{count}}h ago",
    "minutesAgo": "{{count}}m ago",
    "secondsAgo": "{{count}}s ago",
    "never": "Never",
    "justNow": "Just now"
  },
  "confirm": {
    "areYouSure": "Are you sure?",
    "cannotUndo": "This action cannot be undone.",
    "yes": "Yes",
    "no": "No"
  },
  "filters": {
    "all": "All",
    "clearFilters": "Clear filters"
  }
}
```

### 4.3 auth.json (Login & Registration)

```json
{
  "login": {
    "title": "GRC Admin Dashboard",
    "subtitle": "Sign in to access your admin panel",
    "tabSignIn": "Sign In",
    "tabCreateAccount": "Create Account",
    "emailLabel": "Email address",
    "emailPlaceholder": "you@example.com",
    "passwordLabel": "Password",
    "passwordPlaceholder": "Enter your password",
    "signInButton": "Sign In",
    "signingIn": "Signing in...",
    "orContinueWith": "Or continue with",
    "github": "GitHub",
    "google": "Google",
    "enterEmailPassword": "Please enter your email and password.",
    "loginFailed": "Login failed. Please try again."
  },
  "register": {
    "step1": {
      "description": "Enter your email address to receive a verification code.",
      "sendCode": "Send Verification Code",
      "sending": "Sending...",
      "enterEmail": "Please enter your email address.",
      "invalidEmail": "Please enter a valid email address.",
      "sendFailed": "Failed to send code. Please try again."
    },
    "step2": {
      "codeSent": "We sent a 6-digit code to",
      "codePlaceholder": "Verification code",
      "verifyButton": "Verify Code",
      "verifying": "Verifying...",
      "enterFullCode": "Please enter the full 6-digit code.",
      "invalidCode": "Invalid or expired code.",
      "didntReceive": "Didn't receive the code?",
      "resendIn": "Resend in {{cooldown}}s",
      "resendCode": "Resend Code",
      "codeSentCheck": "Verification code sent. Check your inbox.",
      "codeResent": "Code resent. Check your inbox.",
      "changeEmail": "Change email address"
    },
    "step3": {
      "setPassword": "Set a password for",
      "passwordLabel": "Password",
      "passwordHint": "(min. 8 characters)",
      "passwordPlaceholder": "Create a password",
      "confirmLabel": "Confirm password",
      "confirmPlaceholder": "Repeat your password",
      "minLength": "Must be at least 8 characters",
      "mismatch": "Passwords do not match",
      "match": "Passwords match",
      "creating": "Creating account...",
      "minLengthError": "Password must be at least 8 characters.",
      "mismatchError": "Passwords do not match.",
      "createButton": "Create Account"
    }
  }
}
```

### 4.4 sidebar.json (Navigation)

```json
{
  "header": {
    "admin": "GRC Admin",
    "dashboard": "GRC Dashboard",
    "subtitle": "Dashboard"
  },
  "nav": {
    "overview": "Overview"
  },
  "sections": {
    "auth": "Auth",
    "skills": "Skills",
    "evolution": "Evolution",
    "update": "Update",
    "telemetry": "Telemetry",
    "community": "Community",
    "employees": "Employees",
    "roles": "Roles",
    "tasks": "Tasks",
    "strategy": "Strategy",
    "a2aAgents": "A2A Agents",
    "meetings": "Meetings",
    "relay": "Relay",
    "platform": "Platform"
  },
  "items": {
    "users": "Users",
    "apiKeys": "API Keys",
    "skillList": "Skill List",
    "skillStats": "Skill Stats",
    "assets": "Assets",
    "nodes": "Nodes",
    "pipeline": "Pipeline",
    "releases": "Releases",
    "updateStats": "Update Stats",
    "insights": "Insights",
    "channels": "Channels",
    "topics": "Topics",
    "moderation": "Moderation",
    "employeeList": "Employee List",
    "orgChart": "Org Chart",
    "roleTemplates": "Role Templates",
    "createRole": "Create Role",
    "taskBoard": "Task Board",
    "taskStats": "Task Stats",
    "expenses": "Expenses",
    "strategy": "Strategy",
    "agentCards": "Agent Cards",
    "allMeetings": "All Meetings",
    "createMeeting": "Create Meeting",
    "autoTriggers": "Auto Triggers",
    "relayLog": "Relay Log",
    "values": "Values"
  },
  "footer": {
    "settings": "Settings",
    "logout": "Logout",
    "version": "GRC v{{version}}"
  }
}
```

### 4.5 Example Page Namespace: overview.json

```json
{
  "title": "Overview",
  "subtitle": "Platform-wide statistics and insights",
  "stats": {
    "totalUsers": "Total Users",
    "activeNodes": "Active Nodes",
    "totalGenes": "Total Genes",
    "totalAssets": "Total Assets",
    "updateSuccessRate": "Update Success Rate",
    "uniqueTelemetryNodes": "Unique Telemetry Nodes",
    "totalTelemetryReports": "Total Telemetry Reports",
    "communityPosts": "Community Posts"
  },
  "charts": {
    "dailyTelemetry": "Daily Telemetry Reports (last 30 days)",
    "platformDistribution": "Platform Distribution",
    "genesByStatus": "Genes by Status"
  }
}
```

### 4.6 Remaining Namespace Files (Summary)

All other namespaces follow the same pattern. Key counts per namespace:

| Namespace | Estimated Keys | Major Sections |
|-----------|---------------|----------------|
| `users` | ~35 | page header, table columns, filters, tier modal, ban modal |
| `apikeys` | ~20 | page header, table columns, revoke modal |
| `skills` | ~55 | page header, filters, sort options, table, publish modal, action modals |
| `evolution` | ~40 | assets table, asset detail, nodes table, pipeline |
| `update` | ~25 | releases table, update stats cards, charts |
| `telemetry` | ~15 | insights cards, charts |
| `community` | ~35 | channels table, topics table/filters, post detail, moderation |
| `employees` | ~30 | employee table, config sync status, assign/unassign modals |
| `roles` | ~40 | role table, role editor form, role create, role assign |
| `tasks` | ~50 | task board, filters, task create form, task detail, stats, expenses |
| `strategy` | ~45 | 6 tabs (profile/short/mid/long/budgets/KPIs), history, deploy |
| `agents` | ~30 | agent cards, stats, cleanup modal, agent detail |
| `meetings` | ~50 | meeting list, stats, create form, detail, live view, auto triggers |
| `relay` | ~20 | relay log stats, table, cleanup |
| `platform` | ~10 | values display |
| `settings` | ~15 | settings page title, language section, save confirmation |

**Total estimated: ~415 unique translation keys**

---

## 5. Implementation Details

### 5.1 i18next Initialization

**File: `src/i18n/index.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja', 'ko'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  zh: '简体中文',
  ja: '日本語',
  ko: '한국어',
};

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,

    // Namespaces
    ns: ['common', 'sidebar'],           // Pre-loaded namespaces
    defaultNS: 'common',

    // Backend: load JSON from /locales/{lang}/{ns}.json
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // Language detection priority:
    // 1. localStorage (returning user who already chose a language)
    // 2. navigator (browser language — used for first visit including login page)
    // If browser language is not in SUPPORTED_LANGUAGES, falls back to 'en'
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'grc-language',
    },

    // Interpolation (React handles XSS)
    interpolation: {
      escapeValue: false,
    },

    // React Suspense for lazy loading
    react: {
      useSuspense: true,
    },
  });

export default i18n;
```

### 5.2 React Integration

**File: `src/main.tsx` (entry point)**

```typescript
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { queryClient } from './api/client';
import './i18n';  // Initialize i18n (side-effect import)
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading-screen">Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Suspense>
  </React.StrictMode>,
);
```

### 5.3 Component Usage Pattern

**Before (hardcoded):**
```tsx
export function Overview() {
  return (
    <div className="page">
      <h1 className="page-title">Overview</h1>
      <p className="page-subtitle">Platform-wide statistics and insights</p>
      <StatCard title="Total Users" value={17} />
    </div>
  );
}
```

**After (i18n):**
```tsx
import { useTranslation } from 'react-i18next';

export function Overview() {
  const { t } = useTranslation('overview');

  return (
    <div className="page">
      <h1 className="page-title">{t('title')}</h1>
      <p className="page-subtitle">{t('subtitle')}</p>
      <StatCard title={t('stats.totalUsers')} value={17} />
    </div>
  );
}
```

### 5.4 Language Selection — Settings Page & Login Switcher

Language switching is provided in **two places**:

1. **Settings Page (`/settings`)** — Full settings page accessible from sidebar, with language selection as the primary setting
2. **Login Page** — Compact language switcher in the top-right corner (before authentication)

#### 5.4.1 Login Page Language Switcher (Compact)

**File: `src/i18n/LoginLanguageSwitcher.tsx`**

A compact globe icon + language code dropdown for the login page. This component works **before authentication** (no user profile API call).

```tsx
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, LANGUAGE_FLAGS } from './index';
import type { SupportedLanguage } from './index';

/**
 * Compact language switcher for the login page (pre-authentication).
 * Displays as: 🌐 EN ▼  (globe icon + language code + dropdown arrow)
 * Positioned in the top-right corner of the login card header.
 */
export function LoginLanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    // Only saves to localStorage (no server call — user not authenticated yet)
  };

  return (
    <div className="login-language-switcher">
      <span className="login-lang-icon">🌐</span>
      <select
        value={i18n.language}
        onChange={(e) => handleChange(e.target.value as SupportedLanguage)}
        className="login-lang-select"
        aria-label="Select language"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
```

Language flags constant (added to `src/i18n/index.ts`):
```typescript
export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇺🇸',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
};
```

#### 5.4.2 Settings Page

**File: `src/pages/settings/Settings.tsx`**

A dedicated settings page with language configuration as the primary (and initially only) section.
Future settings (theme, notification preferences, etc.) can be added here.

```tsx
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, LANGUAGE_FLAGS } from '../../i18n';
import type { SupportedLanguage } from '../../i18n';
import { api } from '../../api/client';

export function Settings() {
  const { t, i18n } = useTranslation('settings');

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    // 1. Change i18next language (updates all UI text instantly)
    await i18n.changeLanguage(lang);

    // 2. Persist to server (if user is logged in)
    try {
      await api.patch('/api/v1/admin/auth/me/language', { language: lang });
    } catch {
      // Server sync failure is non-critical; localStorage is the primary source
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('title')}</h1>
      <p className="page-subtitle">{t('subtitle')}</p>

      {/* Language Section */}
      <div className="settings-section">
        <h2 className="settings-section-title">{t('language.title')}</h2>
        <p className="settings-section-desc">{t('language.description')}</p>

        <div className="language-grid">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              className={`language-card ${i18n.language === lang ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang)}
            >
              <span className="language-flag">{LANGUAGE_FLAGS[lang]}</span>
              <span className="language-label">{LANGUAGE_LABELS[lang]}</span>
              {i18n.language === lang && (
                <span className="language-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 5.4.3 Settings Namespace (`settings.json`)

```json
{
  "title": "Settings",
  "subtitle": "Manage your preferences",
  "language": {
    "title": "Language",
    "description": "Select your preferred display language. The interface will update immediately.",
    "current": "Current language: {{language}}",
    "browserDetected": "Detected from browser: {{language}}"
  }
}
```

#### 5.4.4 Sidebar Settings Link

In `Sidebar.tsx`, a Settings link is added **above the Logout button** in the sidebar footer:

```tsx
<div className="sidebar-footer">
  {/* Settings link (above Logout) */}
  <NavLink
    to="/settings"
    className={({ isActive }) => `sidebar-settings-btn${isActive ? ' active' : ''}`}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1
        0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33
        1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65
        1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83
        0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65
        0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65
        0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1
        0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65
        1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65
        1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0
        0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33
        1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0
        1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
    <span>{t('footer.settings')}</span>
  </NavLink>

  {/* Logout button */}
  <button className="sidebar-logout-btn" onClick={() => forceLogout()} title={t('footer.logout')}>
    ...
  </button>
  <div className="sidebar-footer-text">{t('footer.version', { version: '0.1.0' })}</div>
</div>
```

### 5.5 Server-Side Error Code Translation

**Current server response:**
```json
{
  "error": "admin_required",
  "message": "This endpoint requires admin privileges"
}
```

**Frontend translation approach:**

The `message` field remains English (for logging/debugging). The frontend translates based on the `error` code:

```typescript
// src/api/client.ts
import i18n from '../i18n';

function translateApiError(response: ApiErrorResponse): string {
  const key = `common:errors.api.${response.error}`;
  if (i18n.exists(key)) {
    return i18n.t(key);
  }
  // Fallback to server-provided English message
  return response.message;
}
```

**common.json additions:**
```json
{
  "errors": {
    "api": {
      "admin_required": "This endpoint requires admin privileges.",
      "authentication_required": "Authentication is required.",
      "admin_email_required": "Admin email verification required.",
      "admin_email_not_whitelisted": "Your email is not in the admin whitelist.",
      "bad_request": "Invalid request.",
      "unauthorized": "Invalid credentials.",
      "forbidden": "Access denied.",
      "not_found": "Resource not found.",
      "conflict": "Resource already exists.",
      "validation_error": "Validation failed.",
      "internal_error": "Server error. Please try again later.",
      "rate_limited": "Too many requests. Please wait."
    }
  }
}
```

### 5.6 Date/Time Formatting

Use `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` for locale-aware formatting:

```typescript
// src/i18n/formatters.ts
export function formatDate(date: Date | string, language: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string, language: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: Date | string, language: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

  if (days > 0) return rtf.format(-days, 'day');
  if (hours > 0) return rtf.format(-hours, 'hour');
  if (minutes > 0) return rtf.format(-minutes, 'minute');
  return rtf.format(-seconds, 'second');
}

export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value);
}

export function formatPercent(value: number, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}
```

### 5.7 TypeScript Type Safety

**File: `src/i18n/types.ts`**

```typescript
import type common from '../../public/locales/en/common.json';
import type sidebar from '../../public/locales/en/sidebar.json';
import type auth from '../../public/locales/en/auth.json';
import type overview from '../../public/locales/en/overview.json';
// ... other namespaces

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      sidebar: typeof sidebar;
      auth: typeof auth;
      overview: typeof overview;
      // ... other namespaces
    };
  }
}
```

This enables IDE autocompletion for translation keys: `t('stats.totalUsers')` will be checked at compile time.

---

## 6. Server-Side Changes

### 6.1 User Language Preference

**DB Migration: `migrations/XXX_user_language.sql`**

```sql
ALTER TABLE users
ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en' NOT NULL;
```

### 6.2 API Changes

**`GET /api/v1/admin/auth/me`** — Response includes `preferredLanguage`:

```json
{
  "user": {
    "id": "...",
    "displayName": "...",
    "email": "...",
    "tier": "free",
    "role": "admin",
    "preferredLanguage": "ja"
  }
}
```

**`PATCH /api/v1/admin/auth/me/language`** — Update language preference:

```
Request:  { "language": "ja" }
Response: { "language": "ja" }
```

### 6.3 Server Error Messages

**No changes to server error message text.** The server continues to return English `message` fields for logging consistency. The frontend translates based on the `error` code field.

Server error response format (unchanged):
```json
{
  "error": "not_found",
  "message": "User not found"
}
```

---

## 7. UI/UX Design

### 7.1 Language Switcher Placement Overview

Language switching is available in **two distinct locations**:

| Location | Component | When | How |
|----------|-----------|------|-----|
| **Login page** | Compact dropdown (top-right of header) | Before authentication | 🌐 dropdown in login card header |
| **Settings page** (`/settings`) | Full settings page with language cards | After authentication | Navigate via sidebar ⚙ Settings link |

### 7.2 Login Page — Language Switcher

```
┌─────────────────────────────────────────────────┐
│                                                   │
│        ┌──────────────────────────────┐           │
│        │ ┌───┐                        │           │
│        │ │ G │   GRC Admin    🌐 EN ▼ │           │
│        │ └───┘   Dashboard            │           │
│        │  Sign in to access ...       │           │
│        ├──────────────────────────────┤           │
│        │ [Sign In] [Create Account]   │           │
│        ├──────────────────────────────┤           │
│        │  Email: [_______________]    │           │
│        │  Password: [____________]    │           │
│        │  [      Sign In       ]      │           │
│        └──────────────────────────────┘           │
│                                                   │
└─────────────────────────────────────────────────┘
```

- **Position**: Top-right corner of the login card header (blue gradient area)
- **Style**: Compact — globe icon 🌐 + current language code (e.g., "EN") + dropdown arrow ▼
- **Behavior**: Native `<select>` dropdown; selecting a language:
  1. Changes `i18n.language` immediately
  2. All login/register text updates without page reload
  3. Saves to `localStorage('grc-language')` only (no server call — not authenticated)
- **Default language**: Auto-detected from `navigator.language`:
  - `ja` / `ja-JP` → Japanese
  - `zh` / `zh-CN` / `zh-TW` → Chinese Simplified
  - `ko` / `ko-KR` → Korean
  - `en` / `en-US` / anything else → English (fallback)

### 7.3 Sidebar — Settings Menu

```
┌──────────────────────┐
│ G  GRC Admin         │
│    Dashboard         │
│──────────────────────│
│ 🏠 Overview          │
│                      │
│ 👤 Auth ›            │
│    Users             │
│    API Keys          │
│ ...                  │
│ ✨ Platform ›        │
│    Values            │
│──────────────────────│
│ ⚙ Settings           │  ← NEW: Settings link (above Logout)
│ ⎗ Logout             │
│ GRC v0.1.0           │
└──────────────────────┘
```

- **Position**: Sidebar footer, directly **above** the Logout button
- **Style**: Same styling as Logout button (icon + text), using gear ⚙ icon
- **Behavior**: `<NavLink to="/settings">` — navigates to the Settings page
- **Active state**: Highlighted when current path is `/settings`

### 7.4 Settings Page (`/settings`)

```
┌──────────┬────────────────────────────────────────────┐
│ Sidebar  │  Settings                                   │
│          │  Manage your preferences                    │
│          │                                              │
│          │  ┌─ Language ─────────────────────────────┐  │
│          │  │                                         │  │
│          │  │  Select your preferred display language. │  │
│          │  │  The interface will update immediately.  │  │
│          │  │                                         │  │
│          │  │  ┌─────────┐  ┌─────────┐              │  │
│          │  │  │ 🇺🇸      │  │ 🇨🇳      │              │  │
│          │  │  │ English  │  │ 简体中文  │              │  │
│          │  │  │    ✓     │  │         │              │  │
│          │  │  └─────────┘  └─────────┘              │  │
│          │  │                                         │  │
│          │  │  ┌─────────┐  ┌─────────┐              │  │
│          │  │  │ 🇯🇵      │  │ 🇰🇷      │              │  │
│          │  │  │ 日本語    │  │ 한국어    │              │  │
│          │  │  │         │  │         │              │  │
│          │  │  └─────────┘  └─────────┘              │  │
│          │  │                                         │  │
│          │  └─────────────────────────────────────────┘  │
│          │                                              │
│ ⚙ Settings                                             │
│ ⎗ Logout │                                              │
│ GRC v0.1 │                                              │
└──────────┴────────────────────────────────────────────┘
```

- **Layout**: Standard page layout with page title + subtitle
- **Language section**: Card grid (2×2) with country flags, native language names, and checkmark for active language
- **Click behavior**: Clicking a language card:
  1. `i18n.changeLanguage(lang)` — all text updates instantly
  2. Saves to `localStorage('grc-language')`
  3. `PATCH /api/v1/admin/auth/me/language` called in background (server persistence)
  4. Active card gets highlighted border + ✓ checkmark
- **Extensibility**: Future settings (theme, notifications, etc.) can be added as additional sections below the language section

### 7.5 Language Detection & Default Behavior

**First visit (no localStorage set):**

```
Browser: navigator.language = "ja-JP"
    ↓
i18next-browser-languagedetector checks navigator.language
    ↓
"ja-JP" → matches "ja" in SUPPORTED_LANGUAGES
    ↓
Login page and all UI displayed in Japanese
```

**First visit with unsupported browser language:**

```
Browser: navigator.language = "fr-FR"
    ↓
i18next-browser-languagedetector checks navigator.language
    ↓
"fr-FR" → NOT in SUPPORTED_LANGUAGES
    ↓
Fallback to "en" (English)
```

**Returning user (localStorage set):**

```
localStorage('grc-language') = "ko"
    ↓
i18next-browser-languagedetector checks localStorage FIRST
    ↓
UI displayed in Korean (regardless of browser language)
```

**After authentication (server preference sync):**

```
User logs in → GET /api/v1/admin/auth/me
    ↓
Response: { user: { preferredLanguage: "zh" } }
    ↓
If localStorage is not set OR differs from server:
    i18n.changeLanguage("zh")
    localStorage.setItem('grc-language', 'zh')
```

### 7.6 Language Switching Behavior Summary

| Action | Login Page | Settings Page |
|--------|-----------|---------------|
| UI element | Compact 🌐 dropdown | Language card grid (2×2) |
| Language change | Instant (no reload) | Instant (no reload) |
| localStorage | ✅ Saved | ✅ Saved |
| Server sync | ❌ (not authenticated) | ✅ `PATCH /me/language` |
| Page reload | Not required | Not required |

### 7.7 CJK Typography Considerations

```css
/* Add to index.css */
:root {
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    /* CJK fonts */
    'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR',
    'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei',
    sans-serif;
}

/* CJK-specific adjustments */
html[lang="zh"],
html[lang="ja"],
html[lang="ko"] {
  word-break: break-all;        /* CJK word breaking */
  line-height: 1.7;             /* Slightly more spacing for CJK */
}

html[lang="ja"] {
  word-break: normal;           /* Japanese has its own breaking rules */
  overflow-wrap: break-word;
}
```

---

## 8. Translation Workflow

### 8.1 Key Extraction

Use `i18next-parser` to auto-extract keys from source code:

```bash
# package.json script
"scripts": {
  "i18n:extract": "i18next-parser 'src/**/*.{ts,tsx}'"
}
```

Config file `.i18next-parser.config.js`:
```javascript
module.exports = {
  locales: ['en', 'zh', 'ja', 'ko'],
  output: 'public/locales/$LOCALE/$NAMESPACE.json',
  input: ['src/**/*.{ts,tsx}'],
  defaultNamespace: 'common',
  keySeparator: '.',
  namespaceSeparator: ':',
};
```

### 8.2 Translation Process

```
1. Developer adds new UI text
   └── Uses t('namespace:key') in component

2. Run extraction
   └── npm run i18n:extract
   └── New keys added to en/*.json with source text
   └── New keys added to zh/ja/ko/*.json with empty strings

3. Translation
   └── Translate empty strings in zh/ja/ko JSON files
   └── Can use AI-assisted translation as starting point
   └── Human review for quality

4. Verification
   └── Switch language in dashboard to verify
   └── Check for truncation, overflow, alignment issues
```

### 8.3 Quality Assurance

- **Missing translation detection**: i18next logs warnings for missing keys in development
- **Key coverage report**: Script to check translation completion percentage per language
- **Visual testing**: Screenshot comparison across languages to catch layout issues

---

## 9. File Change List

### Dashboard (`C:\work\grc\dashboard`)

| File | Change |
|------|--------|
| `package.json` | **Modify** — Add i18next dependencies |
| `src/i18n/index.ts` | **New** — i18next initialization |
| `src/i18n/types.ts` | **New** — TypeScript type definitions |
| `src/i18n/formatters.ts` | **New** — Date/number formatters |
| `src/i18n/LoginLanguageSwitcher.tsx` | **New** — Compact language switcher for login page |
| `src/pages/settings/Settings.tsx` | **New** — Settings page with language selection |
| `src/main.tsx` | **Modify** — Import i18n, add Suspense |
| `src/index.css` | **Modify** — CJK font stack, lang-specific CSS, settings page styles |
| `src/App.tsx` | **Modify** — Add `/settings` route |
| `src/components/Sidebar.tsx` | **Modify** — useTranslation, add Settings link above Logout |
| `src/components/AuthGuard.tsx` | **Modify** — useTranslation, add LoginLanguageSwitcher |
| `src/components/DataTable.tsx` | **Modify** — useTranslation for pagination/empty |
| `src/components/ErrorMessage.tsx` | **Modify** — useTranslation for error text |
| `src/components/StatCard.tsx` | **Modify** — Locale-aware number formatting |
| `src/components/StatusBadge.tsx` | **Modify** — useTranslation for status labels |
| `src/api/client.ts` | **Modify** — Add translateApiError helper |
| `src/pages/Overview.tsx` | **Modify** — useTranslation('overview') |
| `src/pages/auth/Users.tsx` | **Modify** — useTranslation('users') |
| `src/pages/auth/ApiKeys.tsx` | **Modify** — useTranslation('apikeys') |
| `src/pages/skills/Skills.tsx` | **Modify** — useTranslation('skills') |
| `src/pages/skills/SkillStats.tsx` | **Modify** — useTranslation('skills') |
| `src/pages/evolution/Assets.tsx` | **Modify** — useTranslation('evolution') |
| `src/pages/evolution/AssetDetail.tsx` | **Modify** — useTranslation('evolution') |
| `src/pages/evolution/Nodes.tsx` | **Modify** — useTranslation('evolution') |
| `src/pages/evolution/Pipeline.tsx` | **Modify** — useTranslation('evolution') |
| `src/pages/update/Releases.tsx` | **Modify** — useTranslation('update') |
| `src/pages/update/UpdateStats.tsx` | **Modify** — useTranslation('update') |
| `src/pages/telemetry/Insights.tsx` | **Modify** — useTranslation('telemetry') |
| `src/pages/community/Channels.tsx` | **Modify** — useTranslation('community') |
| `src/pages/community/Topics.tsx` | **Modify** — useTranslation('community') |
| `src/pages/community/PostDetail.tsx` | **Modify** — useTranslation('community') |
| `src/pages/community/Moderation.tsx` | **Modify** — useTranslation('community') |
| `src/pages/employees/Employees.tsx` | **Modify** — useTranslation('employees') |
| `src/pages/employees/OrgChart.tsx` | **Modify** — useTranslation('employees') |
| `src/pages/roles/RoleTemplates.tsx` | **Modify** — useTranslation('roles') |
| `src/pages/roles/RoleEditor.tsx` | **Modify** — useTranslation('roles') |
| `src/pages/roles/RoleCreate.tsx` | **Modify** — useTranslation('roles') |
| `src/pages/roles/RoleAssign.tsx` | **Modify** — useTranslation('roles') |
| `src/pages/tasks/TaskBoard.tsx` | **Modify** — useTranslation('tasks') |
| `src/pages/tasks/TaskDetail.tsx` | **Modify** — useTranslation('tasks') |
| `src/pages/tasks/TaskCreate.tsx` | **Modify** — useTranslation('tasks') |
| `src/pages/tasks/TaskStatsPage.tsx` | **Modify** — useTranslation('tasks') |
| `src/pages/tasks/ExpenseQueue.tsx` | **Modify** — useTranslation('tasks') |
| `src/pages/strategy/Strategy.tsx` | **Modify** — useTranslation('strategy') |
| `src/pages/a2a-agents/AgentList.tsx` | **Modify** — useTranslation('agents') |
| `src/pages/a2a-agents/AgentDetail.tsx` | **Modify** — useTranslation('agents') |
| `src/pages/meetings/MeetingList.tsx` | **Modify** — useTranslation('meetings') |
| `src/pages/meetings/MeetingDetail.tsx` | **Modify** — useTranslation('meetings') |
| `src/pages/meetings/MeetingCreate.tsx` | **Modify** — useTranslation('meetings') |
| `src/pages/meetings/MeetingLive.tsx` | **Modify** — useTranslation('meetings') |
| `src/pages/meetings/AutoTriggers.tsx` | **Modify** — useTranslation('meetings') |
| `src/pages/relay/RelayLog.tsx` | **Modify** — useTranslation('relay') |
| `src/pages/platform/Values.tsx` | **Modify** — useTranslation('platform') |
| `public/locales/en/*.json` (21 files) | **New** — English translations |
| `public/locales/zh/*.json` (21 files) | **New** — Chinese translations |
| `public/locales/ja/*.json` (21 files) | **New** — Japanese translations |
| `public/locales/ko/*.json` (21 files) | **New** — Korean translations |

### Server (`C:\work\grc`)

| File | Change |
|------|--------|
| `migrations/XXX_user_language.sql` | **New** — Add preferred_language column |
| `src/modules/auth/schema.ts` | **Modify** — Add preferredLanguage field |
| `src/modules/auth/admin-routes.ts` | **Modify** — Return preferredLanguage in /me, add PATCH /me/language |

**Total: ~50 modified files + 84 new translation JSON files + 5 new TS/TSX files + 1 migration**

---

## 10. Implementation Phases

### Phase 1: Infrastructure (1 day)

- Install dependencies
- Create `src/i18n/` module (init, types, formatters, LoginLanguageSwitcher)
- Create English translation files for `common`, `sidebar`, `auth`, and `settings` namespaces
- Integrate i18n into `main.tsx` (Suspense + i18n import)
- Create Settings page (`/settings`) with language card grid
- Add Settings link to Sidebar footer (above Logout)
- Add LoginLanguageSwitcher to login page header (AuthGuard)
- Add `/settings` route to App.tsx
- Add DB migration for `preferred_language`
- Add language preference API endpoints
- Implement browser language auto-detection (default = browser lang; fallback = English)

### Phase 2: Core Components (1 day)

- Migrate shared components: Sidebar, AuthGuard, DataTable, ErrorMessage, StatCard, StatusBadge
- Migrate `api/client.ts` error translation
- Verify all shared strings display correctly

### Phase 3: Page Migration (2 days)

- Migrate all page components (batch by module)
- Create English translation files for all namespaces
- Day 1: Overview, Users, API Keys, Skills, Evolution, Update, Telemetry
- Day 2: Community, Employees, Roles, Tasks, Strategy, Agents, Meetings, Relay, Platform

### Phase 4: Translation (2 days)

- Create Chinese (zh) translations for all namespaces
- Create Japanese (ja) translations for all namespaces
- Create Korean (ko) translations for all namespaces
- Use AI-assisted translation with human review

### Phase 5: Testing & Polish (1 day)

- Test all pages in all 4 languages
- Fix layout issues (text overflow, truncation)
- Verify date/number formatting
- Cross-browser testing
- Performance verification (bundle size, lazy loading)

**Total estimated: 7 days**

---

## 11. Testing Plan

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Default language detection | Fresh browser visit (clear localStorage) | Login page displays in browser's language (or English if unsupported) |
| Login page switcher | Click 🌐 dropdown on login page | All login/register text updates instantly, no page reload |
| Settings page navigation | Click ⚙ Settings in sidebar | Navigates to `/settings`, shows language card grid |
| Settings page language change | Click a language card on Settings page | All UI text updates instantly, card shows ✓, server sync fires |
| Persistence | Switch to 日本語 on Settings page, refresh | Japanese remains after refresh (localStorage persists) |
| Fallback | Delete a key from ja.json | Falls back to English for that key |
| Login page i18n | Switch language on login page | All login/register text translates |
| Unsupported browser language | Set browser to French, clear localStorage | Falls back to English |
| CJK layout | Switch to zh/ja/ko | No text truncation, proper word breaking |
| Date formatting | View dates in ja locale | Shows Japanese date format (2026年3月9日) |
| Number formatting | View numbers in all locales | Locale-appropriate separators |
| API error translation | Trigger 403 error in zh | Shows Chinese error message |
| Missing translation log | Open console in dev mode | Warning logged for missing keys |
| Lazy loading | Navigate to Skills page | skills.json loaded on demand (network tab) |
| Bundle size | Production build | < 5KB increase in main bundle |
| TypeScript safety | Use wrong key `t('nonexist')` | TypeScript compile error |

---

## 12. Appendix: Sample Translations

### A. Sidebar Navigation (4 languages)

| Key | EN | ZH | JA | KO |
|-----|----|----|----|----|
| sections.auth | Auth | 认证管理 | 認証 | 인증 |
| sections.skills | Skills | 技能 | スキル | 스킬 |
| sections.evolution | Evolution | 进化 | エボリューション | 에볼루션 |
| sections.update | Update | 更新 | アップデート | 업데이트 |
| sections.telemetry | Telemetry | 遥测 | テレメトリー | 텔레메트리 |
| sections.community | Community | 社区 | コミュニティ | 커뮤니티 |
| sections.employees | Employees | 员工 | 従業員 | 직원 |
| sections.roles | Roles | 角色 | ロール | 역할 |
| sections.tasks | Tasks | 任务 | タスク | 태스크 |
| sections.strategy | Strategy | 战略 | 戦略 | 전략 |
| sections.a2aAgents | A2A Agents | A2A 代理 | A2A エージェント | A2A 에이전트 |
| sections.meetings | Meetings | 会议 | ミーティング | 미팅 |
| sections.relay | Relay | 中继 | リレー | 릴레이 |
| sections.platform | Platform | 平台 | プラットフォーム | 플랫폼 |
| footer.settings | Settings | 设置 | 設定 | 설정 |
| footer.logout | Logout | 退出 | ログアウト | 로그아웃 |

### B. Common Buttons (4 languages)

| Key | EN | ZH | JA | KO |
|-----|----|----|----|----|
| buttons.save | Save | 保存 | 保存 | 저장 |
| buttons.cancel | Cancel | 取消 | キャンセル | 취소 |
| buttons.confirm | Confirm | 确认 | 確認 | 확인 |
| buttons.delete | Delete | 删除 | 削除 | 삭제 |
| buttons.edit | Edit | 编辑 | 編集 | 편집 |
| buttons.create | Create | 创建 | 作成 | 생성 |
| buttons.search | Search | 搜索 | 検索 | 검색 |
| buttons.loading | Loading... | 加载中... | 読み込み中... | 로딩 중... |

### C. Login Page (4 languages)

| Key | EN | ZH | JA | KO |
|-----|----|----|----|----|
| login.title | GRC Admin Dashboard | GRC 管理控制台 | GRC 管理ダッシュボード | GRC 관리 대시보드 |
| login.subtitle | Sign in to access your admin panel | 登录以访问管理面板 | 管理パネルにサインイン | 관리 패널에 로그인 |
| login.tabSignIn | Sign In | 登录 | サインイン | 로그인 |
| login.tabCreateAccount | Create Account | 创建账户 | アカウント作成 | 계정 생성 |
| login.emailLabel | Email address | 邮箱地址 | メールアドレス | 이메일 주소 |
| login.passwordLabel | Password | 密码 | パスワード | 비밀번호 |
| login.signInButton | Sign In | 登录 | サインイン | 로그인 |
| login.orContinueWith | Or continue with | 或通过以下方式继续 | または以下で続行 | 또는 다음으로 계속 |

### D. Settings Page (4 languages)

| Key | EN | ZH | JA | KO |
|-----|----|----|----|----|
| title | Settings | 设置 | 設定 | 설정 |
| subtitle | Manage your preferences | 管理您的偏好设置 | 設定を管理 | 환경 설정 관리 |
| language.title | Language | 语言 | 言語 | 언어 |
| language.description | Select your preferred display language. The interface will update immediately. | 选择您的首选显示语言。界面将立即更新。 | 表示言語を選択してください。インターフェースは即座に更新されます。 | 원하는 표시 언어를 선택하세요. 인터페이스가 즉시 업데이트됩니다. |
