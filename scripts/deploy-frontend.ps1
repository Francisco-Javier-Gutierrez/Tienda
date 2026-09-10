# scripts/deploy-frontend.ps1
# Script para compilar el frontend Angular y sincronizarlo a S3 + CloudFront

param (
    [string]$Profile = "terra-profile",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Despliegue de Frontend (S3 + CloudFront)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Obtener outputs de Terraform si existen
$TerraformDir = Join-Path $PSScriptRoot "..\terraform"
$BucketName = ""
$DistributionId = ""

if (Test-Path (Join-Path $TerraformDir "terraform.tfstate")) {
    Write-Host "📦 Obteniendo configuracion desde Terraform..." -ForegroundColor Yellow
    try {
        $BucketName = (terraform -chdir=$TerraformDir output -raw s3_bucket_name 2>$null)
        $DistributionId = (terraform -chdir=$TerraformDir output -raw cloudfront_distribution_id 2>$null)
    } catch {
        Write-Host "No se pudieron leer los outputs de terraform automaticamente." -ForegroundColor Gray
    }
}

if (-not $BucketName) {
    $BucketName = "tienda-donapaty-frontend"
}

Write-Host "Bucket destino: $BucketName" -ForegroundColor Green
if ($DistributionId) {
    Write-Host "CloudFront ID:  $DistributionId" -ForegroundColor Green
}

# 2. Compilar Frontend Angular
Write-Host "`n🔨 Compilando Frontend Angular para produccion..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la compilacion de Angular."
    exit 1
}

# 3. Sincronizar archivos a S3
Write-Host "`n☁️ Sincronizando carpeta www/ con S3..." -ForegroundColor Yellow
aws s3 sync www/ "s3://$BucketName" --profile $Profile --region $Region --delete
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la sincronizacion a S3."
    exit 1
}
Write-Host "✅ Archivos sincronizados en S3 con exito." -ForegroundColor Green

# 4. Invalidar cache de CloudFront si existe
if ($DistributionId) {
    Write-Host "`n🔄 Invalidando cache de CloudFront (/*)..." -ForegroundColor Yellow
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --profile $Profile
    Write-Host "✅ Invalidacion solicitada exitosamente." -ForegroundColor Green
} else {
    Write-Host "`n⚠️ No se detecto distribution_id de Terraform. Si ya creaste CloudFront, invalida con:" -ForegroundColor Gray
    Write-Host "aws cloudfront create-invalidation --distribution-id <ID> --paths '/*' --profile $Profile" -ForegroundColor Gray
}

Write-Host "`n🎉 Despliegue del Frontend completado exitosamente!" -ForegroundColor Cyan
