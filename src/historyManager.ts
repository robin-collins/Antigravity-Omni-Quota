
import * as vscode from 'vscode';

export interface QuotaSnapshot {
    timestamp: number;
    accountId: string;
    modelName: string;
    percentage: number;
}

export class HistoryManager {
    private static readonly HISTORY_KEY = 'antigravity_usage_history';
    private static readonly MAX_HISTORY_POINTS = 500; // Limit storage to avoid performance issues

    constructor(private globalState: vscode.Memento) {}

    /**
     * Records a new snapshot of model usage
     */
    public async recordSnapshot(accountId: string, modelName: string, percentage: number): Promise<void> {
        let history = this.globalState.get<QuotaSnapshot[]>(HistoryManager.HISTORY_KEY, []);
        
        const lastSnapshot = this.getLastSnapshot(accountId, modelName);
        
        // Only record if percentage changed or more than 1 hour passed
        // This prevents polluting storage with identical data
        if (lastSnapshot && lastSnapshot.percentage === percentage) {
            const oneHour = 60 * 60 * 1000;
            if (Date.now() - lastSnapshot.timestamp < oneHour) {
                return;
            }
        }

        const newSnapshot: QuotaSnapshot = {
            timestamp: Date.now(),
            accountId,
            modelName,
            percentage
        };

        history.push(newSnapshot);

        // Keep only recent history
        if (history.length > HistoryManager.MAX_HISTORY_POINTS) {
            history = history.slice(-HistoryManager.MAX_HISTORY_POINTS);
        }

        await this.globalState.update(HistoryManager.HISTORY_KEY, history);
    }

    public getHistory(): QuotaSnapshot[] {
        return this.globalState.get<QuotaSnapshot[]>(HistoryManager.HISTORY_KEY, []);
    }

    public getHistoryForAccount(accountId: string): QuotaSnapshot[] {
        return this.getHistory().filter(s => s.accountId === accountId);
    }

    public getHistoryForModel(accountId: string, modelName: string): QuotaSnapshot[] {
        return this.getHistory().filter(s => s.accountId === accountId && s.modelName === modelName);
    }

    private getLastSnapshot(accountId: string, modelName: string): QuotaSnapshot | undefined {
        const history = this.getHistory();
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].accountId === accountId && history[i].modelName === modelName) {
                return history[i];
            }
        }
        return undefined;
    }

    public async clearHistory(): Promise<void> {
        await this.globalState.update(HistoryManager.HISTORY_KEY, undefined);
    }
}
