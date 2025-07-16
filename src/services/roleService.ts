import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { Role, ServerPermissions, AuditLogEntry, AuditLogAction } from '../types';

// Varsayılan izinler
export const DEFAULT_PERMISSIONS: ServerPermissions = {
  // Genel izinler
  canManageServer: false,
  canManageChannels: false,
  canManageRoles: false,
  canCreateInvites: false,
  canChangeNickname: true,
  canManageNicknames: false,
  canViewAuditLog: false,
  canViewServerInsights: false,
  
  // Üye yönetimi
  canKickMembers: false,
  canBanMembers: false,
  canTimeoutMembers: false,
  
  // Mesaj izinleri
  canSendMessages: true,
  canSendTTSMessages: false,
  canManageMessages: false,
  canEmbedLinks: true,
  canAttachFiles: true,
  canReadMessageHistory: true,
  canMentionEveryone: false,
  canUseExternalEmojis: true,
  canUseSlashCommands: true,
  canAddReactions: true,
  
  // Sesli kanal izinleri
  canConnect: true,
  canSpeak: true,
  canVideo: true,
  canUseVoiceActivity: true,
  canPrioritySpeak: false,
  canMuteMembers: false,
  canDeafenMembers: false,
  canMoveMembers: false,
  canUseVAD: true,
  canStream: true,
  
  // Gelişmiş izinler
  canManageWebhooks: false,
  canManageEmojis: false,
  canManageThreads: false,
  canCreatePublicThreads: true,
  canCreatePrivateThreads: true,
  canSendMessagesInThreads: true,
  canUseApplicationCommands: true,
  canRequestToSpeak: true,
};

// Admin izinleri
export const ADMIN_PERMISSIONS: ServerPermissions = {
  // Genel izinler
  canManageServer: true,
  canManageChannels: true,
  canManageRoles: true,
  canCreateInvites: true,
  canChangeNickname: true,
  canManageNicknames: true,
  canViewAuditLog: true,
  canViewServerInsights: true,
  
  // Üye yönetimi
  canKickMembers: true,
  canBanMembers: true,
  canTimeoutMembers: true,
  
  // Mesaj izinleri
  canSendMessages: true,
  canSendTTSMessages: true,
  canManageMessages: true,
  canEmbedLinks: true,
  canAttachFiles: true,
  canReadMessageHistory: true,
  canMentionEveryone: true,
  canUseExternalEmojis: true,
  canUseSlashCommands: true,
  canAddReactions: true,
  
  // Sesli kanal izinleri
  canConnect: true,
  canSpeak: true,
  canVideo: true,
  canUseVoiceActivity: true,
  canPrioritySpeak: true,
  canMuteMembers: true,
  canDeafenMembers: true,
  canMoveMembers: true,
  canUseVAD: true,
  canStream: true,
  
  // Gelişmiş izinler
  canManageWebhooks: true,
  canManageEmojis: true,
  canManageThreads: true,
  canCreatePublicThreads: true,
  canCreatePrivateThreads: true,
  canSendMessagesInThreads: true,
  canUseApplicationCommands: true,
  canRequestToSpeak: true,
};

// Moderatör izinleri
export const MODERATOR_PERMISSIONS: ServerPermissions = {
  ...DEFAULT_PERMISSIONS,
  canKickMembers: true,
  canTimeoutMembers: true,
  canManageMessages: true,
  canMentionEveryone: true,
  canMuteMembers: true,
  canDeafenMembers: true,
  canMoveMembers: true,
  canManageThreads: true,
};

// Rol renkleri
export const ROLE_COLORS = [
  '#99aab5', // Varsayılan
  '#1abc9c', // Teal
  '#2ecc71', // Green
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e91e63', // Pink
  '#f1c40f', // Yellow
  '#e67e22', // Orange
  '#e74c3c', // Red
  '#95a5a6', // Grey
  '#607d8b', // Blue Grey
  '#11806a', // Dark Teal
  '#1f8b4c', // Dark Green
  '#206694', // Dark Blue
  '#71368a', // Dark Purple
  '#ad1457', // Dark Pink
  '#c27c0e', // Dark Yellow
  '#a84300', // Dark Orange
  '#992d22', // Dark Red
];

