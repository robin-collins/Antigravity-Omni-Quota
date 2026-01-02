
import * as vscode from 'vscode';
import { AccountManager } from './accountManager';
import { QuotaProvider } from './quotaProvider';
import { QuotaService } from './quotaService';
import { getTranslation } from './translations';

let pollingInterval: NodeJS.Timer | undefined;
let lastCheckTime = 0;

export async function activate(context: vscode.ExtensionContext) {
     const accountManager = new AccountManager(context.globalState);
     let lastCalculatedData = context.workspaceState.get('lastData', null);

     // Keep accounts for multiple sessions

     const quotaService = new QuotaService();
     const quotaProvider = new QuotaProvider(accountManager);

     const treeView = vscode.window.createTreeView('quotaExplorer', { treeDataProvider: quotaProvider });
     context.subscriptions.push(treeView);
     const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
     statusBarItem.command = 'antigravity-quota.showQuickMenu';

     // Read initial config
     const config = vscode.workspace.getConfiguration('antigravity-quota');
     const enableMonitoring = config.get('enableMonitoring', true);
     const pollingIntervalMs = (config.get('pollingInterval', 30) as number) * 1000;
     const language = config.get('language', 'auto') as string;

     console.log('[Omni-Quota] ' + getTranslation('activating', language));

     statusBarItem.text = "$(sync~spin) Omni-Quota: " + getTranslation('activating', language);
     statusBarItem.show();
     context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
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
                      return {
                          label: `${color} ${m.name}`,
                          const config = vscode.workspace.getConfiguration('antigravity-quota');
                          const language = config.get('language', 'auto') as string;
                          const resetLabel = getTranslation('resetLabel', language);
                          description: `${m.percentage}% | ${resetLabel} ${m.resetTime}`,
                          detail: dots,
                          model: m
                      };
                  });
                  const selected = await vscode.window.showQuickPick(items, {
                      placeHolder: getTranslation('currentSessionQuotas', language),
                      ignoreFocusOut: false
                 });
                  if (selected && selected.model) {
                      await context.workspaceState.update('selectedModel', selected.model.name);
                      // Update status bar immediately
                      updateStatusBar(statusBarItem, lastCalculatedData, context);
                  }
              } else {
                  vscode.window.showInformationMessage(getTranslation('scanningWait', language));
              }
        }),
        vscode.commands.registerCommand('antigravity-quota.refresh', () => {
            runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }),
        vscode.commands.registerCommand('antigravity-quota.redetect', () => {
            // Force re-detection by clearing cache or something
            runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }),
        vscode.commands.registerCommand('antigravity-quota.focus', () => {
            vscode.commands.executeCommand('workbench.view.extension.quotaExplorer');
        }),
        vscode.commands.registerCommand('antigravity-quota.clearAccounts', async () => {
            console.log('[Omni-Quota] Clear accounts command executed');
            await accountManager.reset();
            quotaProvider.refresh(null, false);
            vscode.window.showInformationMessage(getTranslation('allAccountsCleared', language));
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
                    vscode.window.showInformationMessage(getTranslation('languageChanged', language).replace('{lang}', langSelected.label));
                }
            }
        })
    );

    // Initial check
    if (enableMonitoring) {
        runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
    }

    if (enableMonitoring) {
        pollingInterval = setInterval(() => {
            runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context);
        }, pollingIntervalMs);
    }
}

export function deactivate() {
    if (pollingInterval) clearInterval(pollingInterval);
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

                        userId = `${conn.initialData?.context?.properties?.installationId || 'unknown'}_${status.userStatus.email || realName}`;

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

                                let resetStr = "Unknown";
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
                                                    resetStr = `en ${d}d ${h}h ${m}m`;
                                                } else {
                                                    resetStr = `en ${h}h ${m}m`;
                                                }
                                            } else {
                                                resetStr = "Listo";
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

                                return {
                                    name: cfg.label || cfg.modelOrAlias?.model || 'Model',
                                    percentage: pct,
                                    resetTime: resetStr,
                                    resetMinutes: resetMinutes
                                };
                            }).sort((a: any, b: any) => b.percentage - a.percentage || a.resetMinutes - b.resetMinutes);
                        }
                }

                const success = await accountManager.updateAccount(userId, {
                    id: userId,
                    displayName: realName,
                    lastActive: Date.now(),
                    quota: quota,
                    models: models,
                    tier: 'Pro',
                    rawContext: {}
                });
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
            }
        }

        updateStatusBar(statusBar, primaryInfo, context);
        treeView.message = undefined;
        provider.refresh(null, true);

    } catch (error) {
        console.error('[Omni-Quota] GLOBAL CRASH:', error);
        updateStatusBar(statusBar, null, context);
    }
}

function updateStatusBar(item: vscode.StatusBarItem, info: any, context: vscode.ExtensionContext) {
    item.hide();
    if (!info) {
        item.text = "$(circle-slash) Omni-Quota";
        item.tooltip = "Offline";
        item.show(); // Always show
        return;
    }

    context.workspaceState.update('lastData', info);

    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const warningThreshold = config.get('warningThreshold', 50) as number;
    const criticalThreshold = config.get('criticalThreshold', 30) as number;
    const statusBarStyle = config.get('statusBarStyle', 'dots') as string;
    const showGeminiPro = config.get('showGeminiPro', true) as boolean;
    const showGeminiFlash = config.get('showGeminiFlash', true) as boolean;
    const language = config.get('language', 'auto') as string;

    // Filter models based on config
    let filteredModels = info.models || [];
    if (!showGeminiPro) {
        filteredModels = filteredModels.filter((m: any) => !m.name.includes('Gemini') || !m.name.includes('Pro'));
    }
    if (!showGeminiFlash) {
        filteredModels = filteredModels.filter((m: any) => !m.name.includes('Gemini') || !m.name.includes('Flash'));
    }

    const parts = [];

    if (filteredModels.length > 0) {
        let selectedModel = null;
        const selectedName = context.workspaceState.get('selectedModel');
        if (selectedName) {
            selectedModel = filteredModels.find((m: any) => m.name === selectedName);
        }
        const modelToShow = selectedModel || filteredModels[0];
        if (modelToShow) {
            let name = modelToShow.name
                .replace('Gemini 3 ', 'G3-')
                .replace('Claude Sonnet', 'Sonnet')
                .replace('Claude Opus', 'Opus')
                .replace(' (Thinking)', '')
                .replace(' (High)', '')
                .replace(' (Low)', '');
            const color = modelToShow.percentage >= warningThreshold ? '🟢' : modelToShow.percentage >= criticalThreshold ? '🟡' : modelToShow.percentage > 0 ? '🔴' : '⚫';
            if (statusBarStyle === 'percentage') {
                parts.push(`${color} ${name}: ${modelToShow.percentage}%`);
            } else {
                const dots = '●'.repeat(Math.round((modelToShow.percentage / 100) * 5)) + '○'.repeat(5 - Math.round((modelToShow.percentage / 100) * 5));
                parts.push(`${color} ${name} ${dots}`);
            }
        }
    } else {
        parts.push(getTranslation('onlineNoModels', language));
    }

    item.text = `${parts.join('  |  ')}`;
    item.tooltip = getTranslation('quotaDetails', language);
    item.command = 'antigravity-quota.showQuickMenu';
    item.show();
}