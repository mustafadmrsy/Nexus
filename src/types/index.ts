// Kullanıcı tipleri
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  lastSeen: Date;
  status: 'online' | 'idle' | 'dnd' | 'offline';
}

// Sunucu tipleri
export interface Server {
  id: string;
  name: string;
  description?: string;
  iconURL?: string;
  ownerId: string;
  createdAt: Date;
  memberCount: number;
  isPublic: boolean;
  isPrivate: boolean;
  requireApproval: boolean;
  serverType: 'community' | 'private' | 'gaming';
  maxMembers: number;
  inviteCode?: string;
}

// Kanal tipleri
export type ChannelType = 'text' | 'voice' | 'game';

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice' | 'category' | 'news' | 'stage' | 'forum';
  description?: string;
  position: number;
  parentId?: string; // Kategori ID'si
  topic?: string;
  nsfw?: boolean;
  rateLimitPerUser?: number; // Slowmode
  bitrate?: number; // Sesli kanallar için
  userLimit?: number; // Sesli kanallar için
  permissionOverwrites?: ChannelPermissionOverwrite[];
  createdAt: Date;
  createdBy: string;
}

// Oda tipleri - kanallar içinde alt odalar
export interface Room {
  id: string;
  channelId: string;
  serverId: string;
  name: string;
  type: 'voice' | 'video' | 'screen';
  description?: string;
  createdAt: Date;
  createdBy: string;
  maxUsers: number;
  currentUsers: string[];
  isPrivate: boolean;
  password?: string;
}

// Mesaj tipleri
export interface Message {
  id: string;
  channelId: string;
  serverId?: string;
  authorId: string;
  content: string;
  attachments?: MessageAttachment[];
  timestamp: Date;
  editedAt?: Date;
  replyTo?: string;
  reactions?: MessageReaction[];
  mentions?: string[];
  roleMentions?: string[]; // Bahsedilen rol ID'leri
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file';
  size: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

// Sunucu üyelik durumları
export type MembershipStatus = 'active' | 'pending' | 'banned' | 'kicked';

// Sunucu üyesi
export interface ServerMember {
  id: string;
  userId: string;
  serverId: string;
  joinedAt: Date;
  roles: string[];
  permissions?: any;
  user?: User;
  status: MembershipStatus;
  requestedAt?: Date;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

// Arkadaşlık
export interface Friendship {
  id: string;
  userId1: string;
  userId2: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  acceptedAt?: Date;
}

// Özel mesaj konuşması
export interface DirectMessage {
  id: string;
  participants: string[];
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}

// Yetki sistemi
export interface ServerPermissions {
  // Genel izinler
  canManageServer: boolean;
  canManageChannels: boolean;
  canManageRoles: boolean;
  canCreateInvites: boolean;
  canChangeNickname: boolean;
  canManageNicknames: boolean;
  canViewAuditLog: boolean;
  canViewServerInsights: boolean;
  
  // Üye yönetimi
  canKickMembers: boolean;
  canBanMembers: boolean;
  canTimeoutMembers: boolean;
  
  // Mesaj izinleri
  canSendMessages: boolean;
  canSendTTSMessages: boolean;
  canManageMessages: boolean;
  canEmbedLinks: boolean;
  canAttachFiles: boolean;
  canReadMessageHistory: boolean;
  canMentionEveryone: boolean;
  canUseExternalEmojis: boolean;
  canUseSlashCommands: boolean;
  canAddReactions: boolean;
  
  // Sesli kanal izinleri
  canConnect: boolean;
  canSpeak: boolean;
  canVideo: boolean;
  canUseVoiceActivity: boolean;
  canPrioritySpeak: boolean;
  canMuteMembers: boolean;
  canDeafenMembers: boolean;
  canMoveMembers: boolean;
  canUseVAD: boolean;
  canStream: boolean;
  
