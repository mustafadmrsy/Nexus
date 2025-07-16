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
  writeBatch,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Server, ServerMember, User, Role } from '../types';
import { DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS, MODERATOR_PERMISSIONS } from './roleService';
import { createPendingMemberNotification } from './notificationService';

// Rol seviyeleri ve yetkileri
export const SERVER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member'
} as const;

export const ROLE_HIERARCHY = {
  [SERVER_ROLES.OWNER]: 4,
  [SERVER_ROLES.ADMIN]: 3,
  [SERVER_ROLES.MODERATOR]: 2,
  [SERVER_ROLES.MEMBER]: 1
} as const;

export const ROLE_PERMISSIONS = {
  [SERVER_ROLES.OWNER]: ADMIN_PERMISSIONS,
  [SERVER_ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [SERVER_ROLES.MODERATOR]: MODERATOR_PERMISSIONS,
  [SERVER_ROLES.MEMBER]: DEFAULT_PERMISSIONS
} as const;

// Rolün yetki seviyesini kontrol et
export const getRoleHierarchy = (role: string): number => {
  return ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0;
};

// Rolün yetkilerini getir
export const getRolePermissions = (role: string) => {
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS[SERVER_ROLES.MEMBER];
};

// Kullanıcının en yüksek rolünü getir
export const getHighestRole = (roles: string[]): string => {
  if (roles.includes(SERVER_ROLES.OWNER)) return SERVER_ROLES.OWNER;
  if (roles.includes(SERVER_ROLES.ADMIN)) return SERVER_ROLES.ADMIN;
  if (roles.includes(SERVER_ROLES.MODERATOR)) return SERVER_ROLES.MODERATOR;
  return SERVER_ROLES.MEMBER;
};

// Kullanıcının rolünü değiştir
export const changeUserRole = async (
  serverId: string,
  targetUserId: string,
  newRole: string,
  assignedByUserId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Yetki kontrolü
    const assignerPermissions = await checkUserPermissions(serverId, assignedByUserId);
    if (!assignerPermissions.canManageRoles) {
      return { success: false, error: 'Bu işlem için yetkiniz yok.' };
    }

    // Hedef kullanıcının mevcut rolünü al
    const targetPermissions = await checkUserPermissions(serverId, targetUserId);
    const assignerHighestRole = getHighestRole(assignerPermissions.roles);
    const targetHighestRole = getHighestRole(targetPermissions.roles);

    // Yetki seviyesi kontrolü
    if (getRoleHierarchy(newRole) >= getRoleHierarchy(assignerHighestRole)) {
      return { success: false, error: 'Kendi seviyenizde veya üstünde rol veremezsiniz.' };
    }

    if (getRoleHierarchy(targetHighestRole) >= getRoleHierarchy(assignerHighestRole)) {
      return { success: false, error: 'Kendi seviyenizde veya üstündeki kullanıcıların rolünü değiştiremezsiniz.' };
    }

    // Üye bilgilerini güncelle
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', targetUserId)
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    if (memberSnapshot.empty) {
      return { success: false, error: 'Üye bulunamadı.' };
    }

    const memberDoc = memberSnapshot.docs[0];
    const newRoles = [newRole];
    const newPermissions = getRolePermissions(newRole);

    await updateDoc(memberDoc.ref, {
      roles: newRoles,
      permissions: newPermissions,
      updatedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error) {
    console.error('Error changing user role:', error);
    return { success: false, error: 'Rol değiştirirken hata oluştu.' };
  }
};

// Sunucu bilgilerini getir
export const getServerById = async (serverId: string): Promise<Server | null> => {
  try {
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    if (serverDoc.exists()) {
      const data = serverDoc.data();
      return {
        id: serverDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Server;
    }
    return null;
  } catch (error) {
    console.error('Error fetching server:', error);
    return null;
  }
};

// Sunucu üyelerini getir
export const getServerMembers = async (serverId: string): Promise<ServerMember[]> => {
  try {
    const membersQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId)
    );
    
    const snapshot = await getDocs(membersQuery);
    const members: ServerMember[] = [];
    
    for (const memberDoc of snapshot.docs) {
      const memberData = memberDoc.data();
      
      // Kullanıcı bilgilerini getir
      const userDoc = await getDoc(doc(db, 'users', memberData.userId));
      const userData = userDoc.data();
      
      if (userData) {
        members.push({
          id: memberDoc.id,
          ...memberData,
          joinedAt: memberData.joinedAt?.toDate() || new Date(),
          user: {
            uid: userDoc.id,
            ...userData,
            createdAt: userData.createdAt?.toDate() || new Date(),
            lastSeen: userData.lastSeen?.toDate() || new Date(),
          } as User
        } as ServerMember);
      }
    }
    
    return members.sort((a, b) => {
      // Roller önceliğine göre sırala (owner > admin > member)
      const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const aRole = a.roles[0] || 'member';
      const bRole = b.roles[0] || 'member';
      
      return (roleOrder[aRole as keyof typeof roleOrder] || 3) - 
             (roleOrder[bRole as keyof typeof roleOrder] || 3);
    });
  } catch (error) {
    console.error('Error fetching server members:', error);
    return [];
  }
};

// Sunucu üyelerini real-time dinle
export const subscribeToServerMembers = (
  serverId: string,
  callback: (members: ServerMember[]) => void
): (() => void) => {
  const membersQuery = query(
    collection(db, 'serverMembers'),
    where('serverId', '==', serverId)
  );

  return onSnapshot(membersQuery, async (snapshot) => {
    const members: ServerMember[] = [];
    
    for (const memberDoc of snapshot.docs) {
      const memberData = memberDoc.data();
      
      // Kullanıcı bilgilerini getir
      const userDoc = await getDoc(doc(db, 'users', memberData.userId));
      const userData = userDoc.data();
      
      if (userData) {
        members.push({
          id: memberDoc.id,
          ...memberData,
          joinedAt: memberData.joinedAt?.toDate() || new Date(),
          user: {
            uid: userDoc.id,
            ...userData,
            createdAt: userData.createdAt?.toDate() || new Date(),
            lastSeen: userData.lastSeen?.toDate() || new Date(),
          } as User
        } as ServerMember);
      }
    }
    
    const sortedMembers = members.sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const aRole = a.roles[0] || 'member';
      const bRole = b.roles[0] || 'member';
      
      return (roleOrder[aRole as keyof typeof roleOrder] || 3) - 
             (roleOrder[bRole as keyof typeof roleOrder] || 3);
    });
    
    callback(sortedMembers);
  }, (error) => {
    console.error('Error listening to server members:', error);
    callback([]);
  });
};

