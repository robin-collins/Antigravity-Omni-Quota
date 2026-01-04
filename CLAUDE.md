# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run compile      # TypeScript compilation (outputs to out/)
npm run watch        # Watch mode for development
npm run bundle       # Production build with esbuild (outputs to dist/)
```

**Running the extension**: Press `F5` in VS Code to launch the Extension Development Host.

## Architecture Overview

This is a VS Code extension that monitors Antigravity AI quota usage across multiple accounts. The extension auto-detects running Antigravity language server processes without requiring user login.

### Core Modules

- **`src/extension.ts`** - Entry point. Handles activation, command registration, and the dual-interval polling system (30s full scan + 15s UI update loop).

- **`src/quotaService.ts`** - Zero-config detection engine. Uses PowerShell to find `language_serverw_indows` processes, extracts CSRF tokens from command lines, probes ports via netstat, and communicates with local Antigravity APIs at `127.0.0.1:{port}`.

- **`src/accountManager.ts`** - Account persistence layer using VS Code's `globalState`. Handles validation (rejects placeholder names like "undefined", "Usuario"), deduplication, and enforces configurable account limits.

- **`src/quotaProvider.ts`** - VS Code TreeDataProvider implementation for the sidebar. Uses native codicons for status indicators.

- **`src/translations.ts`** - i18n support for 8 languages (en, es, ru, zh, ko, ja, fr, de).

### Key Design Patterns

1. **Timestamp Bootstrap**: When reading legacy accounts without timestamps, the extension parses relative time strings (e.g., "in 2h 5m") to estimate reset times, enabling accurate countdown display for offline accounts.

2. **Process Detection Flow**: PowerShell → parse PIDs → netstat for ports → probe each port with `GetUnleashData` → successful port becomes the API endpoint.

3. **Account Identity**: Generated from `installationId + email`, used for deduplication across sessions.

## Configuration

Extension settings are prefixed with `antigravity-quota.*` in VS Code settings. Key options: `pollingInterval`, `warningThreshold`, `criticalThreshold`, `maxAccounts`, `language`.

## Account Storage & Detection Details

### Where Account Data is Stored

| Location | Type | Key/Path | Purpose |
|----------|------|----------|---------|
| VS Code `globalState` | Persistent | `'antigravity_accounts'` | Main account storage (survives restarts) |
| In-memory `Map<string, AccountData>` | Cache | `AccountManager.cache` | Fast access during runtime |
| VS Code `workspaceState` | Session | `'lastData'`, `'selectedModel'` | Current session UI state |

**Storage file location**: VS Code stores globalState in:
- Windows: `%APPDATA%\Code\User\globalStorage\<extension-id>\`

### Account Data Structure

```typescript
interface AccountData {
    id: string;              // Format: "{installationId}_{email}" or "{installationId}_{name}"
    displayName: string;     // User's real name from API
    lastActive: number;      // Unix timestamp of last update
    quota: { total, used, remaining }
    models?: { name, percentage, resetTime?, resetTimestamp? }[]
    tier: string;            // Always 'Pro' currently
}
```

### Detection Triggers

1. **Startup**: `runCheck()` called during activation
2. **Polling**: Every 30 seconds (configurable via `pollingInterval`)
3. **Manual refresh**: Commands `antigravity-quota.refresh`, `antigravity-quota.forceRefresh`
4. **Window focus**: If `autoRefreshOnFocus` setting enabled

### Detection Sequence (quotaService.ts)

```
1. PowerShell: Find all 'language_server_windows' processes
   └── Get-CimInstance Win32_Process -Filter "Name like '%language_server_windows%'"

2. For each process:
   └── Extract CSRF token from command line (--csrf_token argument)
   └── Use netstat to find listening ports for this PID

3. For each port:
   └── Probe with GetUnleashData API call (HTTPS, fallback to HTTP)
   └── On success: save connection info (port, token, initial data)

4. For each successful connection:
   └── Call GetUserStatus API to get user info
   └── Extract: name, email, cascadeModelConfigData (quota info)
   └── Generate userId: "{installationId}_{email or name}"
   └── Validate and persist via accountManager.updateAccount()
```

### Auth Token Sources

| File | Purpose |
|------|---------|
| `~/.gemini/oauth_creds.json` | OAuth access token (cached 1 minute) |
| `~/.gemini/antigravity/installation_id` | Installation identifier |
