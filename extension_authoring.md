Web environment detection

⚠️ Breaking change ⚠️

Setting: extensions.supportNodeGlobalNavigator

The Node.js extension host is now updated to v22 from v20, as part of our Electron 35 runtime update. This update brings in support for the navigator global object in the desktop and remote extension hosts.

This change could introduce a breaking change for extensions that rely on the presence of the navigator object to detect the web environment.

To help extension authors migrate, we have created a polyfill for globalThis.navigator that is initialized to undefined, so your extension continues to work correctly. The polyfill is behind the extensions.supportNodeGlobalNavigator VS Code setting. By default, this setting is disabled and the polyfill is in place. We capture telemetry and log an error (in extension development mode) when your extension tries to access the navigator in this way.

In the future, this setting might be enabled by default, so we urge extension authors to migrate their code to be compatible with the new navigator global object. Follow these steps to migrate your code:

    Check the extension host log for a PendingMigrationError that has error stack originating your extension.
    Ensure checks like typeof navigator === 'object' are migrated to typeof process === 'object' && process.versions.node as needed.
    Enable extensions.supportNodeGlobalNavigator.
    Verify extension behavior remains unchanged.