// Sunucu kanallarını getir
export const getServerChannels = async (serverId: string) => {
  try {
    const channelsQuery = query(
      collection(db, 'channels'),
      where('serverId', '==', serverId)
    );
    
    const snapshot = await getDocs(channelsQuery);
    const channels: any[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      channels.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    });
    
    return channels.sort((a, b) => a.position - b.position);
  } catch (error) {
    console.error('Error fetching server channels:', error);
    return [];
  }
};

// Kanal oluştur
export const createChannel = async (
  serverId: string,
  name: string,
  type: 'text' | 'voice' | 'game',
  description?: string,
  createdBy?: string
): Promise<{ success: boolean; channelId?: string; error?: string }> => {
  try {
    // En yüksek position'u bul
    const channels = await getServerChannels(serverId);
    const maxPosition = channels.length > 0 ? Math.max(...channels.map(c => c.position)) : -1;
    
    const channelData = {
      serverId,
      name: name.trim(),
      type,
      description: description?.trim() || '',
      createdAt: Timestamp.now(),
      createdBy: createdBy || 'system',
      position: maxPosition + 1,
    };
    
    const channelDoc = await addDoc(collection(db, 'channels'), channelData);
    return { success: true, channelId: channelDoc.id };
  } catch (error: any) {
    console.error('Error creating channel:', error);
    return { success: false, error: error.message };
  }
};

// Kanal sil
export const deleteChannel = async (channelId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Önce kanaldaki tüm mesajları sil
    const messagesQuery = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId)
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Kanalı sil
    batch.delete(doc(db, 'channels', channelId));
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting channel:', error);
    return { success: false, error: error.message };
  }
};

