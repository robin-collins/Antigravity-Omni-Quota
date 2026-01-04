# Changelog

All notable changes to the **Antigravity Omni-Quota** extension will be documented in this file.

## [1.0.6] - 2026-01-04

### Added

- **Configurable Limits**: Added `antigravity-quota.maxAccounts` setting to control the maximum number of tracked accounts (default: 10).
- **UI**: Added email display in the account list.

### Fixed

- **Cleanup**: Removed unused `onView:quotaExplorer` activation event.
- **Bug**: Fixed a bug stopping the extension from identifying accounts.

## [1.0.5] - 2026-01-03

### Added

- **Visual Showcase**: Added high-quality screenshots and demonstrations to the README to better showcase the extension's premium UI.
- **Enhanced Branding**: Updated project assets for a better presence in the VS Code Marketplace and Open VSX.

## [1.0.4] - 2026-01-03

### Improved

- **Startup Speed**: Optimized the activation sequence to perform an immediate data fetch and time calculation. Data now appearing as soon as the extension finishes activating, eliminating the initial 15-30 second wait.
- **Activation Lifecycle**: Refined the extension lifecycle to ensure all providers are fully synchronized before the UI is presented.

## [1.0.3] - 2026-01-03

### Fixed

- **Missing Dependency**: Bundled `axios` and other dependencies into a single file to prevent "Module not found" errors on fresh installations.
- **Improved Reliability**: Switched to `esbuild` for production bundling.

## [1.0.2] - 2026-01-03

### Fixed

- **Sidebar Provider Error**: Fixed the "no data provider registered" error by adding explicit activation events (`onView:quotaExplorer`) and redundant provider registration.
- **Activation Reliability**: Improved extension startup sequence to ensure the Quota Explorer is always available.

## [1.0.0] - 2026-01-03

### Added

- **Multi-Account Hub**: Persistence for multiple Antigravity accounts in the sidebar.
- **Zero-Config Scanning**: Automatic detection of Antigravity processes and ports.
- **Real-Time Countdowns**: Relative reset time calculations for all accounts.
- **Premium UI**: Rich Markdown tooltips for the status bar and native Codicons for the tree view.
- **Multi-Language Support**: English, Spanish, Russian, Chinese, Korean, Japanese, French, and German.
- **Documentation**: Comprehensive technical docs and revamped README.
- **Branding**: Official extension icon and professional metadata.

---

_Initial release of the 1.0 stable branch._
