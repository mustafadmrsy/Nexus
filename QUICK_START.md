# 🚀 Nexus - Hızlı Yayınlama Rehberi

## 📋 Hızlı Başlangıç (5 Dakika)

### 1. Gerekli Değişiklikler
```bash
# package.json'da GitHub username'inizi değiştirin
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",  // ← Buraya GitHub username'inizi yazın
  "repo": "nexus"
}
```

### 2. İkon Dosyalarını Ekleyin
```bash
# build/ klasörüne şu dosyaları ekleyin:
- icon.ico (Windows için)
- icon.icns (macOS için)  
- icon.png (Linux için)

# Geçici olarak basit bir icon:
```

### 3. Hızlı Build
```bash
# Development build test et
npm run build

# Production build al
npm run dist

# Sonuç: dist-electron/ klasöründe executable dosyalar
```

### 4. GitHub Repository Kurulumu
```bash
# 1. GitHub'da yeni repository oluştur
# 2. Local repo'yu GitHub'a bağla
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/nexus.git
git push -u origin main
```

### 5. Otomatik Güncelleme Testi
```bash
# Version artır
npm version patch

# Build ve publish
npm run publish

# GitHub Actions otomatik çalışacak
```

## 🎯 Sonuç

✅ Uygulama yayınlandı!
✅ Otomatik güncelleme sistemi aktif!
✅ GitHub Actions ile CI/CD hazır!

### İndirme Linkleri:
- Windows: `dist-electron/nexus Setup 1.0.0.exe`
- macOS: `dist-electron/nexus-1.0.0.dmg`
- Linux: `dist-electron/nexus-1.0.0.AppImage`

---

💡 **İpucu**: İlk yayında code signing olmadan "Bilinmeyen yayıncı" uyarısı çıkabilir. Bu normal!

📧 **Destek**: GitHub Issues kısmından soru sorabilirsiniz. 