// Sunucunun rollerini getir
export const getServerRoles = async (serverId: string): Promise<Role[]> => {
  try {
    const rolesQuery = query(
      collection(db, 'roles'),
      where('serverId', '==', serverId),
      orderBy('position', 'desc')
    );
    
    const snapshot = await getDocs(rolesQuery);
    const roles: Role[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      roles.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Role);
    });
    
    return roles;
  } catch (error) {
    console.error('Error fetching server roles:', error);
    return [];
  }
};

// Rol oluştur
export const createRole = async (
  serverId: string,
  name: string,
  color: string = '#99aab5',
  permissions: Partial<ServerPermissions> = {},
  userId: string
): Promise<{ success: boolean; roleId?: string; error?: string }> => {
  try {
    // Pozisyon hesapla
    const existingRoles = await getServerRoles(serverId);
    const position = existingRoles.length;
    
    const roleData = {
      serverId,
      name,
      color,
      permissions: { ...DEFAULT_PERMISSIONS, ...permissions },
      position,
      mentionable: true,
      isDefault: false,
      isManaged: false,
      createdAt: Timestamp.now(),
    };
    
    const roleDoc = await addDoc(collection(db, 'roles'), roleData);
    
    // Audit log
    await logAuditAction(serverId, userId, AuditLogAction.ROLE_CREATE, roleDoc.id, `Rol oluşturuldu: ${name}`);
    
    return { success: true, roleId: roleDoc.id };
  } catch (error) {
    console.error('Error creating role:', error);
    return { success: false, error: 'Rol oluşturulurken hata oluştu.' };
  }
};

// Rol güncelle
export const updateRole = async (
  roleId: string,
  updates: Partial<Role>,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const roleRef = doc(db, 'roles', roleId);
    const roleDoc = await getDoc(roleRef);
    
    if (!roleDoc.exists()) {
      return { success: false, error: 'Rol bulunamadı.' };
    }
    
    const oldData = roleDoc.data();
    await updateDoc(roleRef, updates);
    
    // Audit log
    const changes = Object.keys(updates).map(key => ({
      key,
      oldValue: oldData[key],
      newValue: updates[key as keyof Role]
    }));
    
    await logAuditAction(
      oldData.serverId,
      userId,
      AuditLogAction.ROLE_UPDATE,
      roleId,
      `Rol güncellendi: ${oldData.name}`,
      changes
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error updating role:', error);
    return { success: false, error: 'Rol güncellenirken hata oluştu.' };
  }
};

// Rol sil
export const deleteRole = async (
  roleId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const roleRef = doc(db, 'roles', roleId);
    const roleDoc = await getDoc(roleRef);
    
    if (!roleDoc.exists()) {
      return { success: false, error: 'Rol bulunamadı.' };
    }
    
    const roleData = roleDoc.data();
    
    // Varsayılan rol silinemez
    if (roleData.isDefault) {
      return { success: false, error: 'Varsayılan rol silinemez.' };
    }
    
    // Rolü kullanan üyeleri güncelle
    const batch = writeBatch(db);
    
    const membersQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', roleData.serverId)
    );
    
    const membersSnapshot = await getDocs(membersQuery);
    
    membersSnapshot.forEach(memberDoc => {
      const memberData = memberDoc.data();
      const roles = memberData.roles || [];
      
      if (roles.includes(roleId)) {
        const newRoles = roles.filter((r: string) => r !== roleId);
        batch.update(memberDoc.ref, { roles: newRoles });
      }
    });
    
    // Rolü sil
    batch.delete(roleRef);
    
    await batch.commit();
    
    // Audit log
    await logAuditAction(
      roleData.serverId,
      userId,
      AuditLogAction.ROLE_DELETE,
      roleId,
      `Rol silindi: ${roleData.name}`
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting role:', error);
    return { success: false, error: 'Rol silinirken hata oluştu.' };
  }
};

