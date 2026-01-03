# Antigravity Omni-Quota: Overview & Benefits

## Objective
The primary objective of **Antigravity Omni-Quota** is to provide a unified, persistent, and real-time monitoring system for Antigravity AI quotas. 

While the official Antigravity tools show the quota for the currently logged-in account, **Omni-Quota** acts as a "Multi-Account Hub" that tracks and displays data for all accounts you have ever used, without requiring you to switch between them constantly.

## Key Benefits

### 1. Multi-Account Persistence
The biggest pain point for developers using multiple Antigravity accounts (personal, professional, and experimental) is the need to log in and out to check remaining credits or reset times. 
- **Solution**: Omni-Quota captures session data during active use and persists it to VS Code's `globalState`. Once an account is "seen" once, it stays in your sidebar forever (or until you delete it).

### 2. Global Quota Visibility
View the status of all your accounts in a single Tree View sidebar. 
- **Real-time monitoring**: Even if an account isn't actively being used, the extension calculates its "Relative Reset Time" (e.g., "resets in 2h 15m") using a built-in countdown system.

### 3. Zero-Config Experience
The extension uses a technique called "Zero-Config Scan". It scans local ports currently used by Antigravity language servers.
- **Benefit**: No manual API keys or configuration required. If Antigravity is running, Omni-Quota finds it.

### 4. Dynamic Localization
Supports over 8 languages (Spanish, English, Russian, Chinese, Korean, Japanese, French, German), ensuring that developers around the world can monitor their productivity in their native language.

## Target Audience
- **Power Users**: Developers who juggle multiple Antigravity environments.
- **Juniors**: Programmers looking to understand how VS Code extensions interact with external processes and manage persistence.
- **Teams**: Anyone needing a quick glance at their usage limits without breaking their coding flow.
