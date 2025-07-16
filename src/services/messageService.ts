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
  limit,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { createNotification } from './notificationService';
import { checkUserPermissions } from './serverService';

export interface Message {
  id: string;
  channelId?: string;
  serverId?: string;
  roomId?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  content: string;
  attachments?: MessageAttachment[];
  timestamp: Date;
  editedAt?: Date;
  replyTo?: string;
  reactions?: MessageReaction[];
  mentions?: string[];
  roleMentions?: string[]; // Bahsedilen rol ID'leri
  type: 'text' | 'system';
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

// DM kanalındaki mesajları real-time dinle
export const subscribeToChannelMessages = (
  channelId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  const messagesQuery = query(
    collection(db, 'messages'),
    where('channelId', '==', channelId),
    orderBy('timestamp', 'asc'),
    limit(100) // Son 100 mesaj
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: Message[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
        editedAt: data.editedAt?.toDate(),
      } as Message);
    });

    callback(messages);
  }, (error) => {
    console.error('Error listening to messages:', error);
    
    // Fallback: Sadece channelId ile filtreleme (orderBy olmadan)
    const fallbackQuery = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId),
      limit(100)
    );
    
    return onSnapshot(fallbackQuery, (snapshot) => {
      const messages: Message[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          editedAt: data.editedAt?.toDate(),
        } as Message);
      });

      // Manuel olarak sırala
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      callback(messages);
    }, (fallbackError) => {
      console.error('Fallback message listener also failed:', fallbackError);
      callback([]);
    });
  });
};

// DM mesajlarını real-time dinle
export const subscribeToDMMessages = (
  dmId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  const messagesQuery = query(
    collection(db, 'dmMessages'),
    where('dmId', '==', dmId),
    orderBy('timestamp', 'asc'),
    limit(100) // Son 100 mesaj
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: Message[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        channelId: data.dmId, // DM için channelId yerine dmId kullan
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
        editedAt: data.editedAt?.toDate(),
      } as Message);
    });

    callback(messages);
  }, (error) => {
    console.error('Error listening to DM messages:', error);
    
    // Fallback: Sadece dmId ile filtreleme (orderBy olmadan)
    const fallbackQuery = query(
      collection(db, 'dmMessages'),
      where('dmId', '==', dmId),
      limit(100)
    );
    
    return onSnapshot(fallbackQuery, (snapshot) => {
      const messages: Message[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          channelId: data.dmId, // DM için channelId yerine dmId kullan
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          editedAt: data.editedAt?.toDate(),
        } as Message);
      });

      // Manuel olarak sırala
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      callback(messages);
    }, (fallbackError) => {
      console.error('Fallback DM message listener also failed:', fallbackError);
    callback([]);
    });
  });
};

// Mesaj gönder
export const sendMessage = async (
  channelId: string,
  authorId: string,
  authorName: string,
  content: string,
  serverId?: string,
  authorPhotoURL?: string,
  replyTo?: string,
  attachments?: MessageAttachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return { success: false, error: 'Mesaj boş olamaz' };
    }

    // Sunucu mesajı için izin kontrolü
    if (serverId) {
      const permissions = await checkUserPermissions(serverId, authorId);
      if (!permissions.canSendMessages) {
        return { success: false, error: 'Mesaj gönderme izniniz yok.' };
      }
      
      if (attachments && attachments.length > 0 && !permissions.canAttachFiles) {
        return { success: false, error: 'Dosya ekleme izniniz yok.' };
      }
      
          if (content.includes('@everyone') && !permissions.canMentionEveryone) {
      return { success: false, error: '@everyone kullanma izniniz yok.' };
    }

    // @everyone bildirimi gönder
    if (content.includes('@everyone')) {
      await sendEveryoneNotification(serverId, authorId, authorName, content);
    }

      // @everyone bildirimi gönder
      if (content.includes('@everyone')) {
        await sendEveryoneNotification(serverId, authorId, authorName, content);
      }
    }

    // Bahsedilen kullanıcıları ve rolleri bul
    const mentions = extractMentions(content);
    const roleMentions = extractRoleMentions(content);

    const messageData = {
      channelId,
      serverId,
      authorId,
      authorName,
      authorPhotoURL: authorPhotoURL || null,
      content: content.trim(),
      attachments: attachments || [],
      timestamp: Timestamp.now(),
      replyTo: replyTo || null,
      mentions,
      roleMentions,
      reactions: [],
      type: 'text'
    };

    const messageDoc = await addDoc(collection(db, 'messages'), messageData);

    // DM konuşmasının son mesajını güncelle
    if (!serverId) {
      const lastMessageData = {
        id: messageDoc.id,
        content: messageData.content,
        authorId: messageData.authorId,
        authorName: messageData.authorName,
        timestamp: new Date()
      };
      await updateDirectMessageLastMessage(channelId, lastMessageData);
    }

    // Bildirim gönder (DM için)
    if (!serverId) {
      await sendDMNotification(channelId, authorId, authorName, content);
    } else {
      // Sunucu mesajı için rol bahsetme bildirimlerini gönder
      await sendRoleMentionNotifications(serverId, roleMentions, authorId, authorName, content);
    }

    return { success: true, messageId: messageDoc.id };
  } catch (error: any) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
};

