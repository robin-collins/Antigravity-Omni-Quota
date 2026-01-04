
import * as vscode from 'vscode';
import { AccountManager, AccountData } from './accountManager';
import { getTranslation } from './translations';

export class QuotaProvider implements vscode.TreeDataProvider<QuotaItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<QuotaItem | undefined | null | void> = new vscode.EventEmitter<QuotaItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<QuotaItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private accountManager: AccountManager) {}

    refresh(data: any, connected: boolean): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: QuotaItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: QuotaItem): Thenable<QuotaItem[]> {
        // Root: List Accounts
        if (!element) {
            const accounts = this.accountManager.getAccounts();
            if (accounts.length === 0) {
                const config = vscode.workspace.getConfiguration('antigravity-quota');
                const language = config.get('language', 'auto') as string;
                return Promise.resolve([new QuotaItem(getTranslation('noAccountsDetected', language), vscode.TreeItemCollapsibleState.None)]);
            }
            const currentAccount = accounts.reduce((prev, curr) => prev.lastActive > curr.lastActive ? prev : curr);
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const sortedAccounts = accounts.sort((a, b) => b.lastActive - a.lastActive);
            const accountItems = sortedAccounts.map((acc, index) => {
                const isCurrent = index === 0; // Most recent is current
                const currentText = getTranslation('current', language);
                const label = acc.displayName + (isCurrent ? ` (${currentText})` : '');
                const state = vscode.TreeItemCollapsibleState.Collapsed;
                const icon = isCurrent ? 'pass-filled' : 'account';
                // Show email if available (more useful than model count which is visible when expanded)
                const desc = acc.email ? acc.email : '';
                return new QuotaItem(label, state, icon, acc, desc);
            });

            // Add settings item at the end
            const lang = vscode.workspace.getConfiguration('antigravity-quota').get('language', 'auto') as string;
            const settingsText = getTranslation('settings', lang);
            const configureText = getTranslation('extensionSettings', lang);
            const openSettingsText = getTranslation('openSettings', lang);
            const settingsItem = new QuotaItem(settingsText, vscode.TreeItemCollapsibleState.None, 'settings-gear', undefined, configureText);
            settingsItem.command = { command: 'antigravity-quota.settings', title: openSettingsText };
            accountItems.push(settingsItem);

            return Promise.resolve(accountItems);
        }

        // Child: Details of an Account
        if (element.account) {
            const lang = vscode.workspace.getConfiguration('antigravity-quota').get('language', 'auto') as string;
            const items: QuotaItem[] = [];
            const acc = element.account;

            // Safety Check
            const q = acc.quota || { total: 100, remaining: 100, used: 0 };
            const total = q.total > 0 ? q.total : 1; // Avoid division by zero

            // Models Nodes
            if (acc.models && acc.models.length > 0) {
                const config = vscode.workspace.getConfiguration('antigravity-quota');
                const showOnlyLowQuota = config.get('showOnlyLowQuota', false) as boolean;
                const warningThreshold = config.get('warningThreshold', 50) as number;
                let modelsToShow = acc.models;
                if (showOnlyLowQuota) {
                    modelsToShow = modelsToShow.filter(m => m.percentage < warningThreshold);
                }
                // items.push(new QuotaItem("--- Modelos ---", vscode.TreeItemCollapsibleState.None));
                modelsToShow.forEach(m => {
                    const mName = m.name || getTranslation('model', lang);
                    const mPct = m.percentage ?? 0;
                    const config = vscode.workspace.getConfiguration('antigravity-quota');
                    const warningThreshold = config.get('warningThreshold', 50) as number;
                    const criticalThreshold = config.get('criticalThreshold', 30) as number;
                    
                    // Unified dots: empty is thinner or different character? No, let's stick to circles but with color icons
                    const dots = '●'.repeat(Math.round((mPct / 100) * 5)) + '○'.repeat(5 - Math.round((mPct / 100) * 5));
                    
                    // Native VS Code icons for status
                    let icon = 'circle-outline';
                    if (mPct >= warningThreshold) icon = 'pass-filled';
                    else if (mPct >= criticalThreshold) icon = 'info';
                    else if (mPct > 0) icon = 'warning';
                    else icon = 'error';

                    const resetInfo = m.resetTime ? ` [${m.resetTime}]` : '';
                    items.push(new QuotaItem(
                        `${mName}`,
                        vscode.TreeItemCollapsibleState.None,
                        icon,
                        undefined,
                        `${mPct}% ${dots}${resetInfo}`
                    ));
                });
            } else {
                const noModelText = getTranslation('noModelInfo', lang);
                items.push(new QuotaItem(noModelText, vscode.TreeItemCollapsibleState.None));
            }

            return Promise.resolve(items);
        }

        return Promise.resolve([]);
    }

    private getProgressBar(pct: number): string {
        const total = 10;
        const filled = Math.round((pct / 100) * total);
        const empty = total - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    private getIconForPercentage(pct: number): string {
        if (pct === 0) return 'error'; 
        if (pct < 20) return 'warning';
        return 'check';
    }
}

class QuotaItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName?: string,
        public readonly account?: AccountData,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = description || label;
        this.description = description; // Shows on the right in grey
        
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        } else if (account) {
            this.iconPath = new vscode.ThemeIcon('account');
        }
    }
}