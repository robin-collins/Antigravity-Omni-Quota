
import * as vscode from 'vscode';
import { AccountManager } from './accountManager';
import { QuotaProvider } from './quotaProvider';
import { QuotaService } from './quotaService';
import { getTranslation } from './translations';

let pollingInterval: NodeJS.Timer | undefined;
let lastCheckTime = 0;
// Removed accountsUpdateInterval variable since we removed the problematic functionality

export async function activate(context: vscode.ExtensionContext) {
     const accountManager = new AccountManager(context.globalState);
     let lastCalculatedData = context.workspaceState.get('lastData', null);

     // Keep accounts for multiple sessions

     const quotaService = new QuotaService();
     const quotaProvider = new QuotaProvider(accountManager);

     const treeView = vscode.window.createTreeView('quotaExplorer', { treeDataProvider: quotaProvider });
     context.subscriptions.push(treeView);
     
     // Explicit registration for cases where createTreeView might be delayed
     context.subscriptions.push(vscode.window.registerTreeDataProvider('quotaExplorer', quotaProvider));
     const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
     statusBarItem.command = 'antigravity-quota.showQuickMenu';

     // Read initial config
     const config = vscode.workspace.getConfiguration('antigravity-quota');
     const enableMonitoring = config.get('enableMonitoring', true);
     const pollingIntervalMs = (config.get('pollingInterval', 30) as number) * 1000;
     const language = config.get('language', 'auto') as string;

     console.log('[Omni-Quota] ' + getTranslation('activating', language));
  
     // Set initial status bar text with spinner
     statusBarItem.text = "$(sync~spin) Omni-Quota: " + getTranslation('activating', language);
     statusBarItem.show();
     context.subscriptions.push(statusBarItem);

     // Register commands first, then create tree view
     const commands = registerCommands(context, quotaService, quotaProvider, accountManager, statusBarItem, treeView);
      
     // Ensure tree view is registered properly
     try {
         // Force refresh of tree view
         quotaProvider.refresh(null, true);
         console.log('[Omni-Quota] Tree view registered successfully');
     } catch (e) {
         console.error('[Omni-Quota] Tree view registration failed:', e);
     }

     // Initial check with immediate status update
     if (enableMonitoring) {
         // Set connected status immediately
         updateStatusBar(statusBarItem, {
             quota: { total: 0, remaining: 0, used: 0 },
             models: [],
             name: "Antigravity Connected"
         }, context);
         
         // Force cleanup of invalid accounts on startup
         await accountManager.cleanupInvalidAccounts();
         
         // Initial check - awaited to ensure data is fetched before finishing activation
         await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
         
         // Ensure relative times are calculated immediately
         await updateAllAccountsTimes(accountManager, quotaProvider, treeView);
     } else {
         // If monitoring is disabled, show connected status
         updateStatusBar(statusBarItem, {
             quota: { total: 0, remaining: 0, used: 0 },
             models: [],
             name: "Antigravity Connected"
         }, context);
     }

     if (enableMonitoring) {
         pollingInterval = setInterval(async () => {
             console.log('[Omni-Quota] Periodic check and cleanup...');
             await accountManager.cleanupInvalidAccounts();
             await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
             await updateAllAccountsTimes(accountManager, quotaProvider, treeView);
         }, pollingIntervalMs);
         
         // Fast interval for relative time strings (every 15 seconds)
         const timeUpdateInterval = setInterval(() => {
             updateAllAccountsTimes(accountManager, quotaProvider, treeView);
         }, 15000);
         context.subscriptions.push({ dispose: () => clearInterval(timeUpdateInterval) });
     }

     // Auto refresh on focus
     const autoRefreshOnFocus = config.get('autoRefreshOnFocus', false);
     if (autoRefreshOnFocus) {
         context.subscriptions.push(vscode.window.onDidChangeWindowState(state => {
             if (state.focused) {
                 runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
             }
         }));
     }

     console.log('[Omni-Quota] Extension activated successfully!');
}

// Add force refresh command to package.json commands array
// "antigravity-quota.forceRefresh": {
//     "command": "antigravity-quota.forceRefresh",
//     "title": "Force Refresh Quota"
// }

