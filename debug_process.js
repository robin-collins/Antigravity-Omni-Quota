
const { exec } = require('child_process');

const EXECUTABLE = 'language_server_windows_x64.exe';

const command = `powershell -NoProfile -Command "
    $proc = Get-CimInstance Win32_Process -Filter \\"Name = '${EXECUTABLE}'\\" | Sort-Object CreationDate -Descending | Select-Object -First 1;
    if ($proc) {
        Write-Host 'Found Process PID:' $proc.ProcessId;
        $cmd = $proc.CommandLine;
        $pid = $proc.ProcessId;
        Write-Host 'Command Line:' $cmd;
        
        try {
            $ports = Get-NetTCPConnection -OwningProcess $pid -State Listen -ErrorAction Stop | Select-Object -ExpandProperty LocalPort;
            Write-Host 'Ports found:' $ports;
        } catch {
            Write-Host 'Error getting ports:' $_;
        }
    } else {
        Write-Host 'Process not found';
    }
"`;

console.log('--- Running Discovery Script ---');
exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('Exec Error:', error.message);
    }
    console.log('STDOUT:', stdout);
    if (stderr) {
        console.log('STDERR:', stderr);
    }
    console.log('--- End ---');
});