// Sunucu güncelle
export const updateServer = async (
  serverId: string,
  updates: {
    name?: string;
    description?: string;
    iconURL?: string;
    isPublic?: boolean;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name.trim();
    if (updates.description !== undefined) updateData.description = updates.description.trim();
    if (updates.iconURL !== undefined) updateData.iconURL = updates.iconURL;
    if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic;
    
    await updateDoc(doc(db, 'servers', serverId), updateData);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating server:', error);
    return { success: false, error: error.message };
  }
};

// Sunucu sil
export const deleteServer = async (serverId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const batch = writeBatch(db);
    
    // Sunucu üyelerini sil
    const membersQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId)
    );
    const membersSnapshot = await getDocs(membersQuery);
    membersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Sunucu kanallarını sil
    const channelsQuery = query(
      collection(db, 'channels'),
      where('serverId', '==', serverId)
    );
    const channelsSnapshot = await getDocs(channelsQuery);
    
    for (const channelDoc of channelsSnapshot.docs) {
      // Kanal mesajlarını sil
      const messagesQuery = query(
        collection(db, 'messages'),
        where('channelId', '==', channelDoc.id)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      messagesSnapshot.docs.forEach(msgDoc => {
        batch.delete(msgDoc.ref);
      });
      
      // Kanalı sil
      batch.delete(channelDoc.ref);
    }
    
    // Sunucuyu sil
    batch.delete(doc(db, 'servers', serverId));
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting server:', error);
    return { success: false, error: error.message };
  }
};

// Sunucuya üye ekle
export const addServerMember = async (
  serverId: string,
  userId: string,
  roles: string[] = ['member'],
  bypassApproval: boolean = false
): Promise<{ success: boolean; error?: string; isPending?: boolean }> => {
  try {
    // Sunucu ayarlarını kontrol et
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    if (!serverDoc.exists()) {
      return { success: false, error: 'Sunucu bulunamadı' };
    }
    
    const serverData = serverDoc.data();
    const requireApproval = serverData.requireApproval || false;
    
    // Üye zaten var mı kontrol et
    const existingMemberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId)
    );
    
    const existingSnapshot = await getDocs(existingMemberQuery);
    if (!existingSnapshot.empty) {
      const existingMember = existingSnapshot.docs[0].data();
      if (existingMember.status === 'pending') {
        return { success: false, error: 'Üyelik onayı bekleniyor' };
      } else if (existingMember.status === 'active') {
        return { success: false, error: 'Kullanıcı zaten sunucuda' };
      }
    }
    
    // Üye ekle
    const memberStatus = requireApproval && !bypassApproval ? 'pending' : 'active';
    
    // Rol bazlı izinleri hesapla
    const highestRole = getHighestRole(roles);
    const rolePermissions = getRolePermissions(highestRole);
    
    const memberData = {
      serverId,
      userId,
      joinedAt: memberStatus === 'active' ? Timestamp.now() : null,
      requestedAt: memberStatus === 'pending' ? Timestamp.now() : null,
      roles,
      status: memberStatus,
      permissions: rolePermissions
    };
    
    await addDoc(collection(db, 'serverMembers'), memberData);
    
    // Sadece aktif üyeler için sunucu üye sayısını artır
    if (memberStatus === 'active') {
      const serverRef = doc(db, 'servers', serverId);
      const serverDoc = await getDoc(serverRef);
      if (serverDoc.exists()) {
        const serverData = serverDoc.data();
        await updateDoc(serverRef, {
          memberCount: (serverData.memberCount || 0) + 1
        });
      }
    }
    
    // Pending üye için yöneticilere bildirim gönder
    if (memberStatus === 'pending') {
      // Kullanıcı bilgilerini al
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userName = userDoc.exists() ? userDoc.data().displayName : 'Bilinmeyen Kullanıcı';
      
      await createPendingMemberNotification(
        serverId,
        serverData.name,
        userId,
        userName
      );
    }
    
    return { 
      success: true, 
      isPending: memberStatus === 'pending' 
    };
  } catch (error: any) {
    console.error('Error adding server member:', error);
    return { success: false, error: error.message };
  }
};

