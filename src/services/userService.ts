import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Server, ServerMember, Friendship, DirectMessage, User } from '../types';

// Kullanıcının sunucularını getir
export const getUserServers = async (userId: string): Promise<Server[]> => {
  try {
    // Kullanıcının üye olduğu sunucuları bul
    const membershipQuery = query(
      collection(db, 'serverMembers'),
      where('userId', '==', userId)
    );
    
    const membershipSnapshot = await getDocs(membershipQuery);
    const serverIds = membershipSnapshot.docs.map(doc => doc.data().serverId);
    
    if (serverIds.length === 0) return [];
    
    // Sunucu bilgilerini getir
    const servers: Server[] = [];
    for (const serverId of serverIds) {
      const serverDoc = await getDoc(doc(db, 'servers', serverId));
      if (serverDoc.exists()) {
        servers.push({ id: serverDoc.id, ...serverDoc.data() } as Server);
      }
    }
    
    return servers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching user servers:', error);
    return [];
  }
};

// Kullanıcının arkadaşlarını getir
export const getUserFriends = async (userId: string): Promise<User[]> => {
  try {
    // Kabul edilmiş arkadaşlıkları bul
    const friendshipsQuery1 = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId),
      where('status', '==', 'accepted')
    );
    
    const friendshipsQuery2 = query(
      collection(db, 'friendships'),
      where('userId2', '==', userId),
      where('status', '==', 'accepted')
    );
    
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(friendshipsQuery1),
      getDocs(friendshipsQuery2)
    ]);
    
    const friendIds = new Set<string>();
    
    snapshot1.docs.forEach(doc => {
      friendIds.add(doc.data().userId2);
    });
    
    snapshot2.docs.forEach(doc => {
      friendIds.add(doc.data().userId1);
    });
    
    // Arkadaş bilgilerini getir
    const friends: User[] = [];
    for (const friendId of friendIds) {
      const userDoc = await getDoc(doc(db, 'users', friendId));
      if (userDoc.exists()) {
        friends.push({ uid: userDoc.id, ...userDoc.data() } as User);
      }
    }
    
    return friends.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (error) {
    console.error('Error fetching user friends:', error);
    return [];
  }
};

