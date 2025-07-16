# 🚀 Nexus Uygulamasını Yayınlama Rehberi

## 📋 Gereksinimler

1. **Node.js 18+** yüklü olmalı
2. **GitHub hesabı** ve repository
3. **Code signing sertifikası** (opsiyonel ama önerilen)

## 🔧 Kurulum

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Electron-updater ve Build Araçlarını Yükle
```bash
npm install electron-updater --save
npm install electron-builder --save-dev
```

## 📦 Build Alma

### Development Build
```bash
npm run build
```

### Production Build (Executable)
```bash
npm run dist
```

### Auto-publish ile Build (GitHub Releases)
```bash
npm run publish
```

## 🔄 Otomatik Güncelleme Sistemi

### Nasıl Çalışır?
1. Uygulama başlatıldığında `electron-updater` güncellemeleri kontrol eder
2. GitHub Releases'dan yeni sürüm olup olmadığını kontrol eder
3. Güncelleme varsa otomatik indirir
4. Kullanıcıya bildirim gösterir
5. Kullanıcı onayladığında uygulamayı yeniden başlatır

### Güncelleme Yayınlama
1. `package.json`'da version'ı artır
2. Değişiklikleri commit et
3. GitHub'a push et
4. GitHub Actions otomatik build alır
5. Yeni release oluşturur

## 🏗️ GitHub Actions Kurulumu

### 1. Repository Secrets
GitHub repository settings > Secrets'a git:
- `GITHUB_TOKEN` (otomatik olarak mevcut)

### 2. Repository Ayarları
- `package.json`'da `"publish"` bölümünde GitHub username'i güncelle
- Repository'yi public yap (veya private için GitHub Pro)

## 🎨 İkonlar

### Gerekli İkon Dosyaları:
- `build/icon.ico` (Windows - 256x256)
- `build/icon.icns` (macOS - 512x512)
- `build/icon.png` (Linux - 512x512)

### İkon Oluşturma:
```bash
# Online araçlar kullanabilirsiniz:
# - https://iconverticons.com/
# - https://icoconvert.com/
```

## 📱 Platform Spesifik Ayarlar

### Windows
- NSIS installer kullanılır
- Code signing için sertifika gerekli
- Auto-updater tam desteklenir

### macOS
- DMG paketi oluşturulur
- Apple Developer sertifikası gerekli
- Notarization gerekli

### Linux
- AppImage formatında dağıtılır
- Auto-updater desteklenir

## 🔐 Code Signing

### Windows Code Signing
```bash
# package.json build konfigürasyonuna ekle:
"win": {
  "certificateFile": "path/to/certificate.p12",
  "certificatePassword": "password"
}
```

### macOS Code Signing
```bash
# package.json build konfigürasyonuna ekle:
"mac": {
  "identity": "Developer ID Application: Your Name"
}
```

## 🚀 Yayınlama Süreci

### 1. Manuel Yayınlama
```bash
# 1. Version'ı artır
npm version patch  # veya minor, major

# 2. Build al
npm run build

# 3. Dist oluştur
npm run dist

# 4. GitHub'a push et
git push origin main
git push --tags
```

### 2. Otomatik Yayınlama
```bash
# Sadece main branch'e push et
git push origin main

# GitHub Actions otomatik olarak:
# - Build alacak
# - Test edecek
# - Release oluşturacak
```

## 🔄 Güncelleme Stratejisi

### Sürüm Numaralandırma
- `1.0.0` → `1.0.1` (Bug fixes)
- `1.0.0` → `1.1.0` (New features)
- `1.0.0` → `2.0.0` (Breaking changes)

### Güncelleme Tipleri
- **Silent Update**: Arka planda indirir, yeniden başlatmada yükler
- **Forced Update**: Kritik güvenlik güncellemeleri
- **Optional Update**: Kullanıcı tercihine bırakır

## 🐛 Hata Ayıklama

### Build Hataları
```bash
# Cache temizle
npm run clean
rm -rf node_modules
npm install

# Electron rebuild
npm run electron-rebuild
```

### Auto-updater Hataları
```bash
# Development'ta test et
npm run dev

# Log'ları kontrol et
console.log(autoUpdater.getFeedURL())
```

## 📊 Dağıtım Metrikleri

### GitHub Releases
- Download sayılarını takip et
- Crash reports topla
- User feedback al

### Analytics
- Electron'da analytics ekle
- Kullanım istatistikleri topla
- Performance metrikleri

## 🔧 Konfigürasyon Dosyaları

### .env Dosyası
```env
# Production ayarları
NODE_ENV=production
AUTO_UPDATE_URL=https://github.com/username/nexus/releases
```

### electron-builder.json
```json
{
  "appId": "com.nexus.chat",
  "productName": "Nexus",
  "publish": {
    "provider": "github",
    "owner": "YOUR_USERNAME",
    "repo": "nexus"
  }
}
```

## 📋 Checklist

### Yayınlama Öncesi
- [ ] Tüm testler geçiyor
- [ ] İkonlar yerleştirildi
- [ ] Version artırıldı
- [ ] Changelog güncellendi
- [ ] GitHub secrets ayarlandı

### Yayınlama Sonrası
- [ ] Release notes yazıldı
- [ ] Dağıtım kanalları bilgilendirildi
- [ ] Feedback toplanmaya başlandı
- [ ] Monitoring aktif

## 🎯 Sonuç

Bu rehberi takip ederek Nexus uygulamanızı başarıyla yayınlayabilir ve otomatik güncelleme sistemi kurabilirsiniz. Herhangi bir sorunla karşılaştığınızda GitHub Issues'dan destek alabilirsiniz.

---

📧 **Destek**: GitHub Issues
🌐 **Website**: [Your Website]
📱 **Discord**: [Your Discord] 