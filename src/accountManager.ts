
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

    constructor(
        private globalState: vscode.Memento,
        private secrets: vscode.SecretStorage
    ) {
        this.loadAccounts();
    }

    private loadAccounts() {
        const accounts = this.globalState.get<AccountData[]>(AccountManager.STORAGE_KEY, []);
        accounts.forEach(acc => this.cache.set(acc.id, acc));
    }

    /**
     * Securely stores a token for an account
     */
    public async setAccountSecret(accountId: string, key: string, value: string): Promise<void> {
        const secretKey = `token_${accountId}_${key}`;
        await this.secrets.store(secretKey, value);
    }

    /**
     * Retrieves a securely stored token
     */
    public async getAccountSecret(accountId: string, key: string): Promise<string | undefined> {
        const secretKey = `token_${accountId}_${key}`;
        return await this.secrets.get(secretKey);
    }

    /**
     * Removes all secrets for an account
     */
    public async removeAccountSecrets(accountId: string): Promise<void> {
        // Typically we'd only have a few keys, like 'csrf' and 'session'
        await this.secrets.delete(`token_${accountId}_csrf`);
        await this.secrets.delete(`token_${accountId}_session`);
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
        // Check for invalid display names - MORE STRICT
        const invalidNames = ['undefined', 'account', 'Usuario', '', 'undefined_', 'account_', 'user_', 'guest_', 'test_'];
        const displayNameLower = data.displayName.toLowerCase().trim();

        // Only reject exact placeholder names (not substrings!)
        if (invalidNames.includes(displayNameLower)) {
            return `exact match in placeholder names: "${displayNameLower}"`;
        }

        // Contains invalid patterns
        if (displayNameLower.includes('undefined') ||
            displayNameLower.includes('account') ||
            displayNameLower.includes('user') ||
            displayNameLower.includes('guest') ||
            displayNameLower.includes('test') ||
            displayNameLower.includes('temp') ||
            displayNameLower.includes('demo')) {
            return `contains invalid patterns: "${displayNameLower}"`;
        }

        // Check for very short names (likely invalid)
        if (data.displayName.trim().length < 3) {
            return `name too short: "${data.displayName}" (min 3 chars)`;
        }

        // Check for valid email pattern in ID (if available)
        if (data.id && data.id.includes('@')) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(data.id.split('_').pop() || '')) {
                return `invalid email pattern in ID: "${data.id}"`;
            }
        }


        // Check for valid models data - MORE STRICT
        if (data.models && data.models.length > 0) {
            // At least one model should have valid data
            const validModels = data.models.filter(m =>
                m.name && m.name.trim().length > 0 &&
                typeof m.percentage === 'number' &&
                m.percentage >= 0 &&
                m.percentage <= 100
            );
            if (validModels.length === 0) {
                return `no valid models (need name and percentage 0-100)`;
            }
        } else {
            // If no models, it's likely an invalid account
            return `no models data`;
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

    // /**
    //  * Validates account data to prevent creation of invalid accounts
    //  */
    // private isValidAccountData(data: AccountData): boolean {
    //     // Check for invalid display names - MORE STRICT
    //     const invalidNames = ['undefined', 'account', 'Usuario', '', 'undefined_', 'account_', 'user_', 'guest_', 'test_'];
    //     const displayNameLower = data.displayName.toLowerCase().trim();
        
    //     // Exact matches
    //     if (invalidNames.includes(displayNameLower)) {
    //         return false;
    //     }
        
    //     // Contains invalid patterns
    //     if (displayNameLower.includes('undefined') ||
    //         displayNameLower.includes('account') ||
    //         displayNameLower.includes('user') ||
    //         displayNameLower.includes('guest') ||
    //         displayNameLower.includes('test') ||
    //         displayNameLower.includes('temp') ||
    //         displayNameLower.includes('demo')) {
    //         return false;
    //     }

    //     // Check for very short names (likely invalid)
    //     if (data.displayName.trim().length < 3) {
    //         return false;
    //     }

    //     // Check for valid email pattern in ID (if available)
    //     if (data.id && data.id.includes('@')) {
    //         const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    //         if (!emailPattern.test(data.id.split('_').pop() || '')) {
    //             return false;
    //         }
    //     }

    //     // Check for valid models data - MORE STRICT
    //     if (data.models && data.models.length > 0) {
    //         // At least one model should have valid data
    //         const validModels = data.models.filter(m =>
    //             m.name && m.name.trim().length > 0 &&
    //             typeof m.percentage === 'number' &&
    //             m.percentage >= 0 &&
    //             m.percentage <= 100
    //         );
    //         if (validModels.length === 0) {
    //             return false;
    //         }
    //     } else {
    //         // If no models, it's likely an invalid account
    //         return false;
    //     }

    //     return true;
    // }

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
            await this.removeAccountSecrets(id);
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