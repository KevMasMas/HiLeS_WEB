$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $repoRoot 'firmware\pico'
$guidePath = Join-Path $repoRoot 'docs\mqtt\GUIA_PRUEBA_PICO_W.md'
$outputPath = Join-Path $repoRoot 'output\hiles-pico-w-deploy.zip'
$checksumPath = Join-Path $repoRoot 'output\hiles-pico-w-deploy.sha256'

$requiredDirectories = @('core', 'devices', 'hiles', 'platform', 'pubsub')
$requiredFiles = @('main.py', 'config_local.example.py')

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $relativePath) -PathType Leaf)) {
        throw "Falta el archivo obligatorio: $relativePath"
    }
}
foreach ($relativePath in $requiredDirectories) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $relativePath) -PathType Container)) {
        throw "Falta el directorio obligatorio: $relativePath"
    }
}
if (-not (Test-Path -LiteralPath $guidePath -PathType Leaf)) {
    throw 'Falta docs/mqtt/GUIA_PRUEBA_PICO_W.md'
}

$files = @(
    Get-Item -LiteralPath (Join-Path $sourceRoot 'main.py')
    Get-Item -LiteralPath (Join-Path $sourceRoot 'config_local.example.py')
    foreach ($directory in $requiredDirectories) {
        Get-ChildItem -LiteralPath (Join-Path $sourceRoot $directory) -Recurse -File -Filter '*.py' |
            Where-Object { $_.FullName -notmatch '[\\/]__pycache__[\\/]' }
    }
)

$outputDirectory = Split-Path -Parent $outputPath
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$stream = [System.IO.File]::Open(
    $outputPath,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
)
try {
    $archive = [System.IO.Compression.ZipArchive]::new(
        $stream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )
    try {
        foreach ($file in $files) {
            $sourcePrefix = $sourceRoot.TrimEnd('\') + '\'
            $entryName = $file.FullName.Substring($sourcePrefix.Length).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $file.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $guidePath,
            'LEEME_PRIMERO.md',
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $stream.Dispose()
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
try {
    $entryNames = @($zip.Entries | ForEach-Object FullName)
    foreach ($required in @(
        'main.py',
        'config_local.example.py',
        'core/__init__.py',
        'devices/__init__.py',
        'devices/watchdog_task.py',
        'hiles/__init__.py',
        'hiles/distributed_worker.py',
        'hiles/engine_task_v2.py',
        'hiles/engine_v2.py',
        'hiles/python_executor.py',
        'platform/__init__.py',
        'pubsub/__init__.py',
        'pubsub/mqtt_transport.py',
        'pubsub/topics.py',
        'LEEME_PRIMERO.md'
    )) {
        if ($required -notin $entryNames) {
            throw "El ZIP no contiene $required"
        }
    }
    if ($entryNames | Where-Object { $_ -match '(__pycache__|\.pyc$|^examples/|^config_local\.py$)' }) {
        throw 'El ZIP contiene archivos locales o generados que no deben subirse.'
    }
}
finally {
    $zip.Dispose()
}

$hash = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash
[System.IO.File]::WriteAllText(
    $checksumPath,
    "$hash  hiles-pico-w-deploy.zip`n",
    [System.Text.UTF8Encoding]::new($false)
)
Write-Output "Paquete creado: $outputPath"
Write-Output "Archivos incluidos: $($entryNames.Count)"
Write-Output "SHA256: $hash"
