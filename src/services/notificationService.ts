import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'message' | 'server_invite' | 'mention' | 'system' | 'pending_member' | 'voice_channel_invite';
  title: string;
  message: string;
  timestamp: Date;
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
    inviteId?: string;
    roomId?: string;
    roomName?: string;
    [key: string]: any;
  };
}

// Kullanıcının bildirimlerini getir
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(notificationsQuery);
    
    const notifications: Notification[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as Notification);
    });
    
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

// Yeni bildirim oluştur
export const createNotification = async (notification: Omit<Notification, 'id' | 'timestamp'>): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  try {
    const notificationData = {
      ...notification,
      timestamp: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    
    return { success: true, notificationId: docRef.id };
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

// Bildirimi okundu olarak işaretle
export const markNotificationAsRead = async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

// Bildirimi okunmadı olarak işaretle
export const markNotificationAsUnread = async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: false,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error marking notification as unread:', error);
    return { success: false, error: error.message };
  }
};

// Tüm bildirimleri okundu olarak işaretle
export const markAllNotificationsAsRead = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(notificationsQuery);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    
    return { success: true };
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
};

// Bildirimi sil
export const deleteNotification = async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

// Tüm bildirimleri sil
export const deleteAllNotifications = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(notificationsQuery);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting all notifications:', error);
    return { success: false, error: error.message };
  }
};

// Okunmamış bildirim sayısını getir
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(notificationsQuery);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Bildirimleri real-time dinle
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc')
  );
  
  const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
    const notifications: Notification[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as Notification);
    });
    
    callback(notifications);
  }, (error) => {
    console.error('Error listening to notifications:', error);
    
    // Fallback: Sadece userId ile filtreleme (orderBy olmadan)
    const fallbackQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    
    const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
      const notifications: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as Notification);
      });
      
      // Manuel olarak sırala
      notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      callback(notifications);
    }, (fallbackError) => {
      console.error('Fallback notification listener also failed:', fallbackError);
      callback([]);
    });
    
    return fallbackUnsubscribe;
  });
  
  return unsubscribe;
};

// Arkadaş isteği bildirimi oluştur
export const createFriendRequestNotification = async (
  targetUserId: string,
  fromUserId: string,
  fromUserName: string
): Promise<{ success: boolean; error?: string }> => {
  return await createNotification({
    userId: targetUserId,
    type: 'friend_request',
    title: 'Arkadaş İsteği',
    message: `${fromUserName} size arkadaş isteği gönderdi`,
    read: false,
    data: {
      fromUserId,
      fromUserName,
    },
  });
};

// Mesaj bildirimi oluştur
export const createMessageNotification = async (
  targetUserId: string,
  fromUserId: string,
  fromUserName: string,
  channelName: string,
  messageContent: string
): Promise<{ success: boolean; error?: string }> => {
  return await createNotification({
    userId: targetUserId,
    type: 'message',
    title: 'Yeni Mesaj',
    message: `${fromUserName} ${channelName} kanalında mesaj gönderdi: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
    read: false,
    data: {
      fromUserId,
      fromUserName,
      channelName,
    },
  });
};

// Sunucu davet bildirimi oluştur
export const createServerInviteNotification = async (
  targetUserId: string,
  fromUserId: string,
  fromUserName: string,
  serverName: string,
  serverId: string
): Promise<{ success: boolean; error?: string }> => {
  return await createNotification({
    userId: targetUserId,
    type: 'server_invite',
    title: 'Sunucu Davetiyesi',
    message: `${fromUserName} sizi "${serverName}" sunucusuna davet etti`,
    read: false,
    data: {
      fromUserId,
      fromUserName,
      serverName,
      serverId,
    },
  });
};

// Bahsetme bildirimi oluştur
export const createMentionNotification = async (
  targetUserId: string,
  fromUserId: string,
  fromUserName: string,
  channelName: string,
  messageContent: string
): Promise<{ success: boolean; error?: string }> => {
  return await createNotification({
    userId: targetUserId,
    type: 'mention',
    title: 'Bahsedildiniz',
    message: `${fromUserName} sizi ${channelName} kanalında bahsetti: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
    read: false,
    data: {
      fromUserId,
      fromUserName,
      channelName,
    },
  });
}; 

// Pending üye bildirimi oluştur
export const createPendingMemberNotification = async (
  serverId: string,
  serverName: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Sunucu yöneticilerini bul
    const adminQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('status', '==', 'active')
    );
    
    const adminSnapshot = await getDocs(adminQuery);
    const adminIds: string[] = [];
    
    for (const doc of adminSnapshot.docs) {
      const memberData = doc.data();
      const roles = memberData.roles || [];
      
      // Owner, admin veya üye yönetimi yetkisi olanları bul
      if (roles.includes('owner') || roles.includes('admin') || 
          (memberData.permissions && memberData.permissions.canKickMembers)) {
        adminIds.push(memberData.userId);
      }
    }
    
    // Her yöneticiye bildirim gönder
    const notificationPromises = adminIds.map(adminId => 
      addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'pending_member',
        title: 'Yeni Üye Onayı',
        message: `${userName} "${serverName}" sunucusuna katılmak istiyor`,
        data: {
          serverId,
          serverName,
          pendingUserId: userId,
          pendingUserName: userName
        },
        createdAt: Timestamp.now(),
        read: false
      })
    );
    
    await Promise.all(notificationPromises);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error creating pending member notification:', error);
    return { success: false, error: error.message };
  }
}; 