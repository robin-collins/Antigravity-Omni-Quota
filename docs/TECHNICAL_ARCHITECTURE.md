# Technical Architecture

This document explains how Antigravity Omni-Quota operates under the hood.

## 1. Zero-Config Scanning Logic
The core "magic" of the extension lies in `src/quotaService.ts`. Instead of asking for a login, it:
1.  Lists all active processes (PIDs) on the OS.
2.  Identifies files associated with the Antigravity language server (e.g., `dist/extension.js`).
3.  Calculates potential ports where the Antigravity local API might be listening.
4.  Attempts to connect to these local APIs via HTTP to fetch the real-time `userStatus` and `quotaInfo`.

## 2. Polling & Monitoring System
The extension operates on two different schedules:
- **Primary Loop (30-60s)**: Performs a full system scan, detects new accounts, updates quota percentages, and cleans up invalid data.
- **Fast UI Loop (15s)**: Only updates the "Relative Time" strings (e.g., "in 5m"). This is purely local calculation based on timestamps, saving CPU and battery by avoiding network/process checks.

## 3. The Bootstrap & Timestamp Strategy
A common problem in quota tracking is that servers give you a string like "2026-01-03T12:00:00Z", but if you close that session, you lose the reference.
- **Timestamp Persistence**: When the extension sees an account, it converts the server's time into a Unix Timestamp (milliseconds).
- **Offline Bootstrapping**: If an account was saved using an old version without a timestamp, the extension "Bootstraps" it by parsing the human-readable string and estimating the reset time. This ensures that even "offline" accounts keep counting down correctly.

## 4. Multi-Account Management
The `AccountManager` class handles the heavy lifting of storage:
- **ID Generation**: Unique IDs are generated using a combination of the `installationId` and the account email.
- **Data Deduplication**: If multiple processes report the same account, the manager merges them to ensure you don't see duplicates.
- **Limit Enforcement**: It prevents the sidebar from becoming cluttered by enforcing a configurable account limit (default 10).

## 5. UI Rendering
The UI uses the `VS Code Tree Data Provider` API:
- **QuotaProvider**: Dynamically builds the sidebar. It groups models under accounts and adds a special "Settings" node at the bottom for quick access.
- **StatusBar**: Tracks the "Selected Model" from the "Quick Menu". It uses `workspaceState` to remember which model you want to focus on in the bottom bar.