// Sunucudan üye çıkar
export const removeServerMember = async (
  serverId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Üye belgesini bul ve sil
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId)
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    if (memberSnapshot.empty) {
      return { success: false, error: 'Üye bulunamadı' };
    }
    
    await deleteDoc(memberSnapshot.docs[0].ref);
    
    // Sunucu üye sayısını azalt
    const serverRef = doc(db, 'servers', serverId);
    const serverDoc = await getDoc(serverRef);
    if (serverDoc.exists()) {
      const serverData = serverDoc.data();
      await updateDoc(serverRef, {
        memberCount: Math.max((serverData.memberCount || 1) - 1, 0)
      });
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error removing server member:', error);
    return { success: false, error: error.message };
  }
};

// Üye yetkilerini güncelle
export const updateMemberRole = async (
  serverId: string,
  userId: string,
  newRoles: string[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId)
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    if (memberSnapshot.empty) {
      return { success: false, error: 'Üye bulunamadı' };
    }
    
    await updateDoc(memberSnapshot.docs[0].ref, {
      roles: newRoles
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating member role:', error);
    return { success: false, error: error.message };
  }
};

// Kullanıcının sunucudaki yetkilerini kontrol et
export const checkUserPermissions = async (
  serverId: string,
  userId: string
): Promise<{
  isOwner: boolean;
  isAdmin: boolean;
  canManageServer: boolean;
  canManageChannels: boolean;
  canManageRoles: boolean;
  canKickMembers: boolean;
  canBanMembers: boolean;
  canViewAuditLog: boolean;
  canViewServerInsights: boolean;
  canCreateInvites: boolean;
  canManageMessages: boolean;
  canSendMessages: boolean;
  canAttachFiles: boolean;
  canMentionEveryone: boolean;
  canConnect: boolean;
  canSpeak: boolean;
  canVideo: boolean;
  canMuteMembers: boolean;
  canDeafenMembers: boolean;
  canMoveMembers: boolean;
  roles: string[];
}> => {
  try {
    // Sunucu sahibi mi kontrol et
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    const isOwner = serverDoc.exists() && serverDoc.data().ownerId === userId;
    
    // Eğer server owner'ı ise, otomatik olarak tüm izinleri ver
    if (isOwner) {
      const ownerPermissions = getRolePermissions(SERVER_ROLES.OWNER);
      return {
        isOwner: true,
        isAdmin: true,
        canManageServer: true,
        canManageChannels: true,
        canManageRoles: true,
        canKickMembers: true,
        canBanMembers: true,
        canViewAuditLog: true,
        canViewServerInsights: true,
        canCreateInvites: true,
        canManageMessages: true,
        canSendMessages: true,
        canAttachFiles: true,
        canMentionEveryone: true,
        canConnect: true,
        canSpeak: true,
        canVideo: true,
        canMuteMembers: true,
        canDeafenMembers: true,
        canMoveMembers: true,
        roles: ['owner']
      };
    }
    
    // Üye bilgilerini al
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId)
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    
    if (memberSnapshot.empty) {
      // Kullanıcı server member'ı değil - hiçbir izin yok
      return {
        isOwner: false,
        isAdmin: false,
        canManageServer: false,
        canManageChannels: false,
        canManageRoles: false,
        canKickMembers: false,
        canBanMembers: false,
        canViewAuditLog: false,
        canViewServerInsights: false,
        canCreateInvites: false,
        canManageMessages: false,
        canSendMessages: false,
        canAttachFiles: false,
        canMentionEveryone: false,
        canConnect: false,
        canSpeak: false,
        canVideo: false,
        canMuteMembers: false,
        canDeafenMembers: false,
        canMoveMembers: false,
        roles: []
      };
    }
    
    const memberData = memberSnapshot.docs[0].data();
    const roles = memberData.roles || [];
    const memberStatus = memberData.status || 'active';
    
    // Pending üyeler için izin yok
    if (memberStatus === 'pending') {
      return {
        isOwner: false,
        isAdmin: false,
        canManageServer: false,
        canManageChannels: false,
        canManageRoles: false,
        canKickMembers: false,
        canBanMembers: false,
        canViewAuditLog: false,
        canViewServerInsights: false,
        canCreateInvites: false,
        canManageMessages: false,
        canSendMessages: false,
        canAttachFiles: false,
        canMentionEveryone: false,
        canConnect: false,
        canSpeak: false,
        canVideo: false,
        canMuteMembers: false,
        canDeafenMembers: false,
        canMoveMembers: false,
        roles: []
      };
    }
    
    const isAdmin = roles.includes('admin') || roles.includes('owner');
    
    // Sistem rollerinden en yüksek rolü al
    const systemRoles = roles.filter((role: string) => 
      [SERVER_ROLES.OWNER, SERVER_ROLES.ADMIN, SERVER_ROLES.MODERATOR, SERVER_ROLES.MEMBER].includes(role as any)
    );
    const highestSystemRole = getHighestRole(systemRoles.length > 0 ? systemRoles : ['member']);
    const systemPermissions = getRolePermissions(highestSystemRole);
    
    // Özel rollerin izinlerini al ve birleştir
    const customRoleIds = roles.filter((role: string) => 
      ![SERVER_ROLES.OWNER, SERVER_ROLES.ADMIN, SERVER_ROLES.MODERATOR, SERVER_ROLES.MEMBER].includes(role as any)
    );
    
    let combinedPermissions = { ...systemPermissions };
    
    if (customRoleIds.length > 0) {
      // Özel rolleri veritabanından al
      const customRolesQuery = query(
        collection(db, 'roles'),
        where('serverId', '==', serverId)
      );
      
      const customRolesSnapshot = await getDocs(customRolesQuery);
      const customRoles = customRolesSnapshot.docs
        .filter(doc => customRoleIds.includes(doc.id))
        .map(doc => ({ id: doc.id, ...doc.data() } as Role));
      
      // Özel rollerin izinlerini sisteme ekle (OR işlemi - herhangi bir rol izin veriyorsa true)
      for (const customRole of customRoles) {
        const rolePermissions = customRole.permissions || {};
        
        // Her izin için OR işlemi yap (herhangi bir rol true veriyorsa true)
        Object.keys(combinedPermissions).forEach(permission => {
          if (rolePermissions[permission as keyof typeof rolePermissions] === true) {
            (combinedPermissions as any)[permission] = true;
          }
        });
      }
    }
    
    return {
      isOwner,
      isAdmin,
      canManageServer: combinedPermissions.canManageServer,
      canManageChannels: combinedPermissions.canManageChannels,
      canManageRoles: combinedPermissions.canManageRoles,
      canKickMembers: combinedPermissions.canKickMembers,
      canBanMembers: combinedPermissions.canBanMembers,
      canViewAuditLog: combinedPermissions.canViewAuditLog,
      canViewServerInsights: combinedPermissions.canViewServerInsights,
      canCreateInvites: combinedPermissions.canCreateInvites,
      canManageMessages: combinedPermissions.canManageMessages,
      canSendMessages: combinedPermissions.canSendMessages,
      canAttachFiles: combinedPermissions.canAttachFiles,
      canMentionEveryone: combinedPermissions.canMentionEveryone,
      canConnect: combinedPermissions.canConnect,
      canSpeak: combinedPermissions.canSpeak,
      canVideo: combinedPermissions.canVideo,
      canMuteMembers: combinedPermissions.canMuteMembers,
      canDeafenMembers: combinedPermissions.canDeafenMembers,
      canMoveMembers: combinedPermissions.canMoveMembers,
      roles
    };
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return {
      isOwner: false,
      isAdmin: false,
      canManageServer: false,
      canManageChannels: false,
      canManageRoles: false,
      canKickMembers: false,
      canBanMembers: false,
      canViewAuditLog: false,
      canViewServerInsights: false,
      canCreateInvites: false,
      canManageMessages: false,
      canSendMessages: false,
      canAttachFiles: false,
      canMentionEveryone: false,
      canConnect: false,
      canSpeak: false,
      canVideo: false,
      canMuteMembers: false,
      canDeafenMembers: false,
      canMoveMembers: false,
      roles: []
    };
  }
};

