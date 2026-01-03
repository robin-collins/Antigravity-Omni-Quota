# Changelog

All notable changes to the **Antigravity Omni-Quota** extension will be documented in this file.

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

*Initial release of the 1.0 stable branch.*