// Kullanıcının DM'lerini getir
export const getUserDirectMessages = async (userId: string): Promise<DirectMessage[]> => {
  try {
    const dmQuery = query(
      collection(db, 'directMessages'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const dmSnapshot = await getDocs(dmQuery);
    
    const directMessages: DirectMessage[] = [];
    for (const dmDoc of dmSnapshot.docs) {
      const dmData = dmDoc.data();
      
      // Bu kullanıcı için gizlenmişse atlat
      const hiddenFor = dmData.hiddenFor || [];
      if (hiddenFor.includes(userId)) {
        continue;
      }
      
      directMessages.push({
        id: dmDoc.id,
        ...dmData,
        createdAt: dmData.createdAt?.toDate() || new Date(),
        updatedAt: dmData.updatedAt?.toDate() || new Date(),
      } as DirectMessage);
    }
    
    return directMessages;
  } catch (error) {
    console.error('Error fetching user DMs:', error);
    
    // Fallback: Sadece participants ile filtreleme yap (orderBy olmadan)
    try {
      const fallbackQuery = query(
        collection(db, 'directMessages'),
        where('participants', 'array-contains', userId)
      );
      
      const fallbackSnapshot = await getDocs(fallbackQuery);
      const directMessages: DirectMessage[] = [];
      
      for (const dmDoc of fallbackSnapshot.docs) {
        const dmData = dmDoc.data();
        
        // Bu kullanıcı için gizlenmişse atlat
        const hiddenFor = dmData.hiddenFor || [];
        if (hiddenFor.includes(userId)) {
          continue;
        }
        
        directMessages.push({
          id: dmDoc.id,
          ...dmData,
          createdAt: dmData.createdAt?.toDate() || new Date(),
          updatedAt: dmData.updatedAt?.toDate() || new Date(),
        } as DirectMessage);
      }
      
      // Manuel olarak sırala
      return directMessages.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
    return [];
    }
  }
};

// Yeni sunucu oluştur
export const createServer = async (
  serverName: string, 
  description: string = '', 
  userId: string, 
  serverSettings?: {
    isPrivate?: boolean;
    requireApproval?: boolean;
    serverType?: 'community' | 'private' | 'gaming';
    maxMembers?: number;
  }
): Promise<{ success: boolean; serverId?: string; error?: string }> => {
  try {
    // Sunucu oluştur
    const serverData = {
      name: serverName,
      description: description || '',
      ownerId: userId,
      createdAt: Timestamp.now(),
      memberCount: 1,
      isPublic: serverSettings?.serverType === 'community',
      isPrivate: serverSettings?.isPrivate ?? true,
      requireApproval: serverSettings?.requireApproval ?? false,
      serverType: serverSettings?.serverType || 'private',
      maxMembers: serverSettings?.maxMembers || 100,
      inviteCode: generateInviteCode(),
    };
    
    const serverDoc = await addDoc(collection(db, 'servers'), serverData);
    
    // Varsayılan kanallar oluştur
    await createDefaultChannels(serverDoc.id, userId);
    
    // Sunucu sahibini üye olarak ekle
    await addDoc(collection(db, 'serverMembers'), {
      userId,
      serverId: serverDoc.id,
      joinedAt: Timestamp.now(),
      roles: ['owner'],
      permissions: {
        canManageServer: true,
        canManageChannels: true,
        canManageRoles: true,
        canKickMembers: true,
        canBanMembers: true,
        canCreateInvites: true,
        canManageMessages: true,
        canMentionEveryone: true,
        canUseVoiceActivity: true,
        canSpeak: true,
        canMuteMembers: true,
        canDeafenMembers: true,
        canMoveMembers: true,
      }
    });
    
    return { success: true, serverId: serverDoc.id };
  } catch (error: any) {
    console.error('Error creating server:', error);
    return { success: false, error: error.message };
  }
};

// Varsayılan kanalları oluştur
const createDefaultChannels = async (serverId: string, userId: string) => {
  const defaultChannels = [
    { name: 'genel', type: 'text', description: 'Genel sohbet kanalı' },
    { name: 'duyurular', type: 'text', description: 'Duyuru kanalı' },
    { name: 'Genel Ses', type: 'voice', description: 'Genel ses kanalı' },
  ];
  
  for (let i = 0; i < defaultChannels.length; i++) {
    const channel = defaultChannels[i];
    await addDoc(collection(db, 'channels'), {
      serverId,
      name: channel.name,
      type: channel.type,
      description: channel.description,
      createdAt: Timestamp.now(),
      createdBy: userId,
      position: i,
    });
  }
};

// Davet kodu oluştur
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Arkadaş ekleme isteği gönder
export const sendFriendRequest = async (userId: string, friendEmail: string, userName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // E-posta ile kullanıcı bul
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', friendEmail)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    
    if (usersSnapshot.empty) {
      return { success: false, error: 'Kullanıcı bulunamadı' };
    }
    
    const friendDoc = usersSnapshot.docs[0];
    const friendId = friendDoc.id;
    
    if (friendId === userId) {
      return { success: false, error: 'Kendinizi arkadaş olarak ekleyemezsiniz' };
    }
    
    // Mevcut arkadaşlık kontrolü
    const existingFriendshipQuery1 = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId),
      where('userId2', '==', friendId)
    );
    
    const existingFriendshipQuery2 = query(
      collection(db, 'friendships'),
      where('userId1', '==', friendId),
      where('userId2', '==', userId)
    );
    
    const [existing1, existing2] = await Promise.all([
      getDocs(existingFriendshipQuery1),
      getDocs(existingFriendshipQuery2)
    ]);
    
    if (!existing1.empty || !existing2.empty) {
      return { success: false, error: 'Arkadaşlık zaten mevcut' };
    }
    
    // Arkadaşlık isteği oluştur
    const friendshipDoc = await addDoc(collection(db, 'friendships'), {
      userId1: userId,
      userId2: friendId,
      status: 'pending',
      createdAt: Timestamp.now(),
      initiatorId: userId
    });

    // Bildirim oluştur
    await addDoc(collection(db, 'notifications'), {
      userId: friendId,
      type: 'friend_request',
      title: 'Arkadaş İsteği',
      message: `${userName} size arkadaş isteği gönderdi`,
      timestamp: Timestamp.now(),
      read: false,
      data: {
        fromUserId: userId,
        fromUserName: userName,
        friendshipId: friendshipDoc.id,
      }
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error sending friend request:', error);
    return { success: false, error: error.message };
  }
};

// Gelen arkadaş isteklerini getir
export const getIncomingFriendRequests = async (userId: string): Promise<any[]> => {
  try {
    const requestsQuery = query(
      collection(db, 'friendships'),
      where('userId2', '==', userId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(requestsQuery);
    const requests: any[] = [];
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      // Gönderen kullanıcının bilgilerini al
      const senderDoc = await getDoc(doc(db, 'users', data.userId1));
      const senderData = senderDoc.data();
      
      if (senderData) {
        requests.push({
          id: docSnapshot.id,
          fromUserId: data.userId1,
          fromUserName: senderData.displayName,
          fromUserEmail: senderData.email,
          fromUserPhotoURL: senderData.photoURL,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      }
    }
    
    return requests;
  } catch (error) {
    console.error('Error getting incoming friend requests:', error);
    return [];
  }
};

// Gönderilen arkadaş isteklerini getir
export const getOutgoingFriendRequests = async (userId: string): Promise<any[]> => {
  try {
    const requestsQuery = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(requestsQuery);
    const requests: any[] = [];
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      // Alıcının bilgilerini al
      const receiverDoc = await getDoc(doc(db, 'users', data.userId2));
      const receiverData = receiverDoc.data();
      
      if (receiverData) {
        requests.push({
          id: docSnapshot.id,
          toUserId: data.userId2,
          toUserName: receiverData.displayName,
          toUserEmail: receiverData.email,
          toUserPhotoURL: receiverData.photoURL,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      }
    }
    
    return requests;
  } catch (error) {
    console.error('Error getting outgoing friend requests:', error);
    return [];
  }
};

// Arkadaş isteğini kabul et
export const acceptFriendRequest = async (friendshipId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const friendshipRef = doc(db, 'friendships', friendshipId);
    await updateDoc(friendshipRef, {
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error accepting friend request:', error);
    return { success: false, error: error.message };
  }
};

// Arkadaş isteğini reddet
export const declineFriendRequest = async (friendshipId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
    return { success: true };
  } catch (error: any) {
    console.error('Error declining friend request:', error);
    return { success: false, error: error.message };
  }
};

// DM konuşması oluştur veya getir
export const getOrCreateDirectMessage = async (userId: string, friendId: string): Promise<{ success: boolean; dmId?: string; error?: string }> => {
  try {
    // Mevcut DM kontrolü
    const existingDMQuery = query(
      collection(db, 'directMessages'),
      where('participants', 'array-contains', userId)
    );
    
    const dmSnapshot = await getDocs(existingDMQuery);
    
    for (const dmDoc of dmSnapshot.docs) {
      const participants = dmDoc.data().participants;
      if (participants.includes(friendId) && participants.length === 2) {
        return { success: true, dmId: dmDoc.id };
      }
    }
    
    // Yeni DM oluştur
    const dmDoc = await addDoc(collection(db, 'directMessages'), {
      participants: [userId, friendId],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return { success: true, dmId: dmDoc.id };
  } catch (error: any) {
    console.error('Error creating DM:', error);
    return { success: false, error: error.message };
  }
};

// DM konuşmasını sil (sadece kullanıcının kendisinden)
export const deleteDirectMessage = async (dmId: string, userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // DM'in varlığını kontrol et
    const dmDoc = await getDoc(doc(db, 'directMessages', dmId));
    if (!dmDoc.exists()) {
      return { success: false, error: 'DM bulunamadı' };
    }

    // Kullanıcının bu DM'de olup olmadığını kontrol et
    const dmData = dmDoc.data();
    if (!dmData.participants.includes(userId)) {
      return { success: false, error: 'Bu konuşmayı silme yetkiniz yok' };
    }

    // hiddenFor alanını güncelle - bu kullanıcı için DM'i gizle
    const hiddenFor = dmData.hiddenFor || [];
    if (!hiddenFor.includes(userId)) {
      await updateDoc(doc(db, 'directMessages', dmId), {
        hiddenFor: [...hiddenFor, userId]
      });
    }

    // Eğer tüm participants DM'i gizlediyse, o zaman gerçekten sil
    const allParticipants = dmData.participants;
    const updatedHiddenFor = [...hiddenFor, userId];
    
    if (allParticipants.every((participant: string) => updatedHiddenFor.includes(participant))) {
      // DM'deki tüm mesajları sil
      const messagesQuery = query(
        collection(db, 'dmMessages'),
        where('dmId', '==', dmId)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      const deletePromises = messagesSnapshot.docs.map(messageDoc => deleteDoc(messageDoc.ref));
      await Promise.all(deletePromises);

      // DM'i sil
      await deleteDoc(doc(db, 'directMessages', dmId));
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting DM:', error);
    return { success: false, error: error.message };
  }
};

// Arkadaşlığı sil
export const deleteFriendship = async (userId: string, friendId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Her iki durumu da kontrol et
    const friendshipQuery1 = query(
      collection(db, 'friendships'),
      where('userId1', '==', userId),
      where('userId2', '==', friendId)
    );
    
    const friendshipQuery2 = query(
      collection(db, 'friendships'),
      where('userId1', '==', friendId),
      where('userId2', '==', userId)
    );
    
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(friendshipQuery1),
      getDocs(friendshipQuery2)
    ]);
    
    // Arkadaşlık belgesini sil
    const deletePromises: Promise<void>[] = [];
    
    snapshot1.docs.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    snapshot2.docs.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    await Promise.all(deletePromises);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting friendship:', error);
    return { success: false, error: error.message };
  }
}; 