// Sunucu davet kabul et
export const acceptServerInvite = async (
  serverId: string,
  userId: string
): Promise<{ success: boolean; error?: string; isPending?: boolean }> => {
  try {
    // Sunucu var mı kontrol et
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    if (!serverDoc.exists()) {
      return { success: false, error: 'Sunucu bulunamadı' };
    }
    
    const serverData = serverDoc.data();
    const requiresApproval = serverData.requireApproval || false;
    
    // Eğer sunucu onay gerektiriyorsa pending olarak ekle, değilse direkt aktif
    const result = await addServerMember(serverId, userId, ['member'], !requiresApproval);
    
    if (result.success) {
      // İlgili sunucu davet bildirimlerini sil
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('type', '==', 'server_invite'),
        where('data.serverId', '==', serverId)
      );
      
      const notificationSnapshot = await getDocs(notificationsQuery);
      const deletePromises = notificationSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      return { 
        success: true, 
        isPending: result.isPending 
      };
    } else {
      return result;
    }
  } catch (error: any) {
    console.error('Error accepting server invite:', error);
    return { success: false, error: error.message };
  }
};

// Sunucu davet reddet
export const rejectServerInvite = async (
  serverId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Sunucu davet bildirimlerini sil
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'server_invite'),
      where('data.serverId', '==', serverId)
    );
    
    const notificationSnapshot = await getDocs(notificationsQuery);
    const deletePromises = notificationSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error rejecting server invite:', error);
    return { success: false, error: error.message };
  }
}; 