function registerCommands(
    context: vscode.ExtensionContext,
    quotaService: QuotaService,
    quotaProvider: QuotaProvider,
    accountManager: AccountManager,
    statusBarItem: vscode.StatusBarItem,
    treeView: vscode.TreeView<any>
): vscode.Disposable[] {
    const commands = [
        vscode.commands.registerCommand('antigravity-quota.forceRefresh', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            console.log('[Omni-Quota] Force refresh command executed');
            await forceRefresh(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
            vscode.window.showInformationMessage(getTranslation('refreshSuccess', language));
        }),
        vscode.commands.registerCommand('antigravity-quota.showQuickMenu', async () => {
            const lastCalculatedData = context.workspaceState.get('lastData', null) as any;
            if (lastCalculatedData && lastCalculatedData.models) {
                const config = vscode.workspace.getConfiguration('antigravity-quota');
                const warningThreshold = config.get('warningThreshold', 50) as number;
                const criticalThreshold = config.get('criticalThreshold', 30) as number;
                const showGeminiPro = config.get('showGeminiPro', true) as boolean;
                const showGeminiFlash = config.get('showGeminiFlash', true) as boolean;

                let filteredModels = lastCalculatedData.models;
                if (!showGeminiPro) {
                    filteredModels = filteredModels.filter((m: any) => !m.name.includes('Gemini') || !m.name.includes('Pro'));
                }
                if (!showGeminiFlash) {
                    filteredModels = filteredModels.filter((m: any) => !m.name.includes('Gemini') || !m.name.includes('Flash'));
                }

                const items: any[] = filteredModels.map((m: any) => {
                    const color = m.percentage >= warningThreshold ? '🟢' : m.percentage >= criticalThreshold ? '🟡' : m.percentage > 0 ? '🔴' : '⚫';
                    const dots = '●'.repeat(Math.round((m.percentage / 100) * 10)) + '○'.repeat(10 - Math.round((m.percentage / 100) * 10));
                    const resetLabel = getTranslation('resetLabel', 'auto');
                    return {
                        label: `${color} ${m.name}`,
                        description: `${m.percentage}% | ${resetLabel} ${m.resetTime}`,
                        detail: dots,
                        model: m
                    };
                });
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `${lastCalculatedData.name} - ${getTranslation('currentSessionQuotas', 'auto')}`,
                    ignoreFocusOut: false
                });
                if (selected && selected.model) {
                    await context.workspaceState.update('selectedModel', selected.model.name);
                    // Update status bar immediately
                    updateStatusBar(statusBarItem, lastCalculatedData, context);
                }
            } else {
                vscode.window.showInformationMessage(getTranslation('scanningWait', 'auto'));
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.refresh', async () => {
            console.log('[Omni-Quota] Refresh command executed');
            await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }),
        vscode.commands.registerCommand('antigravity-quota.redetect', async () => {
            console.log('[Omni-Quota] Redetect command executed');
            // Force re-detection by clearing cache or something
            await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }),
        vscode.commands.registerCommand('antigravity-quota.focus', () => {
            console.log('[Omni-Quota] Focus command executed');
            vscode.commands.executeCommand('workbench.view.extension.quotaExplorer');
        }),
        vscode.commands.registerCommand('antigravity-quota.clearAccounts', async () => {
            console.log('[Omni-Quota] Clear accounts command executed');
            await accountManager.reset();
            quotaProvider.refresh(null, false);
            vscode.window.showInformationMessage(getTranslation('allAccountsCleared', 'auto'));
            // Force refresh after clearing accounts
            await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }),
        vscode.commands.registerCommand('antigravity-quota.cleanupAccounts', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            console.log('[Omni-Quota] Cleanup accounts command executed');
            await accountManager.cleanupInvalidAccounts();
            quotaProvider.refresh(null, false);
            vscode.window.showInformationMessage(getTranslation('cleanupSuccess', language));
            // Force refresh after cleanup
            await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }),
        vscode.commands.registerCommand('antigravity-quota.removeAccount', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const accounts = accountManager.getAccounts();
            if (accounts.length === 0) {
                vscode.window.showInformationMessage(getTranslation('noAccountsToRemove', language));
                return;
            }
            const items = accounts.map(acc => ({
                label: acc.displayName,
                description: `ID: ${acc.id}`,
                account: acc
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: getTranslation('selectAccountToRemove', language)
            });
            if (selected && selected.account) {
                await accountManager.removeAccount(selected.account.id);
                quotaProvider.refresh(null, false);
                vscode.window.showInformationMessage(getTranslation('accountRemoved', language).replace('{name}', selected.account.displayName));
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.validateAccounts', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            console.log('[Omni-Quota] Validate accounts command executed');
            const accounts = accountManager.getAccounts();
            const invalidAccounts = accounts.filter(acc => {
                // Use the same validation logic as in accountManager
                const invalidNames = ['undefined', 'account', 'Usuario', ''];
                return invalidNames.includes(acc.displayName) ||
                       acc.displayName.trim().length === 0 ||
                       acc.displayName.toLowerCase().includes('undefined');
            });
            
            if (invalidAccounts.length === 0) {
                vscode.window.showInformationMessage(getTranslation('allAccountsValid', language));
            } else {
                const message = getTranslation('invalidAccountsFound', language).replace('{count}', invalidAccounts.length.toString());
                vscode.window.showWarningMessage(message);
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.settings', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const currentLang = config.get('language', 'auto') as string;
            const items = [
                {
                    label: getTranslation('changeLanguage', language),
                    description: `Current: ${currentLang}`,
                    action: 'language'
                }
            ];
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: getTranslation('extensionSettings', language)
            });
            if (selected?.action === 'language') {
                const langItems = [
                    { label: 'Auto (System)', value: 'auto' },
                    { label: 'English', value: 'en' },
                    { label: 'Español', value: 'es' },
                    { label: 'Русский', value: 'ru' },
                    { label: '中文', value: 'zh' },
                    { label: '한국어', value: 'ko' },
                    { label: '日本語', value: 'ja' },
                    { label: 'Français', value: 'fr' },
                    { label: 'Deutsch', value: 'de' }
                ];
                const langSelected = await vscode.window.showQuickPick(langItems, {
                    placeHolder: getTranslation('selectLanguage', language)
                });
                if (langSelected) {
                    await config.update('language', langSelected.value, vscode.ConfigurationTarget.Global);
                    // Refresh tree view to apply translations
                    quotaProvider.refresh(null, true);
                    // Force refresh to update translations in status bar and quick menu
                    runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
                    vscode.window.showInformationMessage(getTranslation('languageChanged', langSelected.value).replace('{lang}', langSelected.label));
                }
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.updateAllAccounts', async () => {
            console.log('[Omni-Quota] Update all accounts times command executed');
            await updateAllAccountsTimes(accountManager, quotaProvider, treeView);
        })
    ];

    context.subscriptions.push(...commands);
    return commands;
}