  // Gelişmiş izinler
  canManageWebhooks: boolean;
  canManageEmojis: boolean;
  canManageThreads: boolean;
  canCreatePublicThreads: boolean;
  canCreatePrivateThreads: boolean;
  canSendMessagesInThreads: boolean;
  canUseApplicationCommands: boolean;
  canRequestToSpeak: boolean;
}

export interface ChannelPermissions {
  canViewChannel: boolean;
  canSendMessages: boolean;
  canSendFiles: boolean;
  canReadHistory: boolean;
  canUseExternalEmojis: boolean;
  canAddReactions: boolean;
  canConnect: boolean;
  canSpeak: boolean;
  canMuteMembers: boolean;
  canDeafenMembers: boolean;
  canMoveMembers: boolean;
}

// Rol sistemi
export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string;
  permissions: ServerPermissions;
  position: number;
  mentionable: boolean;
  createdAt: Date;
  isDefault?: boolean; // @everyone rolü için
  isManaged?: boolean; // Bot rolleri için
  memberCount?: number; // Bu role sahip üye sayısı
}

// Kanal bazlı izin geçersiz kılmaları
export interface ChannelPermissionOverwrite {
  id: string; // Role ID or User ID
  type: 'role' | 'member';
  allow: Partial<ServerPermissions>;
  deny: Partial<ServerPermissions>;
}

// Audit log için
export interface AuditLogEntry {
  id: string;
  serverId: string;
  userId: string;
  targetId?: string;
  action: AuditLogAction;
  reason?: string;
  changes?: AuditLogChange[];
  timestamp: Date;
}

export enum AuditLogAction {
  // Sunucu
  SERVER_UPDATE = 'SERVER_UPDATE',
  
  // Kanallar
  CHANNEL_CREATE = 'CHANNEL_CREATE',
  CHANNEL_UPDATE = 'CHANNEL_UPDATE',
  CHANNEL_DELETE = 'CHANNEL_DELETE',
  CHANNEL_OVERWRITE_CREATE = 'CHANNEL_OVERWRITE_CREATE',
  CHANNEL_OVERWRITE_UPDATE = 'CHANNEL_OVERWRITE_UPDATE',
  CHANNEL_OVERWRITE_DELETE = 'CHANNEL_OVERWRITE_DELETE',
  
  // Üyeler
  MEMBER_KICK = 'MEMBER_KICK',
  MEMBER_BAN_ADD = 'MEMBER_BAN_ADD',
  MEMBER_BAN_REMOVE = 'MEMBER_BAN_REMOVE',
  MEMBER_UPDATE = 'MEMBER_UPDATE',
  MEMBER_ROLE_UPDATE = 'MEMBER_ROLE_UPDATE',
  MEMBER_MOVE = 'MEMBER_MOVE',
  MEMBER_DISCONNECT = 'MEMBER_DISCONNECT',
  
  // Roller
  ROLE_CREATE = 'ROLE_CREATE',
  ROLE_UPDATE = 'ROLE_UPDATE',
  ROLE_DELETE = 'ROLE_DELETE',
  
  // Davetler
  INVITE_CREATE = 'INVITE_CREATE',
  INVITE_UPDATE = 'INVITE_UPDATE',
  INVITE_DELETE = 'INVITE_DELETE',
  
  // Mesajlar
  MESSAGE_DELETE = 'MESSAGE_DELETE',
  MESSAGE_BULK_DELETE = 'MESSAGE_BULK_DELETE',
  MESSAGE_PIN = 'MESSAGE_PIN',
  MESSAGE_UNPIN = 'MESSAGE_UNPIN',
}

export interface AuditLogChange {
  key: string;
  oldValue?: any;
  newValue?: any;
}

// Sesli sohbet
export interface VoiceState {
  userId: string;
  channelId?: string;
  serverId?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSelfMuted: boolean;
  isSelfDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
}

// Bildirim tipleri
export interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'message' | 'friend_request' | 'server_invite';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  data?: any;
}

// UI State tipleri
export interface UIState {
  currentServerId?: string;
  currentChannelId?: string;
  currentDMId?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  theme: 'light' | 'dark';
}

// API Response tipleri
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Event tipleri
export interface SocketEvent {
  type: 'message' | 'user_status' | 'voice_state' | 'server_update' | 'channel_update';
  data: any;
  timestamp: Date;
} 