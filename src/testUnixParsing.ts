
import * as os from 'os';

/**
 * SIMULACIÓN DE MAC PARA TESTEO EN WINDOWS
 * 
 * Este script simula la salida de una terminal de macOS real para verificar
 * que nuestra lógica de regex y parsing de puertos funcione universalmente.
 */

// 1. Ejemplo real de salida de 'ps -ef' en un Mac con Antigravity
const mockPsOutput = `
  501 12345 11111   0  9:22PM ??         0:15.22 /Users/user/Library/Application Support/Antigravity/language_server --port 54321 --csrf_token=super-secret-mac-token-123 --other_flag=value
  501 67890 22222   0  9:25PM ??         0:02.10 some_other_process --flag
`;

// 2. Ejemplo real de salida de 'lsof -nP -iTCP -sTCP:LISTEN -a -p 12345'
const mockLsofOutput = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
lang_serv 12345 user   3u  IPv4 0x1234567890abcdef      0t0  TCP 127.0.0.1:54321 (LISTEN)
`;

export function runUnixSimulacro() {
    console.log("--- INICIANDO SIMULACRO DE UNIX ---");
    
    // Simulemos la lógica de detectUnix
    const lines = mockPsOutput.trim().split(/\r?\n/);
    for (const line of lines) {
        console.log("Procesando línea de proceso...");
        
        // Buscamos el token como hacemos en el Service
        const tokenMatch = line.match(/--csrf_token[\s=]+([^\s]+)/);
        if (tokenMatch) {
            const token = tokenMatch[1].replace(/['"]+/g, '').trim();
            console.log("✅ Token detectado correctamente:", token);
            
            // Simulemos el parsing de puertos de lsof
            console.log("Simulando búsqueda de puertos con lsof...");
            const portMatch = mockLsofOutput.match(/:(\d+)\s+\(LISTEN\)/);
            if (portMatch) {
                const port = portMatch[1];
                console.log("✅ Puerto detectado correctamente:", port);
                
                if (token === "super-secret-mac-token-123" && port === "54321") {
                    console.log("🎉 ¡ÉXITO! La lógica de Mac es compatible con tus funciones de parsing.");
                }
            }
        }
    }
}

runUnixSimulacro();
