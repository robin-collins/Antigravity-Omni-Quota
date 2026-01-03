# Source File Breakdown

A granular look at the files that make up this extension.

### `src/extension.ts`
The "Brain" of the project.
- **`activate()`**: Entry point. Sets up the command registrations and starts the polling intervals.
- **`runCheck()`**: The main workflow. Orchestrates the scan, fetches data, updates the manager, and refreshes the UI.
- **`updateAllAccountsTimes()`**: The logic specifically designed to keep countdowns accurate across all accounts in the sidebar.
- **`updateStatusBar()`**: Manages the bottom bar. It handles **Rich Markdown Tooltips**, rich dashboard summaries, and respects the `selectedModel` preference.

### `src/accountManager.ts`
The "Database" interface.
- **`AccountData` Interface**: Defines the structure of what an account is. Crucial: `resetTimestamp` for models.
- **`updateAccount()`**: Merges new data into the cache and saves it to `globalState`.
- **`cleanupInvalidAccounts()`**: Utility to remove "garbage" data (like accounts named 'undefined' or 'Usuario').

### `src/quotaService.ts`
The "Scanner" and Networking layer.
- **`GetUnleashData` / `GetUserStatus`**: Pure functions that perform HTTP POST requests to the local Antigravity server.
- **Process Discovery**: Cross-platform logic (Windows/Unix) to find the Antigravity process and its communication ports.

### `src/quotaProvider.ts`
The "Viewer" (Sidebar).
- **`QuotaProvider` class**: Implements the `vscode.TreeDataProvider`. It decides how accounts are sorted (most recent first) and how they look (icons, descriptions).
- **`QuotaItem` class**: A custom wrapper for `vscode.TreeItem` that handles the logic for different icons based on percentage.

### `src/translations.ts`
The "Polyglot" system.
- **`translations` object**: A large dictionary containing strings for English, Spanish, Russian, Chinese, etc.
- **`getTranslation()`**: A smart function that detects the VS Code locale and falls back to English if a key is missing.

---

## Important Specialized Functions

### `forceRefresh()`
Used when the user manually clicks "Refresh". It resets the internal polling timers to ensure the UI updates immediately.

### `bootstrapping logic` (internal to `updateAllAccountsTimes`)
A critical "JR" lesson: always plan for legacy data. This logic "heals" old account data that was saved without timestamps, allowing for a smooth upgrade path.
