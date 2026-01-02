
import * as vscode from 'vscode';

export interface AccountData {
    id: string;
    displayName: string;
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
    }[];
    tier: string;
    rawContext?: any;
    data?: any; 
}

export class AccountManager {
    private static readonly STORAGE_KEY = 'antigravity_accounts';
    private static readonly MAX_ACCOUNTS = 10;
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
        if (isNew && this.cache.size >= AccountManager.MAX_ACCOUNTS) {
            return false; // Exceeded limit
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