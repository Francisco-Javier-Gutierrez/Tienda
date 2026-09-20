# scripts/backup-all.ps1
param (
    [string]$Profile = "terra-profile",
    [string]$Region = "us-east-1",
    [string]$TableName = "tienda-donapaty-table-production",
    [string]$BucketName = "tienda-donapaty-uploads"
)

$ErrorActionPreference = "Stop"

Write-Host "================================================="
Write-Host "Iniciando Respaldo Integral Preventivo (Fase 0)"
Write-Host "================================================="
Write-Host "Fecha y Hora: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Perfil AWS:   $Profile"
Write-Host "Region AWS:   $Region"
Write-Host "Tabla DDB:    $TableName"
Write-Host "Bucket S3:    $BucketName"
Write-Host "-------------------------------------------------`n"

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRootDir = Join-Path $PSScriptRoot "..\backups"
$DdbBackupDir = Join-Path $BackupRootDir "dynamodb"
$S3BackupDir = Join-Path $BackupRootDir "s3-uploads"

if (-not (Test-Path $DdbBackupDir)) {
    New-Item -ItemType Directory -Path $DdbBackupDir -Force | Out-Null
}
if (-not (Test-Path $S3BackupDir)) {
    New-Item -ItemType Directory -Path $S3BackupDir -Force | Out-Null
}

# -------------------------------------------------------------
# 1. Respaldo Nativo de DynamoDB (AWS On-Demand Backup)
# -------------------------------------------------------------
$AwsBackupName = "backup-pre-utilidades-$Timestamp"
Write-Host "[1/3] Creando snapshot nativo en AWS DynamoDB ($AwsBackupName)..."
try {
    $DdbResult = aws dynamodb create-backup `
        --table-name $TableName `
        --backup-name $AwsBackupName `
        --profile $Profile `
        --region $Region | ConvertFrom-Json

    $BackupArn = $DdbResult.BackupDetails.BackupArn
    Write-Host " Snapshot AWS creado con exito!"
    Write-Host " ARN: $BackupArn`n"
} catch {
    Write-Warning "No se pudo crear el backup nativo on-demand en AWS: $_"
}

# -------------------------------------------------------------
# 2. Respaldo Local de DynamoDB (JSON Dump de todos los items)
# -------------------------------------------------------------
Write-Host "[2/3] Exportando dump local de todos los items de DynamoDB..."
$LocalDumpFile = Join-Path $DdbBackupDir "dump-$TableName-$Timestamp.json"

try {
    $AllItems = @()
    $ScanArgs = @(
        "dynamodb", "scan",
        "--table-name", $TableName,
        "--profile", $Profile,
        "--region", $Region,
        "--max-items", "1000"
    )

    $ScanOutput = aws @ScanArgs | ConvertFrom-Json
    if ($ScanOutput.Items) {
        $AllItems += $ScanOutput.Items
    }

    $NextToken = $ScanOutput.NextToken
    while ($NextToken) {
        Write-Host "   Leyendo siguiente pagina de items..."
        $PagedOutput = aws dynamodb scan `
            --table-name $TableName `
            --profile $Profile `
            --region $Region `
            --starting-token $NextToken `
            --max-items "1000" | ConvertFrom-Json
        if ($PagedOutput.Items) {
            $AllItems += $PagedOutput.Items
        }
        $NextToken = $PagedOutput.NextToken
    }

    $JsonPayload = $AllItems | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($LocalDumpFile, $JsonPayload, [System.Text.Encoding]::UTF8)

    $DumpSizeKb = [math]::Round((Get-Item $LocalDumpFile).Length / 1KB, 2)
    Write-Host " Dump local completado: $($AllItems.Count) registros exportados ($DumpSizeKb KB)"
    Write-Host " Archivo: $LocalDumpFile`n"
} catch {
    Write-Error "Fallo al exportar el dump local de DynamoDB: $_"
    exit 1
}

# -------------------------------------------------------------
# 3. Respaldo Local de S3 (Imágenes y Comprobantes)
# -------------------------------------------------------------
Write-Host "[3/3] Sincronizando bucket S3 ($BucketName) a local..."
try {
    aws s3 sync "s3://$BucketName" "$S3BackupDir" --profile $Profile --region $Region
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo al sincronizar S3."
        exit 1
    }

    $S3Files = Get-ChildItem -Path $S3BackupDir -Recurse -File
    $TotalSizeMb = 0
    if ($S3Files) {
        $TotalBytes = ($S3Files | Measure-Object -Property Length -Sum).Sum
        $TotalSizeMb = [math]::Round($TotalBytes / 1MB, 2)
    }

    Write-Host " Sincronizacion de S3 completada: $($S3Files.Count) archivos respaldados ($TotalSizeMb MB)"
    Write-Host " Destino: $S3BackupDir`n"
} catch {
    Write-Error "Error durante el respaldo de S3: $_"
    exit 1
}

Write-Host "================================================="
Write-Host " Respaldo Preventivo de Fase 0 Completado con Exito!"
Write-Host "================================================="
