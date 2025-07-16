# Firestore Database Schema

Bu belgede Nexus uygulaması için Firestore database yapısı açıklanmaktadır.

## Koleksiyonlar (Collections)

### 1. `users` Koleksiyonu
Kullanıcı bilgilerini saklar.

```typescript
Document ID: {userId}
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastSeen: Timestamp;
  status: 'online' | 'idle' | 'offline';
}
```

### 2. `servers` Koleksiyonu
Sunucu bilgilerini saklar.

```typescript
Document ID: {serverId}
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

### 3. `channels` Koleksiyonu
Kanal bilgilerini saklar.

```typescript
Document ID: {channelId}
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

### 4. `messages` Koleksiyonu
Mesajları saklar.

```typescript
Document ID: {messageId}
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

### 5. `serverMembers` Koleksiyonu
Sunucu üyeliklerini saklar.

```typescript
Document ID: {serverId}_{userId}
{
  userId: string;
  serverId: string;
  joinedAt: Timestamp;
  roles: string[];
  nickname?: string;
  permissions: ServerPermissions;
}
```

### 6. `friendships` Koleksiyonu
Arkadaşlıkları saklar.

```typescript
Document ID: {friendshipId}
{
  id: string;
  userId1: string;
  userId2: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
}
```

### 7. `directMessages` Koleksiyonu
Özel mesaj konuşmalarını saklar.

```typescript
Document ID: {dmId}
{
  id: string;
  participants: string[];
  lastMessage?: Message;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 8. `roles` Koleksiyonu
Sunucu rollerini saklar.

```typescript
Document ID: {roleId}
{
  id: string;
  serverId: string;
  name: string;
  color: string;
  permissions: ServerPermissions;
  position: number;
  mentionable: boolean;
  createdAt: Timestamp;
}
```

### 9. `voiceStates` Koleksiyonu
Sesli sohbet durumlarını saklar.

```typescript
Document ID: {userId}
{
  userId: string;
  channelId?: string;
  serverId?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSelfMuted: boolean;
  isSelfDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}
```

### 10. `notifications` Koleksiyonu
Bildirimleri saklar.

```typescript
Document ID: {notificationId}
{
  id: string;
  userId: string;
  type: 'mention' | 'message' | 'friend_request' | 'server_invite';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: Timestamp;
  data?: any;
}
```

## Composite Index'ler

Aşağıdaki composite index'ler Firebase Console'da oluşturulmalıdır:

### messages koleksiyonu için:
- `channelId` (ASC), `timestamp` (DESC)
- `authorId` (ASC), `timestamp` (DESC)

### serverMembers koleksiyonu için:
- `serverId` (ASC), `joinedAt` (ASC)
- `userId` (ASC), `serverId` (ASC)

### friendships koleksiyonu için:
- `userId1` (ASC), `status` (ASC)
- `userId2` (ASC), `status` (ASC)

### notifications koleksiyonu için:
- `userId` (ASC), `createdAt` (DESC)
- `userId` (ASC), `isRead` (ASC), `createdAt` (DESC)

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kullanıcılar sadece kendi verilerini okuyabilir/yazabilir
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Sunucu üyeleri sunucu verilerini okuyabilir
    match /servers/{serverId} {
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/serverMembers/$(serverId + '_' + request.auth.uid));
      allow write: if request.auth != null && 
        resource.data.ownerId == request.auth.uid;
    }
    
    // Kanal verileri sunucu üyeleri tarafından okunabilir
    match /channels/{channelId} {
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/serverMembers/$(resource.data.serverId + '_' + request.auth.uid));
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/serverMembers/$(resource.data.serverId + '_' + request.auth.uid));
    }
    
    // Mesajlar kanal üyeleri tarafından okunabilir/yazılabilir
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.authorId;
    }
    
    // Sunucu üyelikleri
    match /serverMembers/{membershipId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Arkadaşlıklar
    match /friendships/{friendshipId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId1 == request.auth.uid || resource.data.userId2 == request.auth.uid);
    }
    
    // Özel mesajlar
    match /directMessages/{dmId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Roller
    match /roles/{roleId} {
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/serverMembers/$(resource.data.serverId + '_' + request.auth.uid));
      allow write: if request.auth != null;
    }
    
    // Sesli sohbet durumları
    match /voiceStates/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Bildirimler
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Firebase Console Kurulumu

1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. Yeni proje oluşturun: "nexus-chat-app"
3. Authentication'ı etkinleştirin ve Email/Password provider'ını aktif edin
4. Firestore Database'i etkinleştirin (production mode)
5. Yukarıdaki security rules'ları ekleyin
6. Composite index'leri oluşturun
7. Firebase Config bilgilerini `src/services/firebase.ts` dosyasına ekleyin

## Örnek Veri Yapısı

```
nexus-chat-app/
├── users/
│   ├── user1_id/
│   └── user2_id/
├── servers/
│   ├── server1_id/
│   └── server2_id/
├── channels/
│   ├── channel1_id/
│   └── channel2_id/
├── messages/
│   ├── message1_id/
│   └── message2_id/
├── serverMembers/
│   ├── server1_id_user1_id/
│   └── server1_id_user2_id/
└── friendships/
    ├── friendship1_id/
    └── friendship2_id/
``` 