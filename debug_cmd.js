
const { execSync } = require('child_process');

try {
    console.log('--- FINDING PID via WMIC ---');
    // Use wmic to get process id and commandline safely
    const wmicOutput = execSync('wmic process where "name like \'%language_server_windows%\'" get processid,commandline /format:csv').toString();
    console.log(wmicOutput);

    const lines = wmicOutput.trim().split('\r\n');
    if (lines.length < 2) {
        console.log('No process found.');
        return;
    }

    // Parse the CSV output. Windows CSV format is messy, but usually end is PID
    // Node,CommandLine,ProcessId
    // We grab the last CSV line
    const lastLine = lines[lines.length - 1]; // Assuming one process or taking last
    const parts = lastLine.split(',');
    // PID is the last element
    const pid = parts[parts.length - 1].trim(); 
    console.log('TARGET PID:', pid);

    if (pid) {
        console.log('--- SCANNING PORTS via NETSTAT ---');
        const netstat = execSync(`netstat -ano | findstr ${pid}`).toString();
        console.log(netstat);
    }

} catch (e) {
    console.error('ERROR:', e.message);
}