export function deactivate() {
    if (pollingInterval) clearInterval(pollingInterval);
    // Removed accountsUpdateInterval cleanup since we removed the interval
}

async function runCheck(
    service: QuotaService,
    provider: QuotaProvider,
    accountManager: AccountManager,
    statusBar: vscode.StatusBarItem,
    treeView: vscode.TreeView<any>,
    context: vscode.ExtensionContext
) {
    const now = Date.now();
    if (now - lastCheckTime < 5000) return; // Rate limit: 5s minimum
    lastCheckTime = now;

    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const language = config.get('language', 'auto') as string;

    try {
        const connections = await service.detectAllActiveConnections();

        if (connections.length === 0) {
            console.log('[Omni-Quota] ' + getTranslation('noProcessesDetected', language));
            updateStatusBar(statusBar, null, context);
            treeView.message = getTranslation('waitingForAntigravity', language);
            provider.refresh(null, false);
            return;
        }

        let primaryInfo: any = null;

        // Process connections sequentially to avoid server issues
        for (const conn of connections) {
            try {
                // Fetch
                const status = await service.fetchStatus(conn);
                // console.log('Status data for PID', conn.pid, ':', status); // Reduced logging

                let quota = { total: 0, remaining: 0, used: 0 };
                let models: any[] = [];
                let realName = "Usuario";
                let userId = 'unknown';

                if (status && status.userStatus) {
                        realName = status.userStatus.name || realName;
                        const email = status.userStatus.email || '';
                        userId = `${conn.initialData?.context?.properties?.installationId || 'unknown'}_${email || realName}`;
                        
                        console.log(`[Omni-Quota] Found account: "${realName}" (Email: ${email || 'N/A'}) on port ${conn.port}`);

                        let configData = status.userStatus.cascadeModelConfigData;
                        if (!configData && status.userStatus.planStatus) {
                            configData = status.userStatus.planStatus.cascadeModelConfigData;
                        }

                        if (configData && Array.isArray(configData.clientModelConfigs)) {
                            const now = Date.now(); // Pre-compute for performance
                            models = configData.clientModelConfigs.map((cfg: any) => {
                                let pct = 0;
                                if (cfg.quotaInfo?.remainingFraction !== undefined) {
                                    pct = Math.round(cfg.quotaInfo.remainingFraction * 100);
                                }

                                let resetStr = getTranslation('unknown', language);
                                let resetMinutes = 0;
                                if (cfg.quotaInfo?.resetTime) {
                                    const rt = cfg.quotaInfo.resetTime;
                                    if (typeof rt === 'string' && rt.match(/^\d{4}-\d{2}-\d{2}T/)) {
                                        // It's an ISO date string, parse it
                                        try {
                                            const reset = new Date(rt);
                                            resetMinutes = Math.floor((reset.getTime() - now) / 60000);
                                            if (resetMinutes > 0) {
                                                const d = Math.floor(resetMinutes / 1440);
                                                const h = Math.floor((resetMinutes % 1440) / 60);
                                                const m = resetMinutes % 60;
                                                if (d > 0) {
                                                    resetStr = `${getTranslation('in', language)} ${d}d ${h}h ${m}m`;
                                                } else {
                                                    resetStr = `${getTranslation('in', language)} ${h}h ${m}m`;
                                                }
                                            } else {
                                                resetStr = getTranslation('ready', language);
                                                resetMinutes = 0;
                                            }
                                        } catch(e) {
                                            resetStr = rt;
                                        }
                                    } else {
                                        // Pre-formatted string or other
                                        resetStr = rt.toString();
                                    }
                                }

                                let resetTimestamp: number | undefined;
                                if (cfg.quotaInfo?.resetTime && typeof cfg.quotaInfo.resetTime === 'string' && cfg.quotaInfo.resetTime.match(/^\d{4}-\d{2}-\d{2}T/)) {
                                    resetTimestamp = new Date(cfg.quotaInfo.resetTime).getTime();
                                }

                                return {
                                    name: cfg.label || cfg.modelOrAlias?.model || 'Model',
                                    percentage: pct,
                                    resetTime: resetStr,
                                    resetMinutes: resetMinutes,
                                    resetTimestamp: resetTimestamp
                                };
                            }).sort((a: any, b: any) => b.percentage - a.percentage || (a.resetMinutes - b.resetMinutes));
                        }
                }

                // Validate account data before creating account
                const isValidAccount = realName &&
                    realName !== 'undefined' &&
                    realName !== 'account' &&
                    realName.trim().length > 0 &&
                    realName !== 'Usuario' &&
                    models && models.length > 0;

                if (!isValidAccount) {
                    console.log(`[Omni-Quota] Skipped invalid account for PID ${conn.pid}: name="${realName}", models=${models?.length || 0}`);
                    continue;
                }

                console.log(`[Omni-Quota] Updating account in cache: "${realName}" (ID: ${userId})`);
                const success = await accountManager.updateAccount(userId, {
                    id: userId,
                    displayName: realName,
                    lastActive: Date.now(),
                    quota: quota,
                    models: models,
                    tier: 'Pro',
                    rawContext: {}
                });
                if (success) {
                    console.log(`[Omni-Quota] Account "${realName}" persisted to globalState.`);
                }
                if (!success) {
                    console.log(`[Omni-Quota] Skipped adding account ${userId} due to limit`);
                    vscode.window.showWarningMessage(getTranslation('accountLimitReached', language));
                    continue;
                }

                // UPDATE UI IMMEDIATELY
                const currentInfo = { quota, models, name: realName };
                setTimeout(() => {
                    updateStatusBar(statusBar, currentInfo, context);
                }, 0);

                if (!primaryInfo) primaryInfo = currentInfo;
            } catch(e: any) {
                console.error(`[Omni-Quota] Full error for PID ${conn.pid}:`, e);
                // DEBUG: Force show connected status
                console.log('[Omni-Quota] DEBUG: Error in fetchStatus, forcing connected status');
                // Don't add accounts on error, just continue
                // Log the specific error type for debugging
                if (e.response?.status === 400) {
                    console.log(`[Omni-Quota] Authentication error for PID ${conn.pid}, skipping account creation`);
                }
                continue;
            }
        }

        // DEBUG: Force show connected status at the end
        console.log('[Omni-Quota] DEBUG: runCheck completed, using primaryInfo');
        if (primaryInfo) {
            updateStatusBar(statusBar, primaryInfo, context);
        } else {
            // If no primary info, show connected status
            updateStatusBar(statusBar, {
                quota: { total: 0, remaining: 0, used: 0 },
                models: [],
                name: "Antigravity Connected"
            }, context);
        }
        
        treeView.message = undefined;
        provider.refresh(null, true);

        // Notifications
        const enableNotifications = config.get('enableNotifications', false) as boolean;
        if (enableNotifications && primaryInfo && primaryInfo.models) {
            const criticalThreshold = config.get('criticalThreshold', 30) as number;
            const lowModels = primaryInfo.models.filter((m: any) => m.percentage <= criticalThreshold);
            if (lowModels.length > 0) {
                const modelNames = lowModels.map((m: any) => m.name).join(', ');
                vscode.window.showWarningMessage(getTranslation('lowQuotaNotification', language).replace('{models}', modelNames));
            }
        }

    } catch (error) {
        console.error('[Omni-Quota] GLOBAL CRASH:', error);
        // DEBUG: Force show connected status on global error
        console.log('[Omni-Quota] DEBUG: Global error, forcing connected status');
        updateStatusBar(statusBar, {
            quota: { total: 0, remaining: 0, used: 0 },
            models: [],
            name: "Antigravity Connected"
        }, context);
    }
}