// Rol pozisyonlarını güncelle
export const updateRolePositions = async (
  serverId: string,
  rolePositions: { roleId: string; position: number }[],
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const batch = writeBatch(db);
    
    rolePositions.forEach(({ roleId, position }) => {
      const roleRef = doc(db, 'roles', roleId);
      batch.update(roleRef, { position });
    });
    
    await batch.commit();
    
    // Audit log
    await logAuditAction(
      serverId,
      userId,
      AuditLogAction.ROLE_UPDATE,
      undefined,
      'Rol pozisyonları güncellendi'
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error updating role positions:', error);
    return { success: false, error: 'Rol pozisyonları güncellenirken hata oluştu.' };
  }
};

// Kullanıcıya rol ver
export const assignRoleToUser = async (
  serverId: string,
  userId: string,
  roleId: string,
  assignedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId)
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    
    if (memberSnapshot.empty) {
      return { success: false, error: 'Üye bulunamadı.' };
    }
    
    const memberDoc = memberSnapshot.docs[0];
    const memberData = memberDoc.data();
    const currentRoles = memberData.roles || [];
    
    if (currentRoles.includes(roleId)) {
      return { success: false, error: 'Kullanıcı zaten bu role sahip.' };
    }
    
    const newRoles = [...currentRoles, roleId];
    await updateDoc(memberDoc.ref, { roles: newRoles });
    
    // Audit log
    const roleDoc = await getDoc(doc(db, 'roles', roleId));
    const roleName = roleDoc.exists() ? roleDoc.data().name : 'Bilinmeyen Rol';
    
    await logAuditAction(
      serverId,
      assignedBy,
      AuditLogAction.MEMBER_ROLE_UPDATE,
      userId,
      `Rol verildi: ${roleName}`
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error assigning role:', error);
    return { success: false, error: 'Rol verilirken hata oluştu.' };
  }
};

// Kullanıcıdan rol al
export const removeRoleFromUser = async (
  serverId: string,
  userId: string,
  roleId: string,
  removedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const memberQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId),
      where('userId', '==', userId)
    );
    
    const memberSnapshot = await getDocs(memberQuery);
    
    if (memberSnapshot.empty) {
      return { success: false, error: 'Üye bulunamadı.' };
    }
    
    const memberDoc = memberSnapshot.docs[0];
    const memberData = memberDoc.data();
    const currentRoles = memberData.roles || [];
    
    if (!currentRoles.includes(roleId)) {
      return { success: false, error: 'Kullanıcı bu role sahip değil.' };
    }
    
    const newRoles = currentRoles.filter((r: string) => r !== roleId);
    await updateDoc(memberDoc.ref, { roles: newRoles });
    
    // Audit log
    const roleDoc = await getDoc(doc(db, 'roles', roleId));
    const roleName = roleDoc.exists() ? roleDoc.data().name : 'Bilinmeyen Rol';
    
    await logAuditAction(
      serverId,
      removedBy,
      AuditLogAction.MEMBER_ROLE_UPDATE,
      userId,
      `Rol alındı: ${roleName}`
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error removing role:', error);
    return { success: false, error: 'Rol alınırken hata oluştu.' };
  }
};

// Varsayılan @everyone rolü oluştur
export const createDefaultRole = async (serverId: string): Promise<string> => {
  try {
    const roleData = {
      serverId,
      name: '@everyone',
      color: '#99aab5',
      permissions: DEFAULT_PERMISSIONS,
      position: 0,
      mentionable: false,
      isDefault: true,
      isManaged: false,
      createdAt: Timestamp.now(),
    };
    
    const roleDoc = await addDoc(collection(db, 'roles'), roleData);
    return roleDoc.id;
  } catch (error) {
    console.error('Error creating default role:', error);
    throw error;
  }
};

