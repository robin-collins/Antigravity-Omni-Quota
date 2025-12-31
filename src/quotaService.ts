
import { exec } from 'child_process';
import axios from 'axios';
import * as https from 'https';

export interface ServerInfo {
    pid: string;
    port: string;       // El puerto ganador
    csrfToken: string;
    initialData?: any;  // Los datos que obtuvimos al probar el puerto
}

export class QuotaService {
    private cachedAuthToken: string | null = null;
    private tokenCacheTime = 0;

    private execShell(cmd: string): Promise<string> {
        return new Promise((resolve) => {
            exec(cmd, { maxBuffer: 1024 * 1024, timeout: 5000 }, (error, stdout) => {
                if (error) {
                    // console.warn(`[Omni-Quota] Exec Warn: ${error.message}`);
                    resolve(''); 
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * "Zero-Config" Strategy:
     * 1. Find ALL language_server processes.
     * 2. For each process, find ALL listening ports.
     * 3. PROBE each port until one responds to GetUnleashData.
     */
    public async detectAllActiveConnections(): Promise<ServerInfo[]> {
        console.log('[Omni-Quota] Starting Zero-Config Scan...');
        const successfulConnections: ServerInfo[] = [];

        // Pre-load Auth Token for Identity
        const authToken = this.getAuthTokenFromDisk();

        // 1. PowerShell Discovery (All Processes)
        const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name like '%language_server_windows%'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
        const psOut = await this.execShell(psCommand);
        
        if (!psOut || !psOut.trim()) return [];

        let processes: any[] = [];
        try {
            const parsed = JSON.parse(psOut.trim());
            if (Array.isArray(parsed)) processes = parsed;
            else if (parsed && typeof parsed === 'object') processes = [parsed];
        } catch (e) { return []; }

        // 2. Process Iteration
        for (const proc of processes) {
            const cmdLine = proc.CommandLine || '';
            const pid = proc.ProcessId;
            
            if (!cmdLine || !pid) continue;

            const tokenMatch = cmdLine.match(/--csrf_token[\s=]+([^\s]+)/);
            if (!tokenMatch) continue;

            const token = tokenMatch[1].replace(/['"]+/g, '').trim();

            // 3. Find Ports for this PID
            const netstatCmd = `netstat -ano | findstr ${pid}`;
            const nsOut = await this.execShell(netstatCmd);
            
            const candidatePorts: string[] = [];
            const lines = nsOut.trim().split(/\r?\n/);
            lines.forEach(line => {
                if (line.includes('LISTENING')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const portStr = parts[1].split(':').pop();
                        if (portStr && !isNaN(Number(portStr))) {
                            candidatePorts.push(portStr);
                        }
                    }
                }
            });

            // unique ports
            const uniquePorts = [...new Set(candidatePorts)];
            
            // 4. PROBE PORTS (Find the API port)
            for (const port of uniquePorts) {
                // console.log(`[Omni-Quota] Probing PID ${pid} on port ${port}...`);
                const result = await this.probePort(port, token, authToken);
                if (result) {
                    console.log(`[Omni-Quota] SUCCESS: PID ${pid} responding on port ${port}`);
                    successfulConnections.push({
                        pid: pid.toString(),
                        port: port,
                        csrfToken: token,
                        initialData: result
                    });
                    break; // Found the API port for this process, move to next process
                }
            }
        }

        return successfulConnections;
    }

    /**
     * Sends a quick GetUnleashData request to check if this is the API port.
     */
    private async probePort(port: string, csrfToken: string, authToken: string | null): Promise<any> {
        const url = `https://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUnleashData`;
        const payload = {
            metadata: {
                api_key: authToken || '00000000-0000-0000-0000-000000000000',
                extension_name: 'vscode',
                extension_version: '1.2.3',
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

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        } else {
            headers['Authorization'] = `Basic ${csrfToken}`;
        }

        // Minimal config for speed
        const config = {
            headers: headers,
            httpsAgent: agent,
            timeout: 1500 // Quick timeout for probing
        };

        try {
            const res = await axios.post(url, payload, config);
            if (res.status === 200 && res.data) {
                return res.data;
            }
        } catch (e: any) {
            // Check for HTTP fallback requirement
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

    // 2. COMPLEX: Quota Check (GetUserStatus)
    public async fetchStatus(server: ServerInfo): Promise<any> {
        const csrfToken = server.csrfToken;
        const sessionId = 'vscode-omni-quota-session';

        // Ensure client is initialized by calling GetUnleashData
        const unleashUrl = `https://127.0.0.1:${server.port}/exa.language_server_pb.LanguageServerService/GetUnleashData`;
        const unleashPayload = {
            metadata: {
                api_key: '00000000-0000-0000-0000-000000000000',
                extension_name: 'vscode',
                extension_version: '1.2.3',
                ide_name: 'visual_studio_code',
                ide_version: '1.75.0',
                session_id: sessionId
            }
        };
        await this.doPost(unleashUrl, unleashPayload, server);

        const url = `https://127.0.0.1:${server.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
        const payload = {
            metadata: {
                ideName: 'vscode',
                extensionName: 'vscode',
                ideVersion: '1.75.0',
                locale: 'en'
            }
        };
        
        // Use csrfToken for auth
        const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
        const headers: any = {
            'Content-Type': 'application/json',
            'x-codeium-csrf-token': csrfToken,
            'Authorization': `Basic ${csrfToken}`,
            'Connection': 'close'
        };

        const config = {
            headers: headers,
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

    // Reuse existing fetch logic for heavy calls if needed
    public async fetchModelStatuses(server: ServerInfo): Promise<any> {
        const url = `https://127.0.0.1:${server.port}/exa.language_server_pb.LanguageServerService/GetModelStatuses`;
        const payload = { metadata: { api_key: '00000000-0000-0000-0000-000000000000', extension_name: 'vscode', ide_name: 'visual_studio_code' } };
        
        return this.doPost(url, payload, server);
    }
    
    // Helper used by fetchModelStatuses
    private async doPost(url: string, payload: any, server: ServerInfo): Promise<any> {
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
        if (this.cachedAuthToken && (now - this.tokenCacheTime) < 60000) { // Cache for 1 minute
            return this.cachedAuthToken;
        }
        try {
            const fs = require('fs');
            const home = process.env.USERPROFILE || process.env.HOME || '';
            const path = `${home}\\.gemini\\oauth_creds.json`;
            if (fs.existsSync(path)) {
                const content = fs.readFileSync(path, 'utf8');
                const json = JSON.parse(content);
                this.cachedAuthToken = json.access_token || null;
                this.tokenCacheTime = now;
                return this.cachedAuthToken;
            }
        } catch (e) { }
        return null;
    }

    public getInstallationIdFromDisk(): string | null {
        try {
           const fs = require('fs');
           const home = process.env.USERPROFILE || process.env.HOME || '';
           const path = `${home}\\.gemini\\antigravity\\installation_id`;
           if (fs.existsSync(path)) return fs.readFileSync(path, 'utf8').trim();
       } catch (e) { }
       return null;
   }
}