// DM mesajı gönder
export const sendDMMessage = async (
  dmId: string,
  authorId: string,
  authorName: string,
  content: string,
  authorPhotoURL?: string,
  replyTo?: string,
  attachments?: MessageAttachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return { success: false, error: 'Mesaj boş olamaz' };
    }

    // Bahsedilen kullanıcıları bul
    const mentions = extractMentions(content);

    const messageData = {
      dmId,
      authorId,
      authorName,
      authorPhotoURL: authorPhotoURL || null,
      content: content.trim(),
      attachments: attachments || [],
      timestamp: Timestamp.now(),
      replyTo: replyTo || null,
      mentions,
      reactions: [],
      type: 'text'
    };

    const messageDoc = await addDoc(collection(db, 'dmMessages'), messageData);

    // DM konuşmasının son mesajını güncelle
    const lastMessageData = {
      id: messageDoc.id,
      content: messageData.content,
      authorId: messageData.authorId,
      authorName: messageData.authorName,
      timestamp: new Date()
    };
    await updateDirectMessageLastMessage(dmId, lastMessageData);

    // Bildirim gönder
    await sendDMNotification(dmId, authorId, authorName, content);

    return { success: true, messageId: messageDoc.id };
  } catch (error: any) {
    console.error('Error sending DM message:', error);
    return { success: false, error: error.message };
  }
};

// DM için bildirim gönder
const sendDMNotification = async (
  channelId: string,
  fromUserId: string,
  fromUserName: string,
  messageContent: string
) => {
  try {
    // DM kanalında kimlerin olduğunu bul
    const dmDoc = await getDoc(doc(db, 'directMessages', channelId));
    if (!dmDoc.exists()) return;

    const dmData = dmDoc.data();
    const participants = dmData.participants as string[];
    
    // Gönderen dışındaki katılımcılara bildirim gönder
    for (const participantId of participants) {
      if (participantId !== fromUserId) {
        await createNotification({
          userId: participantId,
          type: 'message',
          title: `${fromUserName} size mesaj gönderdi`,
          message: messageContent.length > 50 
            ? messageContent.substring(0, 50) + '...' 
            : messageContent,
          read: false,
          data: {
            fromUserId,
            fromUserName,
            channelId,
            messageContent
          }
        });
      }
    }
  } catch (error) {
    console.error('Error sending DM notification:', error);
  }
};

// DirectMessage'ın son mesajını güncelle
const updateDirectMessageLastMessage = async (
  dmId: string,
  lastMessage: Partial<Message>
) => {
  try {
    await updateDoc(doc(db, 'directMessages', dmId), {
      lastMessage: {
        id: lastMessage.id,
        content: lastMessage.content,
        authorId: lastMessage.authorId,
        authorName: lastMessage.authorName,
        timestamp: Timestamp.fromDate(lastMessage.timestamp || new Date())
      },
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating last message:', error);
  }
};

// Mesajı düzenle
export const editMessage = async (
  messageId: string,
  newContent: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!newContent.trim()) {
      return { success: false, error: 'Mesaj boş olamaz' };
    }

    const mentions = extractMentions(newContent);
    const roleMentions = extractRoleMentions(newContent);

    await updateDoc(doc(db, 'messages', messageId), {
      content: newContent.trim(),
      mentions,
      roleMentions,
      editedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error editing message:', error);
    return { success: false, error: error.message };
  }
};

// Mesajı sil
export const deleteMessage = async (
  messageId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, 'messages', messageId));
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return { success: false, error: error.message };
  }
};

