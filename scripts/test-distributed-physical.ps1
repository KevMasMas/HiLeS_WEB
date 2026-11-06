[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('DryRun', 'Inventory', 'Backup', 'Deploy')]
    [string]$Mode = 'DryRun',
    [string[]]$DevicePath = @(),
    [string]$BackupRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'hiles-pico-backups'),
    [string]$ReportPath = '',
    [string[]]$ObsoletePath = @(),
    [switch]$AllowNoDevice
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$firmwareRoot = Join-Path $repoRoot 'firmware\pico'
$canonicalDirectories = @('core', 'devices', 'hiles', 'platform', 'pubsub')
$runId = 'pico-fleet-{0:yyyyMMdd-HHmmss}-{1}' -f (Get-Date), ([guid]::NewGuid().ToString('N').Substring(0, 8))
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
        } | Sort-Object path
    )
}

function Get-CanonicalFirmwareFiles {
    return @(
        Get-Item -LiteralPath (Join-Path $firmwareRoot 'main.py')
        Get-Item -LiteralPath (Join-Path $firmwareRoot 'config_local.example.py')
        foreach ($directory in $canonicalDirectories) {
            Get-ChildItem -LiteralPath (Join-Path $firmwareRoot $directory) -Recurse -File -Filter '*.py' |
                Where-Object { $_.FullName -notmatch '[\\/]__pycache__[\\/]' }
        }
    )
}

function Get-FirmwareComparison {
    param([string]$DeviceRoot)
    $actualByPath = @{}
    foreach ($item in (Get-FileInventory -Root $DeviceRoot)) { $actualByPath[$item.path] = $item }
    return @(
        foreach ($file in (Get-CanonicalFirmwareFiles)) {
            $relative = Get-RelativePath -Root $firmwareRoot -Path $file.FullName
            $expectedHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            $actual = $actualByPath[$relative]
            $comparisonState = if ($null -eq $actual) {
                'missing'
            } elseif ($actual.sha256 -ne $expectedHash) {
                'changed'
            } else {
                'match'
            }
            [pscustomobject]@{
                path = $relative
                expected_sha256 = $expectedHash
                actual_sha256 = if ($null -eq $actual) { $null } else { $actual.sha256 }
                status = $comparisonState
            }
        }
    )
}

