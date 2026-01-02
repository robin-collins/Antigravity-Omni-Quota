
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
            return Promise.resolve(accounts.map(acc => {
                const isActive = acc.isActive !== false; // Default to active if not set
                const label = acc.displayName + (isActive ? ' (Active)' : ' (Inactive)');
                const state = vscode.TreeItemCollapsibleState.Collapsed;
                const icon = isActive ? 'pass-filled' : 'account';
                const credits = acc.quota.remaining.toLocaleString();
                const modelsCount = acc.models?.length || 0;
                const desc = `${modelsCount} models`;
                return new QuotaItem(label, state, icon, acc, desc);
            }));
        }

        // Child: Details of an Account
        if (element.account) {
            const items: QuotaItem[] = [];
            const acc = element.account;

            // Safety Check
            const q = acc.quota || { total: 100, remaining: 100, used: 0 };
            const total = q.total > 0 ? q.total : 1; // Avoid division by zero

            // Models Nodes
            if (acc.models && acc.models.length > 0) {
                // items.push(new QuotaItem("--- Modelos ---", vscode.TreeItemCollapsibleState.None));
                acc.models.forEach(m => {
                    const mName = m.name || 'Modelo';
                    const mPct = m.percentage ?? 0;
                    const config = vscode.workspace.getConfiguration('antigravity-quota');
                    const warningThreshold = config.get('warningThreshold', 50) as number;
                    const criticalThreshold = config.get('criticalThreshold', 30) as number;
                    const dots = '●'.repeat(Math.round((mPct / 100) * 5)) + '○'.repeat(5 - Math.round((mPct / 100) * 5));
                    const icon = mPct >= warningThreshold ? 'check' : mPct >= criticalThreshold ? 'warning' : mPct > 0 ? 'error' : 'circle-slash';
                    const resetInfo = m.resetTime ? ` | ${m.resetTime}` : '';
                    items.push(new QuotaItem(
                        `${mName}`,
                        vscode.TreeItemCollapsibleState.None,
                        icon,
                        undefined,
                        `${dots} ${mPct}%${resetInfo}`
                    ));
                });
            } else {
                items.push(new QuotaItem("No model information", vscode.TreeItemCollapsibleState.None));
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