// DM mesajı sil
export const deleteDMMessage = async (
  messageId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, 'dmMessages', messageId));
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting DM message:', error);
    return { success: false, error: error.message };
  }
};

// Mesaja reaksiyon ekle/çıkar
export const toggleMessageReaction = async (
  messageId: string,
  emoji: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const messageDoc = await getDoc(doc(db, 'messages', messageId));
    if (!messageDoc.exists()) {
      return { success: false, error: 'Mesaj bulunamadı' };
    }

    const messageData = messageDoc.data();
    const reactions = messageData.reactions || [];
    
    const existingReaction = reactions.find((r: MessageReaction) => r.emoji === emoji);
    
    if (existingReaction) {
      const userIndex = existingReaction.users.indexOf(userId);
      if (userIndex > -1) {
        // Reaksiyonu kaldır
        existingReaction.users.splice(userIndex, 1);
        existingReaction.count = existingReaction.users.length;
        
        // Eğer kimse kalmadıysa reaksiyonu tamamen kaldır
        if (existingReaction.count === 0) {
          const reactionIndex = reactions.indexOf(existingReaction);
          reactions.splice(reactionIndex, 1);
        }
      } else {
        // Reaksiyon ekle
        existingReaction.users.push(userId);
        existingReaction.count = existingReaction.users.length;
      }
    } else {
      // Yeni reaksiyon
      reactions.push({
        emoji,
        count: 1,
        users: [userId]
      });
    }

    await updateDoc(doc(db, 'messages', messageId), {
      reactions
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    return { success: false, error: error.message };
  }
};

// Kanaldaki mesajları getir (ilk yükleme için)
export const getChannelMessages = async (
  channelId: string,
  limitCount: number = 50
): Promise<Message[]> => {
  try {
    const messagesQuery = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(messagesQuery);
    const messages: Message[] = [];

    snapshot.docs.reverse().forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
        editedAt: data.editedAt?.toDate(),
      } as Message);
    });

    return messages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

// Mesajda bahsedilen kullanıcıları çıkar
const extractMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
};

// Mesajda bahsedilen rolleri çıkar
const extractRoleMentions = (content: string): string[] => {
  const roleMentionRegex = /@&(\w+)/g;
  const roleMentions: string[] = [];
  let match;

  while ((match = roleMentionRegex.exec(content)) !== null) {
    roleMentions.push(match[1]);
  }

  return roleMentions;
};

// Mesaj arama
export const searchMessages = async (
  channelId: string,
  searchTerm: string,
  limitCount: number = 20
): Promise<Message[]> => {
  try {
    // Firestore'da full-text search yoktur, bu basit bir implementasyon
    const messagesQuery = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'desc'),
      limit(limitCount * 5) // Daha fazla mesaj al, sonra filtrele
    );

    const snapshot = await getDocs(messagesQuery);
    const messages: Message[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const message = {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
        editedAt: data.editedAt?.toDate(),
      } as Message;

      // Basit string arama
      if (message.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        messages.push(message);
      }
    });

    return messages.slice(0, limitCount);
  } catch (error) {
    console.error('Error searching messages:', error);
    return [];
  }
};

// Sistem mesajı gönder
export const sendSystemMessage = async (
  channelId: string,
  content: string,
  serverId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const messageData = {
      channelId,
      serverId,
      authorId: 'system',
      authorName: 'Sistem',
      content,
      timestamp: Timestamp.now(),
      type: 'system',
      reactions: [],
      mentions: []
    };

    const messageDoc = await addDoc(collection(db, 'messages'), messageData);
    return { success: true, messageId: messageDoc.id };
  } catch (error: any) {
    console.error('Error sending system message:', error);
    return { success: false, error: error.message };
  }
};

