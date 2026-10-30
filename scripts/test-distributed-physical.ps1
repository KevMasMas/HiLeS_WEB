[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('DryRun', 'Inventory', 'Backup', 'Deploy')]
    [string]$Mode = 'DryRun',
    [string[]]$DevicePath = @(),
    [string]$BackupRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'hiles-pico-backups'),
    [string]$ReportPath = '',
    [switch]$AllowNoDevice
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$firmwareRoot = Join-Path $repoRoot 'firmware\pico'
$runId = 'persona5-{0:yyyyMMdd-HHmmss}-{1}' -f (Get-Date), ([guid]::NewGuid().ToString('N').Substring(0, 8))
$started = Get-Date

function Get-SafeHash {
    param([System.IO.FileInfo]$File)
    if ($File.Name -eq 'config_local.py' -or $File.Name -match '(secret|credential|password)') {
        return '<redacted>'
    }
    return (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-FileInventory {
    param([string]$Root)
    $normalizedRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    return @(
        Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction Stop | ForEach-Object {
            [pscustomobject]@{
                path = $_.FullName.Substring($normalizedRoot.Length).Replace('\', '/')
                size_bytes = $_.Length
                sha256 = Get-SafeHash -File $_
            }
        }
    )
}

function Copy-TreeSafely {
    param([string]$Source, [string]$Destination, [switch]$FirmwareOnly)
    $sourcePrefix = [System.IO.Path]::GetFullPath($Source).TrimEnd('\') + '\'
    $files = Get-ChildItem -LiteralPath $Source -Recurse -File | Where-Object {
        -not $FirmwareOnly -or (
            $_.Extension -eq '.py' -and
            $_.Name -ne 'config_local.py' -and
            $_.FullName -notmatch '[\\/]__pycache__[\\/]'
        )
    }
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($sourcePrefix.Length)
        $target = Join-Path $Destination $relative
        [System.IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    }
    return @($files)
}

if (-not (Test-Path -LiteralPath $firmwareRoot -PathType Container)) {
    throw "No existe el firmware esperado: $firmwareRoot"
}

$devices = @()
foreach ($candidate in $DevicePath) {
    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
        throw "El dispositivo o doble de filesystem no existe: $resolved"
    }
    $devices += [pscustomobject]@{
        id = 'filesystem-{0:d2}' -f ($devices.Count + 1)
        type = 'filesystem'
        path = $resolved
    }
}

if ($devices.Count -eq 0) {
    $removable = @(try {
        @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' -ErrorAction Stop)
    } catch {
    })
    foreach ($drive in $removable) {
        if (-not $drive.DeviceID) { continue }
        $root = "$($drive.DeviceID)\"
        if ((Test-Path -LiteralPath (Join-Path $root 'INFO_UF2.TXT')) -or $drive.VolumeName -match 'RPI-RP2|PICO') {
            $devices += [pscustomobject]@{
                id = 'pico-volume-{0:d2}' -f ($devices.Count + 1)
                type = 'removable-volume'
                path = $root
            }
        }
    }
}

$serialPorts = @(try {
    @(Get-CimInstance Win32_SerialPort -ErrorAction Stop | Where-Object {
        $_.Name -match 'Pico|RP2|USB Serial|MicroPython'
    } | ForEach-Object {
        [pscustomobject]@{ port = $_.DeviceID; label = ($_.Name -replace '(?i)(password|ssid|secret)\s*[:=]\s*\S+', '$1=<redacted>') }
    })
} catch {
})

$report = [ordered]@{
    run_id = $runId
    mode = $Mode
    started_at = $started.ToString('o')
    hardware_available = ($devices.Count -gt 0 -or $serialPorts.Count -gt 0)
    serial_ports = $serialPorts
    devices = @()
    limitations = @()
}

if ($devices.Count -eq 0) {
    $report.limitations += 'No se detectó una Pico W con filesystem accesible; no se ejecutó respaldo ni despliegue físico.'
    if ($Mode -in @('Backup', 'Deploy') -and -not $AllowNoDevice) {
        throw 'No hay dispositivos disponibles. Use -DevicePath con un doble de filesystem o -AllowNoDevice para registrar el pendiente.'
    }
}

foreach ($device in $devices) {
    $deviceStarted = Get-Date
    $entry = [ordered]@{
        device_id = $device.id
        type = $device.type
        stage = 'inventory'
        file_count_before = 0
        file_count_after = 0
        files_before = @()
        files_after = @()
        backup_path = $null
        backup_manifest = $null
        deployed_files = 0
        config_local_preserved = $null
        duration_ms = 0
        ok = $false
    }
    try {
        $before = @(Get-FileInventory -Root $device.path)
        $entry.file_count_before = $before.Count
        $entry.files_before = $before
        if ($Mode -in @('Backup', 'Deploy')) {
            $entry.stage = 'backup'
            $backupPath = Join-Path $BackupRoot (Join-Path $runId $device.id)
            if (Test-Path -LiteralPath $backupPath) {
                throw "La ruta de respaldo ya existe y no será sobrescrita: $backupPath"
            }
            [System.IO.Directory]::CreateDirectory($backupPath) | Out-Null
            Copy-TreeSafely -Source $device.path -Destination $backupPath | Out-Null
            $entry.backup_path = $backupPath
            $backupManifestPath = Join-Path $backupPath 'backup-manifest.json'
            $backupManifest = [ordered]@{
                run_id = $runId
                device_id = $device.id
                created_at = (Get-Date).ToString('o')
                files = $before
            }
            [System.IO.File]::WriteAllText(
                $backupManifestPath,
                (($backupManifest | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
                [System.Text.UTF8Encoding]::new($false)
            )
            $entry.backup_manifest = $backupManifestPath
        }
        if ($Mode -eq 'Deploy') {
            $entry.stage = 'deploy'
            $configPath = Join-Path $device.path 'config_local.py'
            $configBefore = if (Test-Path -LiteralPath $configPath -PathType Leaf) {
                (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
            } else { $null }
            if ($PSCmdlet.ShouldProcess($device.path, 'Desplegar firmware HiLeS preservando config_local.py')) {
                $deployed = @(Copy-TreeSafely -Source $firmwareRoot -Destination $device.path -FirmwareOnly)
                $entry.deployed_files = $deployed.Count
            }
            $configAfter = if (Test-Path -LiteralPath $configPath -PathType Leaf) {
                (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
            } else { $null }
            $entry.config_local_preserved = ($configBefore -eq $configAfter)
            if (-not $entry.config_local_preserved) {
                throw "La protección de config_local.py falló para $($device.id)."
            }
        }
        $after = @(Get-FileInventory -Root $device.path)
        $entry.file_count_after = $after.Count
        $entry.files_after = $after
        $entry.stage = 'complete'
        $entry.ok = $true
    } catch {
        $entry.failure = [ordered]@{
            device = $device.id
            fragment = '<not-deployed>'
            connection = '<not-started>'
            stage = $entry.stage
            message = $_.Exception.Message
        }
    } finally {
        $entry.duration_ms = [int]((Get-Date) - $deviceStarted).TotalMilliseconds
        $report.devices += [pscustomobject]$entry
    }
}

$report.finished_at = (Get-Date).ToString('o')
$report.duration_ms = [int]((Get-Date) - $started).TotalMilliseconds
$report.ok = -not ($report.devices | Where-Object { -not $_.ok })

if ($ReportPath) {
    $absoluteReport = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $ReportPath))
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $absoluteReport)) | Out-Null
    [System.IO.File]::WriteAllText(
        $absoluteReport,
        (($report | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
        [System.Text.UTF8Encoding]::new($false)
    )
}

$report | ConvertTo-Json -Depth 8
if (-not $report.ok) { exit 1 }
