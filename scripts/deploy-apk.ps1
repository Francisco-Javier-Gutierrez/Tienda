# scripts/deploy-apk.ps1
param (
    [string]$Profile = "terra-profile",
    [string]$Region = "us-east-1",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host "========================================="
Write-Host "Despliegue de APK a S3 + CloudFront"
Write-Host "========================================="

$ApkRelativePath = "android\app\build\outputs\apk\debug\app-debug.apk"
$ApkPath = Join-Path (Join-Path $PSScriptRoot "..") $ApkRelativePath

if (-not $SkipBuild) {
    Write-Host "`nCompilando Frontend para Android (ng build --configuration production)..."
    Push-Location (Join-Path $PSScriptRoot "..")
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Fallo la compilacion de Angular."
            exit 1
        }
    } finally {
        Pop-Location
    }

    Write-Host "`nSincronizando Capacitor con Android..."
    npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo la sincronizacion de Capacitor."
        exit 1
    }

    Write-Host "`nCompilando APK de Android (assembleDebug)..."
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    Push-Location (Join-Path $PSScriptRoot "..\android")
    try {
        .\gradlew.bat assembleDebug
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Fallo la compilacion de Gradle."
            exit 1
        }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $ApkPath)) {
    Write-Error "No se encontro el archivo APK en: $ApkPath"
    exit 1
}

$BucketName = "tienda-donapaty-frontend"
$DistributionId = "E3DK9EEDC1FC49"
$S3Destination = "s3://$BucketName/downloads/tienda-donapaty.apk"
$PublicUrl = "https://d1a6rub2w65qdc.cloudfront.net/downloads/tienda-donapaty.apk"

$FileInfo = Get-Item $ApkPath
$SizeMb = [math]::Round($FileInfo.Length / 1MB, 2)
Write-Host "`nSubiendo APK ($SizeMb MB) a S3 ($S3Destination)..."

aws s3 cp $ApkPath $S3Destination --content-type "application/vnd.android.package-archive" --profile $Profile --region $Region
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la subida a S3."
    exit 1
}

Write-Host "APK subido a S3 exitosamente."

if ($DistributionId) {
    Write-Host "`nInvalidando cache de CloudFront para /downloads/*..."
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/downloads/*" --profile $Profile
    Write-Host "Invalidacion creada exitosamente."
}

Write-Host "`n========================================="
Write-Host "Enlace permanente de descarga directa:"
Write-Host "$PublicUrl"
Write-Host "========================================="