// Pending üye onayı
export const approvePendingMember = async (
  serverId: string,
  userId: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Yetki kontrolü
    const approverPermissions = await checkUserPermissions(serverId, approvedBy);
    if (!approverPermissions.canKickMembers) {
      return { success: false, error: 'Bu işlem için yetkiniz yok.' };
    }

    // Pending üyeyi bul
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    if (memberSnapshot.empty) {
      return { success: false, error: 'Bekleyen üye bulunamadı.' };
    }

    const memberDoc = memberSnapshot.docs[0];
    
    // Üyeyi onayla
    await updateDoc(memberDoc.ref, {
      status: 'active',
      approvedBy,
      joinedAt: Timestamp.now()
    });

    // Sunucu üye sayısını güncelle
    const serverRef = doc(db, 'servers', serverId);
    const serverDoc = await getDoc(serverRef);
    if (serverDoc.exists()) {
      const currentCount = serverDoc.data().memberCount || 0;
      await updateDoc(serverRef, {
        memberCount: currentCount + 1
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error approving member:', error);
    return { success: false, error: error.message };
  }
};

// Pending üye reddetme
export const rejectPendingMember = async (
  serverId: string,
  userId: string,
  rejectedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Yetki kontrolü
    const rejecterPermissions = await checkUserPermissions(serverId, rejectedBy);
    if (!rejecterPermissions.canKickMembers) {
      return { success: false, error: 'Bu işlem için yetkiniz yok.' };
    }

    // Pending üyeyi bul
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    if (memberSnapshot.empty) {
      return { success: false, error: 'Bekleyen üye bulunamadı.' };
    }

    const memberDoc = memberSnapshot.docs[0];
    
    // Üyeyi reddet (sil)
    await deleteDoc(memberDoc.ref);

    return { success: true };
  } catch (error: any) {
    console.error('Error rejecting member:', error);
    return { success: false, error: error.message };
  }
};

// Pending üyeleri getir
export const getPendingMembers = async (serverId: string): Promise<ServerMember[]> => {
  try {
    const pendingQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );
    
    const pendingSnapshot = await getDocs(pendingQuery);
    const pendingMembers: ServerMember[] = [];
    
    for (const memberDoc of pendingSnapshot.docs) {
      const memberData = memberDoc.data();
      
      // Kullanıcı bilgilerini getir
      const userDoc = await getDoc(doc(db, 'users', memberData.userId));
      const userData = userDoc.exists() ? userDoc.data() as User : undefined;
      
      pendingMembers.push({
        id: memberDoc.id,
        userId: memberData.userId,
        serverId: memberData.serverId,
        joinedAt: memberData.joinedAt?.toDate(),
        requestedAt: memberData.requestedAt?.toDate(),
        roles: memberData.roles || ['member'],
        permissions: memberData.permissions,
        status: memberData.status,
        user: userData
      });
    }
    
    return pendingMembers;
  } catch (error) {
    console.error('Error fetching pending members:', error);
    return [];
  }
}; 