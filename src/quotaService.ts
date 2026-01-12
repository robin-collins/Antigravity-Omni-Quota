
import { exec } from 'child_process';
import axios from 'axios';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export interface ServerInfo {
    pid: string;
    port: string;       
    csrfToken: string;
    initialData?: any;  
}

export class QuotaService {
    private cachedAuthToken: string | null = null;
    private tokenCacheTime = 0;

    private execShell(cmd: string): Promise<string> {
        return new Promise((resolve) => {
            exec(cmd, { maxBuffer: 1024 * 1024, timeout: 5000 }, (error, stdout) => {
                if (error) {
                    resolve(''); 
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    public async detectAllActiveConnections(): Promise<ServerInfo[]> {
        const platform = os.platform();
        console.log(`[Omni-Quota] Starting Zero-Config Scan on ${platform}...`);
        
        if (platform === 'win32') {
            return this.detectWindows();
        } else if (platform === 'darwin' || platform === 'linux') {
            return this.detectUnix();
        } else {
            console.error(`[Omni-Quota] Unsupported platform: ${platform}`);
            return [];
        }
    }

    private async detectWindows(): Promise<ServerInfo[]> {
        const successfulConnections: ServerInfo[] = [];
        const authToken = this.getAuthTokenFromDisk();

        const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name like '%language_server_windows%'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
        const psOut = await this.execShell(psCommand);
        
        if (!psOut || !psOut.trim()) return [];

        let processes: any[] = [];
        try {
            const parsed = JSON.parse(psOut.trim());
            processes = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) { return []; }

        for (const proc of processes) {
            const cmdLine = proc.CommandLine || '';
            const pid = proc.ProcessId;
            if (!cmdLine || !pid) continue;

            const tokenMatch = cmdLine.match(/--csrf_token[\s=]+([^\s]+)/);
            if (!tokenMatch) continue;
            const token = tokenMatch[1].replace(/['"]+/g, '').trim();

            const netstatCmd = `netstat -ano | findstr ${pid}`;
            const nsOut = await this.execShell(netstatCmd);
            const candidatePorts: string[] = [];
            nsOut.trim().split(/\r?\n/).forEach(line => {
                if (line.includes('LISTENING')) {
                    const parts = line.trim().split(/\s+/);
                    const portStr = parts[1]?.split(':').pop();
                    if (portStr && !isNaN(Number(portStr))) candidatePorts.push(portStr);
                }
            });

            for (const port of [...new Set(candidatePorts)]) {
                const result = await this.probePort(port, token, authToken);
                if (result) {
                    successfulConnections.push({ pid: pid.toString(), port, csrfToken: token, initialData: result });
                    break;
                }
            }
        }
        return successfulConnections;
    }

    private async detectUnix(): Promise<ServerInfo[]> {
        const successfulConnections: ServerInfo[] = [];
        const authToken = this.getAuthTokenFromDisk();

        // Check if 'lsof' is available - CRITICAL for Unix detection
        const hasLsof = await this.execShell('which lsof');
        if (!hasLsof.trim()) {
            console.error('[Omni-Quota] CRITICAL: "lsof" command not found. This is required for macOS/Linux port detection.');
            // We return a special marker to notify the extension to show a message
            vscode.window.showErrorMessage(
                'Antigravity Omni-Quota: "lsof" is required on macOS/Linux. Please install it (e.g., sudo apt install lsof).',
                'How to fix?'
            ).then(selection => {
                if (selection === 'How to fix?') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/RicardoGurrola15/Antigravity-Omni-Quota#macoslinux-setup'));
                }
            });
            return [];
        }

        // Detect language_server processes on Unix
        const psCommand = `ps -ef | grep language_server | grep -v grep`;
        const psOut = await this.execShell(psCommand);
        if (!psOut.trim()) return [];

        const lines = psOut.trim().split(/\r?\n/);
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[1];
            
            // Validate PID is numeric
            if (!pid || isNaN(Number(pid))) continue;

            const tokenMatch = line.match(/--csrf_token[\s=]+([^\s]+)/);
            if (!tokenMatch) continue;
            const token = tokenMatch[1].replace(/['"]+/g, '').trim();

            // Find ports using lsof
            const lsofCmd = `lsof -nP -iTCP -sTCP:LISTEN -a -p ${pid}`;
            const lsofOut = await this.execShell(lsofCmd);
            const candidatePorts: string[] = [];
            
            lsofOut.trim().split(/\r?\n/).forEach(l => {
                const portMatch = l.match(/:(\d+)\s+\(LISTEN\)/);
                if (portMatch) candidatePorts.push(portMatch[1]);
            });

            for (const port of [...new Set(candidatePorts)]) {
                const result = await this.probePort(port, token, authToken);
                if (result) {
                    successfulConnections.push({ pid, port, csrfToken: token, initialData: result });
                    break;
                }
            }
        }
        return successfulConnections;
    }

    private async probePort(port: string, csrfToken: string, authToken: string | null): Promise<any> {
        const url = `https://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUnleashData`;
        const payload = {
            metadata: {
                api_key: authToken || '00000000-0000-0000-0000-000000000000',
                extension_name: 'vscode',
                extension_version: '1.1.0',
                ide_name: 'visual_studio_code',
                ide_version: '1.75.0',
                session_id: '00000000-0000-0000-0000-000000000000'
            }
        };

        const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
        const headers: any = {
            'Content-Type': 'application/json',
            'x-codeium-csrf-token': csrfToken,
            'Connection': 'close'
        };

        headers['Authorization'] = authToken ? `Bearer ${authToken}` : `Basic ${csrfToken}`;

        const config = { headers, httpsAgent: agent, timeout: 1500 };

        try {
            const res = await axios.post(url, payload, config);
            if (res.status === 200 && res.data) return res.data;
        } catch (e: any) {
            if (e.code === 'EPROTO' || e.response?.status === 403) {
                 try {
                    const httpUrl = `http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUnleashData`;
                    const resHTTP = await axios.post(httpUrl, payload, { ...config, httpsAgent: undefined });
                    return resHTTP.data;
                 } catch (e2) {}
            }
        }
        return null;
    }

    public async fetchStatus(server: ServerInfo): Promise<any> {
        const url = `https://127.0.0.1:${server.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
        const payload = {
            metadata: { ideName: 'vscode', extensionName: 'vscode', ideVersion: '1.75.0', locale: 'en' }
        };
        
        const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'x-codeium-csrf-token': server.csrfToken,
                'Authorization': `Basic ${server.csrfToken}`,
                'Connection': 'close'
            },
            httpsAgent: agent,
            timeout: 3000
        };

        try {
            const res = await axios.post(url, payload, config);
            return res.data;
        } catch (e: any) {
            if (e.code === 'EPROTO' || e.response?.status === 403) {
                const httpUrl = url.replace('https://', 'http://');
                const res2 = await axios.post(httpUrl, payload, { ...config, httpsAgent: undefined });
                return res2.data;
            }
            throw e;
        }
    }

    public getAuthTokenFromDisk(): string | null {
        const now = Date.now();
        if (this.cachedAuthToken && (now - this.tokenCacheTime) < 60000) return this.cachedAuthToken;
        
        try {
            const home = os.homedir();
            const filePath = path.join(home, '.gemini', 'oauth_creds.json');
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const json = JSON.parse(content);
                this.cachedAuthToken = json.access_token || null;
                this.tokenCacheTime = now;
                return this.cachedAuthToken;
            }
        } catch (e) { }
        return null;
    }

    /**
     * Invalidates the cached auth token, forcing a fresh read on next request.
     * Call this when user might have switched accounts.
     */
    public invalidateAuthCache(): void {
        console.log('[Omni-Quota] Auth token cache invalidated');
        this.cachedAuthToken = null;
        this.tokenCacheTime = 0;
    }

    public getInstallationIdFromDisk(): string | null {
        try {
           const home = os.homedir();
           const filePath = path.join(home, '.gemini', 'antigravity', 'installation_id');
           if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8').trim();
       } catch (e) { }
       return null;
   }
}
