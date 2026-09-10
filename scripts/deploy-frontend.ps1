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

Write-Host "`nSincronizando carpeta www/ con S3..."
aws s3 sync www/ "s3://$BucketName" --profile $Profile --region $Region --delete
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
