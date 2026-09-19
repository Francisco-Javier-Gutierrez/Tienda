# scripts/deploy-frontend.ps1
param (
    [string]$Profile = "terra-profile",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================="
Write-Host "Despliegue de Frontend (S3 + CloudFront)"
Write-Host "========================================="

$TerraformState = Join-Path $PSScriptRoot "..\terraform\terraform.tfstate"
$BucketName = "tienda-donapaty-frontend"
$DistributionId = ""

if (Test-Path $TerraformState) {
    Write-Host "Obteniendo configuracion desde terraform.tfstate..."
    try {
        $State = Get-Content $TerraformState -Raw | ConvertFrom-Json
        if ($State.outputs.s3_bucket_name.value) {
            $BucketName = $State.outputs.s3_bucket_name.value
        }
        if ($State.outputs.cloudfront_distribution_id.value) {
            $DistributionId = $State.outputs.cloudfront_distribution_id.value
        }
    } catch {
        Write-Host "No se pudieron leer los outputs de terraform. Usando valores por defecto."
    }
}

Write-Host "Bucket destino: $BucketName"
if ($DistributionId) {
    Write-Host "CloudFront ID:  $DistributionId"
}

Write-Host "`nCompilando Frontend Angular para produccion..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la compilacion de Angular."
    exit 1
}

Write-Host "`nGenerando paquete de actualizacion en vivo (OTA) para la app movil..."
$Version = (Get-Date -Format "yyyyMMdd.HHmm")
$WwwDir = (Resolve-Path (Join-Path $PSScriptRoot "..\www")).Path
$UpdatesDir = Join-Path $WwwDir "updates"
if (-not (Test-Path $UpdatesDir)) {
    New-Item -ItemType Directory -Path $UpdatesDir -Force | Out-Null
}

$ZipPath = Join-Path $UpdatesDir "bundle-$Version.zip"
$ItemsToZip = Get-ChildItem -Path $WwwDir | Where-Object { $_.Name -ne "updates" }
Compress-Archive -Path $ItemsToZip.FullName -DestinationPath $ZipPath -Force

$CloudFrontUrl = "https://d1a6rub2w65qdc.cloudfront.net"
$Manifest = [ordered]@{
    version   = $Version
    url       = "$CloudFrontUrl/updates/bundle-$Version.zip"
    mandatory = $false
    updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}
$ManifestJson = $Manifest | ConvertTo-Json
$ManifestPath = Join-Path $UpdatesDir "version.json"
[System.IO.File]::WriteAllText($ManifestPath, $ManifestJson, [System.Text.Encoding]::UTF8)
Write-Host "Paquete OTA v$Version generado exitosamente."

Write-Host "`nSincronizando carpeta www/ con S3..."
aws s3 sync www/ "s3://$BucketName" --profile $Profile --region $Region --delete --exclude "downloads/*"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la sincronizacion a S3."
    exit 1
}
Write-Host "Archivos sincronizados en S3 con exito."

if ($DistributionId) {
    Write-Host "`nInvalidando cache de CloudFront (/*)..."
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --profile $Profile
    Write-Host "Invalidacion solicitada exitosamente."
}

Write-Host "`nDespliegue del Frontend completado exitosamente!"
