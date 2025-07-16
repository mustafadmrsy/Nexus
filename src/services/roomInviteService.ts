import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { checkUserPermissions } from './serverService';
import { createNotification } from './notificationService';
import { joinRoom, getUserCurrentRoom } from './roomService';

export interface RoomInvite {
  id: string;
  roomId: string;
  serverId: string;
  roomName: string;
  serverName: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhotoURL?: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  message?: string;
  roomPassword?: string;
  roomType?: string;
  isPrivate?: boolean;
  hasConnectPermission?: boolean;
  bypassPermissions?: boolean;
}

// Sesli odaya davet gönder
export const sendVoiceChannelInvite = async (
  roomId: string,
  serverId: string,
  fromUserId: string,
  toUserId: string,
  message?: string
): Promise<{ success: boolean; inviteId?: string; error?: string }> => {
  try {
    // Davet gönderen kişinin izinlerini kontrol et
    const permissions = await checkUserPermissions(serverId, fromUserId);
    if (!permissions.canMoveMembers) {
      return { success: false, error: 'Üyeleri sesli kanala davet etme izniniz yok.' };
    }

    // Oda bilgilerini al
    const roomDoc = await getDoc(doc(db, 'rooms', roomId));
    if (!roomDoc.exists()) {
      return { success: false, error: 'Oda bulunamadı.' };
    }

    const roomData = roomDoc.data();
    
    // Sunucu bilgilerini al
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    if (!serverDoc.exists()) {
      return { success: false, error: 'Sunucu bulunamadı.' };
    }

    const serverData = serverDoc.data();

    // Davet gönderen kişinin bilgilerini al
    const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
    if (!fromUserDoc.exists()) {
      return { success: false, error: 'Davet gönderen kullanıcı bulunamadı.' };
    }

    const fromUserData = fromUserDoc.data();

    // Davet edilecek kişinin bilgilerini al
    const toUserDoc = await getDoc(doc(db, 'users', toUserId));
    if (!toUserDoc.exists()) {
      return { success: false, error: 'Davet edilecek kullanıcı bulunamadı.' };
    }

    // Davet edilecek kişi çevrimiçi mi kontrol et
    const toUserData = toUserDoc.data();
    if (toUserData.status === 'offline') {
      return { success: false, error: 'Kullanıcı çevrimdışı, davet gönderilemiyor.' };
    }

    // Davet edilecek kişinin sunucuda üye olup olmadığını kontrol et
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', toUserId),
      where('status', '==', 'active')
    );
    const memberSnapshot = await getDocs(memberQuery);
    
    if (memberSnapshot.empty) {
      return { success: false, error: 'Kullanıcı bu sunucuda üye değil.' };
    }

    // Davet edilecek kişinin ses kanalına bağlanma izni var mı kontrol et
    // NOT: Davet kabul edilirse yetki kontrolü bypass edilir
    const toUserPermissions = await checkUserPermissions(serverId, toUserId);
    const hasConnectPermission = toUserPermissions.canConnect;

    // Oda dolu mu kontrol et
    if (roomData.currentUsers && roomData.currentUsers.length >= roomData.maxUsers) {
      return { success: false, error: 'Oda dolu, davet gönderilemiyor.' };
    }

    // Kullanıcı zaten odada mı kontrol et
    if (roomData.currentUsers && roomData.currentUsers.includes(toUserId)) {
      return { success: false, error: 'Kullanıcı zaten bu odada.' };
    }

    // Mevcut bekleyen davet var mı kontrol et
    const existingInviteQuery = query(
      collection(db, 'roomInvites'),
      where('roomId', '==', roomId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    const existingInviteSnapshot = await getDocs(existingInviteQuery);
    
    if (!existingInviteSnapshot.empty) {
      return { success: false, error: 'Kullanıcıya zaten bekleyen bir davet var.' };
    }

    // Davet oluştur
    const inviteData = {
      roomId,
      serverId,
      roomName: roomData.name,
      serverName: serverData.name,
      fromUserId,
      fromUserName: fromUserData.displayName,
      fromUserPhotoURL: fromUserData.photoURL || '',
      toUserId,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)), // 5 dakika
      message: message || '',
      roomPassword: roomData.password || null, // Şifreli oda için şifre
      roomType: roomData.type || 'voice',
      isPrivate: roomData.isPrivate || false,
      hasConnectPermission, // Kullanıcının normal izni var mı
      bypassPermissions: true // Davet kabul edilirse izin bypass edilir
    };

    const inviteDoc = await addDoc(collection(db, 'roomInvites'), inviteData);

    // Bildirim gönder
    const notificationMessage = roomData.password 
      ? `${fromUserData.displayName} sizi "${roomData.name}" şifreli sesli kanalına davet etti`
      : `${fromUserData.displayName} sizi "${roomData.name}" sesli kanalına davet etti`;
    
    await createNotification({
      userId: toUserId,
      type: 'voice_channel_invite' as any,
      title: 'Sesli Kanal Davetiyesi',
      message: notificationMessage,
      read: false,
      data: {
        inviteId: inviteDoc.id,
        roomId,
        serverId,
        roomName: roomData.name,
        serverName: serverData.name,
        fromUserId,
        fromUserName: fromUserData.displayName,
        fromUserPhotoURL: fromUserData.photoURL || '',
        message: message || '',
        roomPassword: roomData.password || null,
        roomType: roomData.type || 'voice',
        isPrivate: roomData.isPrivate || false,
        hasConnectPermission,
        bypassPermissions: true
      }
    });

    return { success: true, inviteId: inviteDoc.id };
  } catch (error: any) {
    console.error('Error sending voice channel invite:', error);
    return { success: false, error: error.message };
  }
};