// Oda mesajlarını real-time dinle
export const subscribeToRoomMessages = (
  roomId: string,
  callback: (messages: Message[]) => void
) => {
  const q = query(
    collection(db, 'messages'),
    where('roomId', '==', roomId),
    orderBy('timestamp', 'asc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date()
      } as Message);
    });
    callback(messages);
  });
};

// Oda mesajı gönder
export const sendRoomMessage = async (
  roomId: string,
  serverId: string,
  content: string,
  authorId: string,
  authorName: string,
  authorPhotoURL?: string,
  attachments?: MessageAttachment[]
) => {
  try {
    // Sunucu mesajı için izin kontrolü
    const permissions = await checkUserPermissions(serverId, authorId);
    if (!permissions.canSendMessages) {
      return { success: false, error: 'Mesaj gönderme izniniz yok.' };
    }
    
    if (attachments && attachments.length > 0 && !permissions.canAttachFiles) {
      return { success: false, error: 'Dosya ekleme izniniz yok.' };
    }
    
    if (content.includes('@everyone') && !permissions.canMentionEveryone) {
      return { success: false, error: '@everyone kullanma izniniz yok.' };
    }
    
    // Bahsedilen kullanıcıları ve rolleri bul
    const mentions = extractMentions(content);
    const roleMentions = extractRoleMentions(content);

    const messageData = {
      roomId,
      serverId,
      content,
      authorId,
      authorName,
      authorPhotoURL: authorPhotoURL || '',
      attachments: attachments || [],
      timestamp: Timestamp.now(),
      type: 'text',
      reactions: [],
      mentions,
      roleMentions
    };

    const messageDoc = await addDoc(collection(db, 'messages'), messageData);
    
    // Rol bahsetme bildirimlerini gönder
    await sendRoleMentionNotifications(serverId, roleMentions, authorId, authorName, content);
    
    return { success: true, messageId: messageDoc.id };
  } catch (error: any) {
    console.error('Error sending room message:', error);
    return { success: false, error: error.message };
  }
};

// Rol bahsetme bildirimlerini gönder
const sendRoleMentionNotifications = async (
  serverId: string,
  roleMentions: string[],
  authorId: string,
  authorName: string,
  content: string
) => {
  if (!roleMentions || roleMentions.length === 0) return;

  try {
    // Server members'ı al
    const membersQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId)
    );
    const membersSnapshot = await getDocs(membersQuery);
    
    // Rol bilgilerini al
    const rolesQuery = query(
      collection(db, 'roles'),
      where('serverId', '==', serverId)
    );
    const rolesSnapshot = await getDocs(rolesQuery);
    const roles = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Bahsedilen rolleri bul
    const mentionedRoles = roles.filter((role: any) => 
      roleMentions.some(mention => mention.toLowerCase() === role.name.toLowerCase())
    );

    // Her bahsedilen rol için
    for (const role of mentionedRoles) {
      // O role sahip üyeleri bul
      const membersWithRole = membersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((member: any) => member.roles && member.roles.includes(role.id));

      // Her üyeye bildirim gönder
      for (const member of membersWithRole) {
        if ((member as any).userId !== authorId) { // Kendi kendine bildirim gönderme
          await createNotification({
            userId: (member as any).userId,
            type: 'mention',
            title: `${authorName} sizi ${(role as any).name} rolünde bahsetti`,
            message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            read: false,
            data: {
              serverId,
              roleName: (role as any).name,
              authorId,
              authorName
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending role mention notifications:', error);
  }
};

// @everyone bildirimi gönder
export const sendEveryoneNotification = async (
  serverId: string,
  authorId: string,
  authorName: string,
  content: string
): Promise<void> => {
  try {
    // Sunucu üyelerini getir
    const membersQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId)
    );
    
    const membersSnapshot = await getDocs(membersQuery);
    
    // Her üyeye bildirim gönder
    for (const memberDoc of membersSnapshot.docs) {
      const member = memberDoc.data();
      
      // Kendi kendine bildirim gönderme
      if (member.userId !== authorId) {
        await createNotification({
          userId: member.userId,
          type: 'mention',
          title: `${authorName} herkesi bahsetti`,
          message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          read: false,
          data: {
            serverId,
            mentionType: 'everyone',
            authorId,
            authorName
          }
        });
      }
    }
  } catch (error) {
    console.error('Error sending everyone notification:', error);
  }
}; 