function Get-UmqttInventory {
    param([string]$DeviceRoot)
    $files = @()
    foreach ($relativeRoot in @('umqtt', 'lib\umqtt')) {
        $dependencyRoot = Join-Path $DeviceRoot $relativeRoot
        if (Test-Path -LiteralPath $dependencyRoot -PathType Container) {
            foreach ($file in (Get-FileInventory -Root $dependencyRoot)) {
                $files += [pscustomobject]@{
                    path = ($relativeRoot.Replace('\', '/') + '/' + $file.path)
                    size_bytes = $file.size_bytes
                    sha256 = $file.sha256
                }
            }
        }
    }
    return @($files | Sort-Object path)
}

function Get-RelativePath {
    param([string]$Root, [string]$Path)
    $prefix = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    return [System.IO.Path]::GetFullPath($Path).Substring($prefix.Length).Replace('\', '/')
}

function Test-CanonicalFirmwarePath {
    param([string]$RelativePath)
    return $RelativePath -eq 'main.py' -or
        $RelativePath -eq 'config_local.example.py' -or
        $RelativePath -match '^(core|devices|hiles|platform|pubsub)/.+\.py$'
}

function Copy-TreeSafely {
    param([string]$Source, [string]$Destination, [switch]$FirmwareOnly)
    $sourcePrefix = [System.IO.Path]::GetFullPath($Source).TrimEnd('\') + '\'
    $files = Get-ChildItem -LiteralPath $Source -Recurse -File | Where-Object {
        -not $FirmwareOnly -or (
            $_.Extension -eq '.py' -and
            $_.FullName -notmatch '[\\/]__pycache__[\\/]' -and
            (Test-CanonicalFirmwarePath -RelativePath $_.FullName.Substring($sourcePrefix.Length).Replace('\', '/'))
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
if ($ObsoletePath.Count -gt 0 -and $Mode -ne 'Deploy') {
    throw '-ObsoletePath solo se permite junto con -Mode Deploy.'
}

$validatedObsoletePaths = @()
foreach ($relativePath in $ObsoletePath) {
    $normalized = $relativePath.Replace('/', '\')
    if ([System.IO.Path]::IsPathRooted($normalized) -or
        $normalized -match '(^|\\)\.\.(\\|$)' -or
        $normalized -match '(^|\\)\.(\\|$)' -or
        $normalized -ieq 'config_local.py' -or
        $normalized -imatch '^(umqtt|lib\\umqtt)(\\|$)' -or
        (Test-CanonicalFirmwarePath -RelativePath $normalized.Replace('\', '/'))) {
        throw "Ruta obsoleta no permitida: $relativePath"
    }
    $validatedObsoletePaths += $normalized
}

$devices = @()
foreach ($candidate in $DevicePath) {
    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
        throw "El dispositivo o doble de filesystem no existe: $resolved"
    }
    if (Test-Path -LiteralPath (Join-Path $resolved 'INFO_UF2.TXT') -PathType Leaf) {
        throw "La ruta $resolved es el volumen del bootloader UF2, no el filesystem de MicroPython; no se modificará."
    }
    $devices += [pscustomobject]@{
        id = 'filesystem-{0:d2}' -f ($devices.Count + 1)
        type = 'filesystem'
        path = $resolved
    }
}

$bootloaderVolumes = @()
if ($devices.Count -eq 0) {
    $removable = @(try {
        @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' -ErrorAction Stop)
    } catch {
    })
    foreach ($drive in $removable) {
        if (-not $drive.DeviceID) { continue }
        $root = "$($drive.DeviceID)\"
        $isUf2Bootloader = (Test-Path -LiteralPath (Join-Path $root 'INFO_UF2.TXT')) -or
            $drive.VolumeName -match 'RPI-RP2'
        if ($isUf2Bootloader) {
            $bootloaderVolumes += $root
            continue
        }
        if ($drive.VolumeName -match 'PICO') {
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
    filesystem_available = ($devices.Count -gt 0)
    serial_ports = $serialPorts
    bootloader_volumes = $bootloaderVolumes
    devices = @()
    limitations = @()
}

if ($devices.Count -eq 0) {
    $report.limitations += 'No se detectó una Pico W con filesystem accesible; no se ejecutó respaldo ni despliegue físico.'
    if ($bootloaderVolumes.Count -gt 0) {
        $report.limitations += 'Se detectó un volumen UF2 de bootloader; no es el filesystem de MicroPython y no se usó como destino.'
    }
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
        manifest_comparison = @()
        manifest_comparison_after = @()
        backup_path = $null
        backup_manifest = $null
        backup_verified = $null
        deployed_files = 0
        removed_obsolete_files = @()
        config_local_preserved = $null
        umqtt_preserved = $null
        duration_ms = 0
        ok = $false
    }
    try {
        $before = @(Get-FileInventory -Root $device.path)
        $entry.file_count_before = $before.Count
        $entry.files_before = $before
        $entry.manifest_comparison = @(Get-FirmwareComparison -DeviceRoot $device.path)
        $canonicalFiles = @(Get-CanonicalFirmwareFiles)
        if ($Mode -in @('Backup', 'Deploy')) {
            $entry.stage = 'backup'
            $backupPath = Join-Path $BackupRoot (Join-Path $runId $device.id)
            if (Test-Path -LiteralPath $backupPath) {
                throw "La ruta de respaldo ya existe y no será sobrescrita: $backupPath"
            }
            [System.IO.Directory]::CreateDirectory($backupPath) | Out-Null
            Copy-TreeSafely -Source $device.path -Destination $backupPath | Out-Null
            foreach ($item in $before) {
                $sourcePath = Join-Path $device.path $item.path.Replace('/', '\')
                $backupFilePath = Join-Path $backupPath $item.path.Replace('/', '\')
                if (-not (Test-Path -LiteralPath $backupFilePath -PathType Leaf)) {
                    throw "Falta en el respaldo el archivo $($item.path)."
                }
                $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
                $backupHash = (Get-FileHash -LiteralPath $backupFilePath -Algorithm SHA256).Hash
                if ($sourceHash -ne $backupHash) {
                    throw "El checksum del respaldo no coincide para $($item.path)."
                }
            }
            $entry.backup_verified = $true
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
            $umqttBefore = @(Get-UmqttInventory -DeviceRoot $device.path)
            if ($PSCmdlet.ShouldProcess($device.path, 'Desplegar firmware HiLeS preservando config_local.py')) {
                $deployed = @(Copy-TreeSafely -Source $firmwareRoot -Destination $device.path -FirmwareOnly)
                $entry.deployed_files = $deployed.Count
                foreach ($file in $canonicalFiles) {
                    $relative = Get-RelativePath -Root $firmwareRoot -Path $file.FullName
                    $target = Join-Path $device.path $relative.Replace('/', '\')
                    $sourceHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
                    $targetHash = if (Test-Path -LiteralPath $target -PathType Leaf) {
                        (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
                    } else { $null }
                    if ($targetHash -ne $sourceHash) {
                        throw "La verificación del firmware desplegado falló para $relative."
                    }
                }
                foreach ($relativePath in $validatedObsoletePaths) {
                    $target = [System.IO.Path]::GetFullPath((Join-Path $device.path $relativePath))
                    $devicePrefix = [System.IO.Path]::GetFullPath($device.path).TrimEnd('\') + '\'
                    if (-not $target.StartsWith($devicePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                        throw "La ruta obsoleta escapa del filesystem del dispositivo: $relativePath"
                    }
                    if (Test-Path -LiteralPath $target -PathType Container) {
                        throw "Solo se pueden retirar archivos obsoletos explícitos, no directorios: $relativePath"
                    }
                    if ((Test-Path -LiteralPath $target -PathType Leaf) -and
                        $PSCmdlet.ShouldProcess($target, 'Retirar archivo obsoleto explícito')) {
                        Remove-Item -LiteralPath $target -Force
                        $entry.removed_obsolete_files += $relativePath.Replace('\', '/')
                    }
                }
            }
            $configAfter = if (Test-Path -LiteralPath $configPath -PathType Leaf) {
                (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
            } else { $null }
            $entry.config_local_preserved = ($configBefore -eq $configAfter)
            if (-not $entry.config_local_preserved) {
                throw "La protección de config_local.py falló para $($device.id)."
            }
            $umqttAfter = @(Get-UmqttInventory -DeviceRoot $device.path)
            $entry.umqtt_preserved = (($umqttBefore | ConvertTo-Json -Depth 4 -Compress) -eq ($umqttAfter | ConvertTo-Json -Depth 4 -Compress))
            if (-not $entry.umqtt_preserved) {
                throw "La protección de umqtt/ falló para $($device.id)."
            }
        }
        $after = @(Get-FileInventory -Root $device.path)
        $entry.file_count_after = $after.Count
        $entry.files_after = $after
        $entry.manifest_comparison_after = @(Get-FirmwareComparison -DeviceRoot $device.path)
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