// Sesli kanal davetini kabul et
export const acceptVoiceChannelInvite = async (
  inviteId: string,
  userId: string,
  roomPassword?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Davet bilgilerini al
    const inviteDoc = await getDoc(doc(db, 'roomInvites', inviteId));
    if (!inviteDoc.exists()) {
      return { success: false, error: 'Davet bulunamadı.' };
    }

    const inviteData = inviteDoc.data();
    
    // Davet geçerli mi kontrol et
    if (inviteData.status !== 'pending') {
      return { success: false, error: 'Bu davet artık geçerli değil.' };
    }

    if (inviteData.toUserId !== userId) {
      return { success: false, error: 'Bu davet size gönderilmemiş.' };
    }

    // Davet süresi dolmuş mu kontrol et
    if (inviteData.expiresAt.toDate() < new Date()) {
      await updateDoc(inviteDoc.ref, { status: 'expired' });
      return { success: false, error: 'Davet süresi dolmuş.' };
    }

    // Kullanıcının mevcut odasını kontrol et
    const currentRoomResult = await getUserCurrentRoom(userId);
    
    // Mevcut odasından çık (varsa)
    if (currentRoomResult.success && currentRoomResult.data) {
      const { leaveRoom } = await import('./roomService');
      await leaveRoom(currentRoomResult.data.id, userId);
    }

    // Yeni odaya katıl (Davet kabul ederse izin kontrolü bypass edilir)
    const roomPasswordToUse = roomPassword || inviteData.roomPassword;
    const joinResult = await joinRoom(inviteData.roomId, userId, roomPasswordToUse, true); // true = bypass permissions
    
    if (!joinResult.success) {
      return { success: false, error: joinResult.error };
    }

    // Davet durumunu güncelle
    await updateDoc(inviteDoc.ref, {
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error accepting voice channel invite:', error);
    return { success: false, error: error.message };
  }
};

// Sesli kanal davetini reddet
export const declineVoiceChannelInvite = async (
  inviteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Davet bilgilerini al
    const inviteDoc = await getDoc(doc(db, 'roomInvites', inviteId));
    if (!inviteDoc.exists()) {
      return { success: false, error: 'Davet bulunamadı.' };
    }

    const inviteData = inviteDoc.data();
    
    // Davet geçerli mi kontrol et
    if (inviteData.status !== 'pending') {
      return { success: false, error: 'Bu davet artık geçerli değil.' };
    }

    if (inviteData.toUserId !== userId) {
      return { success: false, error: 'Bu davet size gönderilmemiş.' };
    }

    // Davet durumunu güncelle
    await updateDoc(inviteDoc.ref, {
      status: 'declined',
      declinedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error declining voice channel invite:', error);
    return { success: false, error: error.message };
  }
};

// Kullanıcının bekleyen davetlerini getir
export const getPendingInvites = async (userId: string): Promise<RoomInvite[]> => {
  try {
    const invitesQuery = query(
      collection(db, 'roomInvites'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(invitesQuery);
    const invites: RoomInvite[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Süresi dolmuş davetleri filtrele
      if (data.expiresAt.toDate() > new Date()) {
        invites.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          expiresAt: data.expiresAt.toDate()
        } as RoomInvite);
      }
    });
    
    return invites;
  } catch (error) {
    console.error('Error getting pending invites:', error);
    return [];
  }
};

// Süresi dolmuş davetleri temizle
export const cleanupExpiredInvites = async (): Promise<void> => {
  try {
    const expiredInvitesQuery = query(
      collection(db, 'roomInvites'),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(expiredInvitesQuery);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.expiresAt.toDate() < new Date()) {
        batch.update(doc.ref, { status: 'expired' });
      }
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error cleaning up expired invites:', error);
  }
};

// Davet durumunu dinle
export const subscribeToInviteStatus = (
  inviteId: string,
  callback: (invite: RoomInvite | null) => void
): (() => void) => {
  const inviteDoc = doc(db, 'roomInvites', inviteId);
  
  return onSnapshot(inviteDoc, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback({
        id: snapshot.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        expiresAt: data.expiresAt.toDate()
      } as RoomInvite);
    } else {
      callback(null);
    }
  });
}; 