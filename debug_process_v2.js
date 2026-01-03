
const { exec } = require('child_process');

const command = `powershell -NoProfile -Command "
    $proc = Get-Process | Where-Object { $_.ProcessName -like '*language_server*' } | Sort-Object StartTime -Descending | Select-Object -First 1;
    
    if ($proc) {
        $pid = $proc.Id;
        $ports = try { Get-NetTCPConnection -OwningProcess $pid -State Listen -ErrorAction Stop | Select-Object -ExpandProperty LocalPort } catch { @() };
        
        # Manually construct JSON to avoid weird serialization depth issues
        $json = @{
            Name = $proc.ProcessName;
            Id = $pid;
            Ports = $ports;
            # Get command line via WMI as fallback since Get-Process doesn't always have it easily
            CommandLine = (Get-CimInstance Win32_Process -Filter \\"ProcessId = $pid\\").CommandLine
        } | ConvertTo-Json -Compress;
        
        Write-Output $json
    } else {
        Write-Output '{}'
    }
"`;

console.log('--- Scanning ---');
exec(command, (error, stdout, stderr) => {
    if (error) console.error('Error:', error);
    console.log('STDOUT:', stdout);
    if (stderr) console.error('STDERR:', stderr);
});