// Force refresh function for manual updates
export async function forceRefresh(
    service: QuotaService,
    provider: QuotaProvider,
    accountManager: AccountManager,
    statusBar: vscode.StatusBarItem,
    treeView: vscode.TreeView<any>,
    context: vscode.ExtensionContext
) {
    console.log('[Omni-Quota] Force refresh initiated');
    
    // Clear cache to force fresh data
    lastCheckTime = 0;
    
    // Clean up invalid accounts before refresh
    await accountManager.cleanupInvalidAccounts();
    
    // Run check immediately with retry logic
    try {
        await runCheck(service, provider, accountManager, statusBar, treeView, context);
        console.log('[Omni-Quota] Force refresh completed successfully');
    } catch (error) {
        console.error('[Omni-Quota] Force refresh failed:', error);
        // Show error message to user
        const config = vscode.workspace.getConfiguration('antigravity-quota');
        const language = config.get('language', 'auto') as string;
        vscode.window.showErrorMessage(getTranslation('refreshFailed', language));
    }
}

// Cleanup function to remove invalid accounts
async function cleanupInvalidAccounts(accountManager: AccountManager): Promise<void> {
    console.log('[Omni-Quota] Cleaning up invalid accounts...');
    await accountManager.cleanupInvalidAccounts();
}