// Audit log kaydı
export const logAuditAction = async (
  serverId: string,
  userId: string,
  action: AuditLogAction,
  targetId?: string,
  reason?: string,
  changes?: any[]
): Promise<void> => {
  try {
    // Undefined değerleri filtrele
    const auditData: any = {
      serverId,
      userId,
      action,
      timestamp: Timestamp.now(),
    };

    // Sadece tanımlı değerleri ekle
    if (targetId !== undefined) {
      auditData.targetId = targetId;
    }
    if (reason !== undefined && reason !== null) {
      auditData.reason = reason;
    }
    if (changes !== undefined && changes !== null) {
      auditData.changes = changes;
    }
    
    await addDoc(collection(db, 'auditLogs'), auditData);
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
};

// Audit log getir
export const getAuditLogs = async (
  serverId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> => {
  try {
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('serverId', '==', serverId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(auditQuery);
    const logs: AuditLogEntry[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as AuditLogEntry);
    });
    
    return logs.slice(0, limit);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

// Audit log ekle
export const addAuditLog = async (
  serverId: string,
  userId: string,
  action: string,
  details?: any
): Promise<void> => {
  try {
    // Audit data objesini hazırla
    const auditData: any = {
      serverId,
      userId,
      action,
      timestamp: Timestamp.now()
    };

    // Details'i string olarak kaydet
    if (details !== undefined && details !== null) {
      let detailsString = '';
      if (typeof details === 'string') {
        detailsString = details;
      } else if (typeof details === 'object') {
        if (details.deletedCount) {
          detailsString = `${details.deletedCount} kayıt silindi`;
        } else if (details.deletedLogId) {
          detailsString = `Log ID: ${details.deletedLogId}`;
        } else if (details.roleName) {
          detailsString = `Rol: ${details.roleName}`;
        } else if (details.roleId) {
          detailsString = `Rol ID: ${details.roleId}`;
        } else {
          detailsString = JSON.stringify(details);
        }
      } else {
        detailsString = String(details);
      }
      
      if (detailsString.trim()) {
        auditData.details = detailsString;
      }
    }

    await addDoc(collection(db, 'auditLogs'), auditData);
  } catch (error) {
    console.error('Error adding audit log:', error);
  }
};

// Tekil audit log sil
export const deleteAuditLog = async (
  logId: string,
  serverId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Audit log'u sil
    await deleteDoc(doc(db, 'auditLogs', logId));
    
    // Silme işlemini audit log'a kaydet
    await addAuditLog(serverId, userId, 'AUDIT_LOG_DELETED', {
      deletedLogId: logId
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting audit log:', error);
    return { success: false, error: error.message };
  }
};

// Tüm audit log'ları sil
export const clearAuditLogs = async (
  serverId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Tüm audit log'ları getir
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('serverId', '==', serverId)
    );
    
    const snapshot = await getDocs(auditQuery);
    const batch = writeBatch(db);
    
    // Batch ile tümünü sil
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Temizleme işlemini audit log'a kaydet
    await addAuditLog(serverId, userId, 'AUDIT_LOG_CLEARED', {
      deletedCount: snapshot.size
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error clearing audit logs:', error);
    return { success: false, error: error.message };
  }
};

// Rolleri gerçek zamanlı dinle
export const subscribeToServerRoles = (
  serverId: string,
  callback: (roles: Role[]) => void
): (() => void) => {
  const rolesQuery = query(
    collection(db, 'roles'),
    where('serverId', '==', serverId),
    orderBy('position', 'desc')
  );
  
  return onSnapshot(rolesQuery, (snapshot) => {
    const roles: Role[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      roles.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Role);
    });
    
    callback(roles);
  });
}; 