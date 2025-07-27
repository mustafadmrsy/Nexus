# 🚀 Nexus - Discord Benzeri Masaüstü Sohbet Uygulaması

![Nexus](https://img.shields.io/badge/Nexus-Chat%20App-blue?style=for-the-badge&logo=discord)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)

## 📖 Hakkında

**Nexus**, Discord benzeri modern bir masaüstü sohbet uygulamasıdır. Gerçek zamanlı mesajlaşma, sesli/görüntülü sohbet, sunucu yönetimi ve daha fazlasını sunar.

## ✨ Özellikler

### 💬 Sohbet Özellikleri
- **Gerçek Zamanlı Mesajlaşma** - Firebase Firestore ile anlık mesajlar
- **Emoji Desteği** - Emoji-mart ile zengin emoji kütüphanesi
- **Dosya Paylaşımı** - Resim, video, dosya yükleme
- **Özel Mesajlar** - Direct messaging sistemi
- **Mesaj Tepkileri** - Emoji ile mesaj tepkileri

### 🎮 Sesli/Görüntülü Sohbet
- **WebRTC Sesli Sohbet** - Yüksek kaliteli ses
- **Görüntülü Görüşme** - Video chat desteği
- **Ekran Paylaşımı** - Screen sharing özelliği
- **Ses Kontrolleri** - Mute, deafen, volume ayarları

### 🏠 Sunucu Sistemi
- **Sunucu Oluşturma** - Özel sunucular oluştur
- **Kanal Yönetimi** - Text, voice, category kanalları
- **Rol Sistemi** - Detaylı yetki yönetimi
- **Davet Sistemi** - Sunucu davet linkleri
- **Üye Yönetimi** - Kick, ban, timeout

### 👥 Kullanıcı Sistemi
- **Profil Yönetimi** - Avatar, bio, durum
- **Arkadaşlık Sistemi** - Friend requests
- **Online Durum** - Online, idle, dnd, offline
- **Bildirimler** - Real-time notifications

## 🛠️ Teknoloji Stack

- **Frontend**: React 18 + TypeScript + Material-UI
- **Desktop**: Electron 33
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Build Tool**: Vite
- **State Management**: React Context API
- **Real-time**: Firebase Realtime Database
- **Voice/Video**: WebRTC

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- npm veya yarn

### Adımlar

1. **Repository'yi klonlayın**
```bash
git clone https://github.com/mustafadmrsy/Nexus.git
cd Nexus
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Environment variables oluşturun**
```bash
# .env dosyası oluşturun
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

4. **Development modunda çalıştırın**
```bash
npm run dev
```
npm run electron çalışması için

## 📦 Build Alma

### Development Build
```bash
npm run build
```

### Production Build (Executable)
```bash
npm run dist
```

### Auto-publish ile Build
```bash
npm run publish
```

## 🎯 Kullanım

1. **Uygulamayı başlatın**
2. **Hesap oluşturun** veya giriş yapın
3. **Sunucu oluşturun** veya mevcut sunucuya katılın
4. **Kanallarda sohbet edin**
5. **Sesli/görüntülü sohbet başlatın**

## 🔧 Geliştirme

### Scripts
- `npm run dev` - Development modu
- `npm run build` - Production build
- `npm run electron` - Sadece Electron
- `npm run dist` - Executable oluştur
- `npm run publish` - GitHub release

### Proje Yapısı
```
nexus/
├── src/
│   ├── components/     # UI bileşenleri
│   ├── pages/         # Sayfa bileşenleri
│   ├── services/      # Firebase servisleri
│   ├── contexts/      # React Context'ler
│   └── types/         # TypeScript tipleri
├── electron/          # Electron main process
└── public/           # Statik dosyalar
```

## 🔐 Güvenlik

- Firebase Security Rules ile güvenli veritabanı
- Environment variables ile API key koruması
- Electron security best practices
- HTTPS zorunlu bağlantılar

## 📱 Platform Desteği

- ✅ Windows (x64, ia32)
- ✅ macOS (Intel, Apple Silicon)
- ✅ Linux (AppImage)

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje ISC lisansı altında lisanslanmıştır.

## 🆘 Destek

- **GitHub Issues**: [Issues](https://github.com/mustafadmrsy/Nexus/issues)
- **Discussions**: [Discussions](https://github.com/mustafadmrsy/Nexus/discussions)

## 🙏 Teşekkürler

- [Firebase](https://firebase.google.com/) - Backend servisleri
- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://reactjs.org/) - UI framework
- [Material-UI](https://mui.com/) - UI components

---

⭐ **Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!** 