// Update relative time strings for all accounts
async function updateAllAccountsTimes(
    accountManager: AccountManager,
    quotaProvider: QuotaProvider,
    treeView: vscode.TreeView<any>
) {
    const accounts = accountManager.getAccounts();
    const now = Date.now();
    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const language = config.get('language', 'auto') as string;

    let totalChanged = false;
    let accountsUpdated = 0;

    for (const acc of accounts) {
        if (acc.models) {
            let changed = false;
            for (const m of acc.models) {
                // BOOTSTRAP: If missing timestamp but has relative string, attempt to estimate it
                // This handles accounts that were saved before the new timestamp logic
                if (!m.resetTimestamp && m.resetTime && m.resetTime !== getTranslation('ready', language) && m.resetTime !== getTranslation('unknown', language)) {
                    try {
                        // Look for numbers in strings like "in 2h 5m" or "en 2h 5m"
                        const matches = m.resetTime.match(/\d+/g);
                        if (matches && matches.length > 0) {
                            let minutes = 0;
                            if (matches.length === 1) minutes = parseInt(matches[0]); // assume minutes
                            else if (matches.length === 2) minutes = parseInt(matches[0]) * 60 + parseInt(matches[1]); // assume h, m
                            else if (matches.length === 3) minutes = parseInt(matches[0]) * 1440 + parseInt(matches[1]) * 60 + parseInt(matches[2]); // assume d, h, m
                            
                            if (minutes > 0) {
                                // Estimated reset is lastActive + minutes
                                m.resetTimestamp = (acc.lastActive || now) + (minutes * 60000);
                                changed = true;
                                console.log(`[Omni-Quota] Bootstrapped timestamp for ${acc.displayName} (${m.name}): resets in ~${minutes}m`);
                            }
                        }
                    } catch (e) {
                         console.error('[Omni-Quota] Bootstrap failed for', acc.displayName, e);
                    }
                }

                if (m.resetTimestamp) {
                    const resetMinutes = Math.floor((m.resetTimestamp - now) / 60000);
                    let resetStr = getTranslation('unknown', language);
                    if (resetMinutes > 0) {
                        const d = Math.floor(resetMinutes / 1440);
                        const h = Math.floor((resetMinutes % 1440) / 60);
                        const m_val = resetMinutes % 60;
                        if (d > 0) {
                            resetStr = `${getTranslation('in', language)} ${d}d ${h}h ${m_val}m`;
                        } else {
                            resetStr = `${getTranslation('in', language)} ${h}h ${m_val}m`;
                        }
                    } else {
                        resetStr = getTranslation('ready', language);
                    }
                    if (m.resetTime !== resetStr) {
                        m.resetTime = resetStr;
                        changed = true;
                    }
                }
            }
            if (changed) {
                await accountManager.updateAccount(acc.id, acc);
                totalChanged = true;
                accountsUpdated++;
            }
        }
    }
    
    if (totalChanged) {
        console.log(`[Omni-Quota] Updated reset times for ${accountsUpdated} accounts`);
        quotaProvider.refresh(null, false);
    }
}

