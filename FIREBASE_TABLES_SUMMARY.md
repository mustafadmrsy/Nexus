# Firebase Firestore Koleksiyonları - Şu Ana Kadar Yapılan Sistemler

## 🔥 Mevcut Firebase Koleksiyonları

### 1. **users** Koleksiyonu ✅
**Açıklama**: Kullanıcı bilgileri ve profil verileri
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  createdAt: Timestamp;
  lastSeen: Timestamp;
  status: 'online' | 'idle' | 'offline';
  updatedAt?: Timestamp;
}
```

### 2. **notifications** Koleksiyonu ✅
**Açıklama**: Kullanıcı bildirimleri (arkadaş istekleri, mesajlar, bahsedilmeler)
```typescript
{
  id: string;
  userId: string;
  type: 'friend_request' | 'message' | 'server_invite' | 'mention' | 'system';
  title: string;
  message: string;
  timestamp: Timestamp;
  read: boolean;
  data?: {
    fromUserId?: string;
    fromUserName?: string;
    serverId?: string;
    serverName?: string;
    channelId?: string;
    channelName?: string;
    messageId?: string;
    friendshipId?: string;
  };
}
```

### 3. **friendships** Koleksiyonu ✅
**Açıklama**: Arkadaşlık istekleri ve durumları
```typescript
{
  id: string;
  userId1: string;
  userId2: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  initiatorId: string;
  blockedAt?: Timestamp;
  blockedBy?: string;
}
```

### 4. **servers** Koleksiyonu ✅
**Açıklama**: Discord benzeri sunucu bilgileri
```typescript
{
  id: string;
  name: string;
  description?: string;
  iconURL?: string;
  ownerId: string;
  createdAt: Timestamp;
  memberCount: number;
  isPublic: boolean;
  inviteCode?: string;
}
```

### 5. **channels** Koleksiyonu ✅
**Açıklama**: Sunucu kanalları (metin, ses, oyun)
```typescript
{
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice' | 'game';
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
  position: number;
  permissions?: ChannelPermissions;
}
```

### 6. **messages** Koleksiyonu ✅
**Açıklama**: Kanal mesajları ve özel mesajlar
```typescript
{
  id: string;
  channelId: string;
  serverId?: string;
  authorId: string;
  content: string;
  attachments?: MessageAttachment[];
  timestamp: Timestamp;
  editedAt?: Timestamp;
  replyTo?: string;
  reactions?: MessageReaction[];
  mentions?: string[];
}
```

### 7. **serverMembers** Koleksiyonu ✅
**Açıklama**: Sunucu üyelikleri ve rolleri
```typescript
{
  userId: string;
  serverId: string;
  joinedAt: Timestamp;
  roles: string[];
  nickname?: string;
  permissions: ServerPermissions;
}
```

### 8. **directMessages** Koleksiyonu ✅
**Açıklama**: Özel mesaj konuşmaları
```typescript
{
  id: string;
  participants: string[];
  lastMessage?: Message;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 🎯 Yapılan Sistemler ve Kullandığı Koleksiyonlar

### ✅ Kimlik Doğrulama Sistemi
- **users** → Kullanıcı profilleri
- **Firebase Auth** → E-posta doğrulama

### ✅ Profil Sistemi
- **users** → Profil bilgileri
- **Firebase Storage** → Profil fotoğrafları (`/profile-photos/`)

### ✅ Bildirim Sistemi
- **notifications** → Bildirim kayıtları
- **notificationService.ts** → CRUD işlemleri

### ✅ Arkadaşlık Sistemi
- **friendships** → Arkadaş istekleri/durumları
- **notifications** → Arkadaş isteği bildirimleri
- **friendshipService.ts** → Arkadaş ekleme/çıkarma

### ✅ Sunucu Sistemi
- **servers** → Sunucu bilgileri
- **serverMembers** → Üyelikler
- **channels** → Sunucu kanalları

### ✅ Mesajlaşma Sistemi
- **messages** → Kanal mesajları
- **directMessages** → Özel mesajlar

### ✅ Tema Sistemi
- **LocalStorage** → Tema tercihi (dark/light)
- **ThemeContext** → Uygulama geneli tema yönetimi

---

## 🚀 Firebase Console Kurulum Adımları

### 1. Firebase Projesi
- Proje ID: `nexus-6782c`
- URL: `https://nexus-6782c.firebaseapp.com`

### 2. Authentication
- Email/Password provider aktif
- E-posta doğrulama aktif

### 3. Firestore Database
- Production mode
- Güvenlik kuralları: authenticated users

### 4. Storage
- `/profile-photos/` → Profil fotoğrafları
- `/message-attachments/` → Mesaj ekleri
- `/server-icons/` → Sunucu simgeleri

### 5. Composite Index'ler
```javascript
// notifications koleksiyonu
userId ASC, timestamp DESC
userId ASC, read ASC, timestamp DESC

// messages koleksiyonu
channelId ASC, timestamp DESC
authorId ASC, timestamp DESC

// friendships koleksiyonu
userId1 ASC, status ASC
userId2 ASC, status ASC

// serverMembers koleksiyonu
serverId ASC, joinedAt ASC
userId ASC, serverId ASC
```

---

## 📊 Veri Akışı Örnekleri

### Arkadaş Ekleme
1. `friendships` → pending durumu
2. `notifications` → hedef kullanıcıya bildirim
3. Kabul edilince `friendships` → accepted

### Mesaj Gönderme
1. `messages` → mesaj kaydı
2. `directMessages` → konuşma güncelleme
3. `notifications` → bahsedilenlere bildirim

### Profil Güncelleme
1. `users` → profil bilgileri
2. `Firebase Storage` → fotoğraf yükleme
3. `Firebase Auth` → displayName/photoURL

---

## 🔑 Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    match /friendships/{friendshipId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId1 == request.auth.uid || resource.data.userId2 == request.auth.uid);
    }
    
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

Bu yapı ile Discord benzeri tam fonksiyonlu bir chat uygulaması için gerekli tüm Firebase koleksiyonları hazır durumda! 🎉 