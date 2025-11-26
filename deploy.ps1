# MagnaFlow Deployment Script
# Run this script to deploy your app to Firebase Hosting

Write-Host "🚀 MagnaFlow Deployment Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version 2>$null
    if ($firebaseVersion) {
        Write-Host "✅ Firebase CLI installed: $firebaseVersion" -ForegroundColor Green
    } else {
        throw "Not installed"
    }
} catch {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installing Firebase CLI..." -ForegroundColor Yellow
    npm install -g firebase-tools
    Write-Host "✅ Firebase CLI installed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Building production version..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Login to Firebase:" -ForegroundColor White
Write-Host "   firebase login" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Deploy to Firebase Hosting:" -ForegroundColor White
Write-Host "   firebase deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Your app will be live at:" -ForegroundColor White
Write-Host "   https://magnaflow-07sep25.web.app" -ForegroundColor Green
Write-Host ""
Write-Host "4. Add custom domain (magnaflow.abstraca.com):" -ForegroundColor White
Write-Host "   Go to Firebase Console > Hosting > Add custom domain" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Ready to deploy! Run: firebase deploy" -ForegroundColor Cyan