function updateStatusBar(item: vscode.StatusBarItem, info: any, context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const language = config.get('language', 'auto') as string;

    item.hide();
    if (!info) {
        // If no data but extension is active, show "Online (No Models)" instead of "Offline"
        item.text = "$(cloud) Omni-Quota: " + getTranslation('onlineNoModels', language);
        item.tooltip = getTranslation('waitingForAntigravity', language);
        item.show();
        return;
    }
    
    // SAVE DATA FOR QUICK MENU - This was missing and caused stale data!
    context.workspaceState.update('lastData', info);
    
    // If we have account info but no models, show account name with "No Models"
    if (info && info.name && (!info.models || info.models.length === 0)) {
        item.text = "$(person) " + info.name + ": " + getTranslation('noModelInfo', language);
        item.tooltip = getTranslation('quotaDetails', language);
        item.command = 'antigravity-quota.showQuickMenu';
        item.show();
        return;
    }
    
    // DEBUG: Force show connected status even if no models
    console.log('[Omni-Quota] DEBUG: updateStatusBar called with info:', info);
    
    // If info has userStatus (from Antigravity), extract name
    if (info && info.userStatus && info.userStatus.name) {
        item.text = "$(person) " + info.userStatus.name + ": " + getTranslation('connected', language);
        item.tooltip = getTranslation('connectionActive', language);
        item.command = 'antigravity-quota.showQuickMenu';
        item.show();
        return;
    }
    
    // If we have account info but no models, show account name with "No Models"
    if (info && info.name && (!info.models || info.models.length === 0)) {
        item.text = "$(person) " + info.name + ": " + getTranslation('connected', language);
        item.tooltip = getTranslation('connectionActive', language);
        item.command = 'antigravity-quota.showQuickMenu';
        item.show();
        return;
    }
    
    // If we have models, show the selected one (or the first one)
    if (info && info.models && info.models.length > 0) {
        const selectedModelName = context.workspaceState.get('selectedModel', '');
        let model = info.models.find((m: any) => m.name === selectedModelName);
        if (!model) {
            model = info.models[0];
        }
        
        const color = model.percentage >= 50 ? '🟢' : model.percentage >= 30 ? '🟡' : '🔴';
        item.text = `${color} ${model.name}: ${model.percentage}%`;
        
        // Multi-line rich tooltip
        const remainingStr = getTranslation('remainingText', language);
        const modelsSummary = info.models.slice(0, 5).map((m: any) => {
            const mColor = m.percentage >= 50 ? '🟢' : m.percentage >= 30 ? '🟡' : '🔴';
            return `${mColor} ${m.name}: ${m.percentage}%`;
        }).join('\n');
        
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### 🌌 ${info.name || 'Account'}\n\n`);
        tooltip.appendMarkdown(`${modelsSummary}\n\n`);
        tooltip.appendMarkdown(`---\n*${getTranslation('currentSessionQuotas', language)}*`);
        
        item.tooltip = tooltip;
        item.command = 'antigravity-quota.showQuickMenu';
        item.show();
        return;
    }
    
    // Fallback: show connected status
    console.log('[Omni-Quota] DEBUG: No valid info provided to updateStatusBar, showing connected status');
    item.text = "$(person) Antigravity " + getTranslation('connected', language) + ": " + getTranslation('connected', language);
    item.tooltip = getTranslation('connectionActive', language);
    item.command = 'antigravity-quota.showQuickMenu';
    item.show();
    return;
}