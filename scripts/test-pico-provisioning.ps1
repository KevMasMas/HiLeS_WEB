$ErrorActionPreference = 'Stop'

$deployScript = Join-Path $PSScriptRoot 'test-distributed-physical.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('hiles-pico-provisioning-test-' + [guid]::NewGuid().ToString('N'))
$deviceRoot = Join-Path $testRoot 'device'
$backupRoot = Join-Path $testRoot 'backups'
$libUmqttRoot = Join-Path $deviceRoot 'lib\umqtt'

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    [System.IO.Directory]::CreateDirectory($deviceRoot) | Out-Null
    [System.IO.Directory]::CreateDirectory((Join-Path $deviceRoot 'umqtt')) | Out-Null
    [System.IO.Directory]::CreateDirectory($libUmqttRoot) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $deviceRoot 'config_local.py'), "MQTT_PASSWORD = 'do-not-print'`n")
    [System.IO.File]::WriteAllText((Join-Path $deviceRoot 'umqtt\simple.py'), 'preserve this dependency')
    [System.IO.File]::WriteAllText((Join-Path $libUmqttRoot 'robust.py'), 'preserve installed package')
    [System.IO.File]::WriteAllText((Join-Path $deviceRoot 'main.py'), 'obsolete runtime')
    [System.IO.File]::WriteAllText((Join-Path $deviceRoot 'legacy.py'), 'explicitly obsolete')

    $output = @(& $deployScript -Mode Deploy -DevicePath $deviceRoot `
        -BackupRoot $backupRoot -ObsoletePath 'legacy.py')
    $report = ($output -join [Environment]::NewLine) | ConvertFrom-Json
    $device = $report.devices[0]
    Assert-True $report.ok 'El despliegue de prueba no terminó correctamente.'
    Assert-True $device.backup_verified 'El respaldo no verificó sus checksums.'
    Assert-True $device.config_local_preserved 'config_local.py no se preservó.'
    Assert-True $device.umqtt_preserved 'umqtt/ no se preservó.'
    Assert-True ($device.manifest_comparison_after.Count -gt 0) 'No se produjo comparación del manifiesto.'
    Assert-True (@($device.manifest_comparison_after | Where-Object status -ne 'match').Count -eq 0) 'El firmware desplegado no coincide con las fuentes.'
    Assert-True ([System.IO.File]::ReadAllText((Join-Path $deviceRoot 'config_local.py')) -match 'do-not-print') 'Cambió la configuración local.'
    Assert-True ([System.IO.File]::ReadAllText((Join-Path $deviceRoot 'umqtt\simple.py')) -eq 'preserve this dependency') 'Cambió umqtt/simple.py.'
    Assert-True ([System.IO.File]::ReadAllText((Join-Path $libUmqttRoot 'robust.py')) -eq 'preserve installed package') 'Cambió lib/umqtt/robust.py.'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $deviceRoot 'legacy.py'))) 'No se retiró el archivo obsoleto explícito.'
    Assert-True (Test-Path -LiteralPath (Join-Path $device.backup_path 'legacy.py')) 'El archivo obsoleto no quedó respaldado antes de retirarse.'
    Assert-True (-not (($output -join "`n").Contains('do-not-print'))) 'El informe expuso una credencial.'
    Assert-True (@($device.removed_obsolete_files) -contains 'legacy.py') 'El informe no registró el archivo retirado.'

    $unsafePathRejected = $false
    try {
        $null = & $deployScript -Mode Deploy -DevicePath $deviceRoot `
            -BackupRoot $backupRoot -ObsoletePath 'lib\umqtt\robust.py'
    }
    catch {
        $unsafePathRejected = $_.Exception.Message -match 'Ruta obsoleta no permitida'
        if (-not $unsafePathRejected) { throw }
    }
    Assert-True $unsafePathRejected 'El script aceptó una ruta de borrado fuera del alcance permitido.'

    $uf2Root = Join-Path $testRoot 'uf2'
    [System.IO.Directory]::CreateDirectory($uf2Root) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $uf2Root 'INFO_UF2.TXT'), 'bootloader volume')
    $uf2Rejected = $false
    try {
        $null = & $deployScript -Mode Inventory -DevicePath $uf2Root
    }
    catch {
        $uf2Rejected = $_.Exception.Message -match 'bootloader UF2'
        if (-not $uf2Rejected) { throw }
    }
    Assert-True $uf2Rejected 'El script trató el volumen UF2 como filesystem de MicroPython.'

    Write-Output 'Pruebas de aprovisionamiento Pico: PASS'
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
