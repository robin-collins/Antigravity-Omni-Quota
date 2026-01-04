
import * as vscode from 'vscode';

export interface AccountData {
    id: string;
    displayName: string;
    email?: string;          // User's email address for display
    lastActive: number;
    quota: {
        total: number;
        used: number;
        remaining: number;
    };
    models?: {
        name: string;
        percentage: number;
        remaining?: string;
        resetTime?: string;
        resetTimestamp?: number;
    }[];
    tier: string;
    rawContext?: any;
    data?: any;
}

export class AccountManager {
    private static readonly STORAGE_KEY = 'antigravity_accounts';

    private cache: Map<string, AccountData> = new Map();

    constructor(private globalState: vscode.Memento) {
        this.loadAccounts();
    }

    private loadAccounts() {
        const accounts = this.globalState.get<AccountData[]>(AccountManager.STORAGE_KEY, []);
        accounts.forEach(acc => this.cache.set(acc.id, acc));
    }

    public getAccounts(): AccountData[] {
        return Array.from(this.cache.values()).sort((a, b) => b.lastActive - a.lastActive);
    }

    public async updateAccount(id: string, data: AccountData): Promise<boolean> {
        const isNew = !this.cache.has(id);
        const config = vscode.workspace.getConfiguration('antigravity-quota');
        const maxAccounts = config.get<number>('maxAccounts', 10);
        
        if (isNew && this.cache.size >= maxAccounts) {
            return false; // Exceeded limit
        }

        // Enhanced validation for account data
        if (!this.isValidAccountData(data)) {
            console.log(`[Omni-Quota] Rejected invalid account data: id=${id}, name="${data.displayName}"`);
            return false;
        }

        // Check for duplicate displayName
        const existing = Array.from(this.cache.values());
        const duplicates = existing.filter(acc => acc.displayName === data.displayName && acc.id !== id);
        if (duplicates.length > 0) {
            data.displayName = `${data.displayName} (${duplicates.length + 1})`;
        }
        
        this.cache.set(id, data);

        await this.persist();
        return true;
    }

    /**
     * Validates account data to prevent creation of invalid/placeholder accounts.
     * Returns a rejection reason string if invalid, or null if valid.
     */
    private getValidationError(data: AccountData): string | null {
        const displayNameLower = data.displayName.toLowerCase().trim();

        // Only reject exact placeholder names (not substrings!)
        const invalidNames = ['undefined', 'account', 'usuario', 'user', 'guest', ''];
        if (invalidNames.includes(displayNameLower)) {
            return `exact match in placeholder names: "${displayNameLower}"`;
        }

        // Check for very short names (likely invalid)
        if (data.displayName.trim().length < 2) {
            return `name too short: "${data.displayName}" (min 2 chars)`;
        }

        // Check for valid models data
        if (!data.models || data.models.length === 0) {
            return 'no models data';
        }

        // At least one model should have valid data
        const validModels = data.models.filter(m =>
            m.name && m.name.trim().length > 0 &&
            typeof m.percentage === 'number' &&
            m.percentage >= 0 &&
            m.percentage <= 100
        );
        if (validModels.length === 0) {
            return 'no valid models (need name and percentage 0-100)';
        }

        return null; // Valid
    }

    /**
     * Validates account data to prevent creation of invalid accounts
     */
    private isValidAccountData(data: AccountData): boolean {
        const error = this.getValidationError(data);
        if (error) {
            console.log(`[Omni-Quota] Validation failed for "${data.displayName}": ${error}`);
            return false;
        }
        return true;
    }

    /**
     * Cleans up invalid accounts from storage
     */
    public async cleanupInvalidAccounts(): Promise<void> {
        console.log('[Omni-Quota] Starting account cleanup...');
        const accounts = Array.from(this.cache.values());
        const validAccounts: AccountData[] = [];
        let removedCount = 0;

        for (const account of accounts) {
            console.log(`[Omni-Quota] Checking account: "${account.displayName}" (${account.id})`);
            if (this.isValidAccountData(account)) {
                validAccounts.push(account);
                console.log(`[Omni-Quota] Account valid: "${account.displayName}"`);
            } else {
                console.log(`[Omni-Quota] Removing invalid account: ${account.displayName} (${account.id})`);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            this.cache.clear();
            validAccounts.forEach(acc => this.cache.set(acc.id, acc));
            await this.persist();
            console.log(`[Omni-Quota] Cleanup completed. Removed ${removedCount} invalid accounts.`);
        } else {
            console.log('[Omni-Quota] No invalid accounts found during cleanup.');
        }
    }

    public async removeAccount(id: string) {
        if (this.cache.has(id)) {
            this.cache.delete(id);
            await this.persist();
        }
    }

    public async reset(): Promise<void> {
        this.cache.clear();
        await this.globalState.update(AccountManager.STORAGE_KEY, undefined);
    }

    private async persist() {
        const accounts = Array.from(this.cache.values());
        await this.globalState.update(AccountManager.STORAGE_KEY, accounts);
    }
}