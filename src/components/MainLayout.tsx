import React from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListItemAvatar, Typography, Divider, Avatar, IconButton, Tooltip, Badge, Fab, Button, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Home, Add, Settings, Mic, MicOff, Headphones, VolumeOff, PersonAdd, Create, Group, Chat, Logout, PersonRemove, NotificationImportant, Close, OpenInFull } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { getUserServers, getUserFriends, getUserDirectMessages, deleteFriendship, getIncomingFriendRequests, acceptFriendRequest, declineFriendRequest } from '../services/userService';
import { Server, User, DirectMessage, ServerMember } from '../types';
import { ProfileDropdown } from './ProfileDropdown';
import { AddFriendDialog } from './AddFriendDialog';
import { CreateServerDialog } from './CreateServerDialog';
import { NexusLogo } from './NexusLogo';
import { DirectMessagesView } from './DirectMessagesView';
import { ServerManagementDialog } from './ServerManagementDialog';
import { ServerChannelView } from './ServerChannelView';
import { ServerInviteDialog } from './ServerInviteDialog';
import { RoomChatDialog } from './RoomChatDialog';

import { subscribeToServerMembers, getServerChannels, checkUserPermissions } from '../services/serverService';
import { getServerRoles } from '../services/roleService';
import { subscribeToNotifications, type Notification } from '../services/notificationService';
import { subscribeToChannelRooms, joinRoom, leaveRoom, getUserCurrentRoom, leaveAllRooms, subscribeToRoom } from '../services/roomService';
import { webrtcService } from '../services/webrtcService';
import { Room } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const SIDEBAR_WIDTH = 240;
const MEMBERLIST_WIDTH = 200;

const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const ServerSidebar = styled(Drawer)(({ theme }) => ({
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: SIDEBAR_WIDTH,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.mode === 'dark' ? '#2f3136' : '#f5f5f5',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
  },
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
}));

const ChannelHeader = styled(Box)(({ theme }) => ({
  height: 48,
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 2),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const ChatArea = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  backgroundColor: theme.palette.background.paper,
}));

const MessagesContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
}));

const MemberList = styled(Box)(({ theme }) => ({
  width: MEMBERLIST_WIDTH,
  backgroundColor: theme.palette.mode === 'dark' ? '#2f3136' : '#f0f0f0',
  borderLeft: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}));

const UserInfo = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  backgroundColor: theme.palette.mode === 'dark' ? '#292b2f' : '#e0e0e0',
  display: 'flex',
  alignItems: 'center',
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: 'auto',
}));

const MainLayout: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const { isDarkMode } = useThemeContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userServers, setUserServers] = React.useState<Server[]>([]);
  const [userFriends, setUserFriends] = React.useState<User[]>([]);
  const [userDMs, setUserDMs] = React.useState<DirectMessage[]>([]);
  const [currentView, setCurrentView] = React.useState<'friends' | 'dm' | 'servers' | 'page'>('friends');
  const [currentServer, setCurrentServer] = React.useState<Server | null>(null);
  const [currentChannel, setCurrentChannel] = React.useState<any>(null);
  const [serverChannels, setServerChannels] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isDeafened, setIsDeafened] = React.useState(false);
  const [addFriendDialogOpen, setAddFriendDialogOpen] = React.useState(false);
  const [createServerDialogOpen, setCreateServerDialogOpen] = React.useState(false);
  const [serverManagementOpen, setServerManagementOpen] = React.useState(false);
  const [serverInviteOpen, setServerInviteOpen] = React.useState(false);
  const [serverMembers, setServerMembers] = React.useState<ServerMember[]>([]);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [friendsTabValue, setFriendsTabValue] = React.useState(0);
  const [friendRequests, setFriendRequests] = React.useState<any[]>([]);
  const [channelRooms, setChannelRooms] = React.useState<{ [channelId: string]: Room[] }>({});
  const [currentRoom, setCurrentRoom] = React.useState<Room | null>(null);
  const [isInVoiceChannel, setIsInVoiceChannel] = React.useState(false);
  const [roomParticipants, setRoomParticipants] = React.useState<{ [userId: string]: any }>({});
  const [roomChatDialogOpen, setRoomChatDialogOpen] = React.useState(false);
  const [roomChatMinimized, setRoomChatMinimized] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [passwordDialogRoom, setPasswordDialogRoom] = React.useState<Room | null>(null);
  const [roomPassword, setRoomPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [userPermissions, setUserPermissions] = React.useState<{
    canManageServer: boolean;
    canManageChannels: boolean;
    canManageRoles: boolean;
    isOwner: boolean;
  }>({
    canManageServer: false,
    canManageChannels: false,
    canManageRoles: false,
    isOwner: false
  });
  const [serverRoles, setServerRoles] = React.useState<any[]>([]);
  
  // Modal'ın korumalı kapatılması için wrapper function
  const safeSetRoomChatMinimized = React.useCallback((value: boolean, reason?: string) => {
    console.log('🔄 Modal state changing:', value, 'reason:', reason);
    setRoomChatMinimized(value);
  }, []);
  

  const minimizeModalRef = React.useRef<HTMLDivElement>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#43b581';
    }
  };



  // Route'a göre view'ı ayarla
  React.useEffect(() => {
    if (location.pathname === '/profile' || location.pathname === '/settings' || location.pathname === '/notifications') {
      setCurrentView('page');
    } else if (location.pathname === '/') {
      setCurrentView('friends');
    }
  }, [location.pathname]);

  React.useEffect(() => {
    if (userProfile?.uid) {
      loadUserData();
      loadCurrentRoom();
    }
  }, [userProfile]);



  const loadCurrentRoom = async () => {
    if (!userProfile?.uid) return;
    
    const result = await getUserCurrentRoom(userProfile.uid);
    if (result.success && result.data) {
      setCurrentRoom(result.data);
      setIsInVoiceChannel(true);
      
      // Oda katılımcılarını yükle
      loadRoomParticipants(result.data.currentUsers);
    }
  };

  const loadRoomParticipants = async (userIds: string[]) => {
    const participants: { [userId: string]: any } = {};
    
    for (const userId of userIds) {
      // ServerMembers'dan kullanıcı bilgisini bul
      const member = serverMembers.find(m => m.userId === userId);
      if (member && member.user) {
        participants[userId] = member.user;
      }
    }
    
    setRoomParticipants(participants);
    console.log('Room participants loaded:', participants); // Debug için
  };

  // ServerMembers değiştiğinde room participants'ı yeniden yükle
  React.useEffect(() => {
    if (currentRoom && currentRoom.currentUsers && serverMembers.length > 0) {
      loadRoomParticipants(currentRoom.currentUsers);
    }
  }, [serverMembers, currentRoom]);

  // Bildirimleri dinle
  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (userProfile?.uid) {
      unsubscribe = subscribeToNotifications(userProfile.uid, (notificationData) => {
        setNotifications(notificationData);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userProfile?.uid]);

  // Sunucu üyelerini dinle
  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (currentServer?.id) {
      unsubscribe = subscribeToServerMembers(currentServer.id, (members) => {
        setServerMembers(members);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentServer?.id]);

  // Sunucu seçildiğinde kanalları ve rolleri yükle
  React.useEffect(() => {
    if (currentServer?.id) {
      loadServerChannels(currentServer.id);
      loadServerRoles(currentServer.id);
    } else {
      setServerChannels([]);
      setServerRoles([]);
      setCurrentChannel(null);
    }
  }, [currentServer?.id]);

  const loadServerRoles = async (serverId: string) => {
    try {
      const roles = await getServerRoles(serverId);
      setServerRoles(roles);
    } catch (error) {
      console.error('Error loading server roles:', error);
    }
  };

  // Kullanıcı rol bilgilerini al
  const getUserRoles = (member: ServerMember) => {
    if (!member.roles || member.roles.length === 0) return [];
    
    return member.roles.map(roleId => {
      // Özel roller
      const customRole = serverRoles.find(r => r.id === roleId);
      if (customRole) {
        return { id: roleId, name: customRole.name, color: customRole.color };
      }
      
      // Sistem rolleri
      switch (roleId) {
        case 'owner': return { id: roleId, name: 'Sahip', color: '#f04747' };
        case 'admin': return { id: roleId, name: 'Admin', color: '#ff9500' };
        case 'moderator': return { id: roleId, name: 'Moderatör', color: '#5865f2' };
        default: return { id: roleId, name: roleId, color: '#99aab5' };
      }
    });
  };

  // En yüksek rol rengini al
  const getHighestRoleColor = (member: ServerMember) => {
    const roles = getUserRoles(member);
    if (roles.length === 0) return '#99aab5';
    
    // Rol hiyerarşisine göre en yüksek rolu seç
    const roleOrder = ['owner', 'admin', 'moderator', 'member'];
    const highestSystemRole = roles.find(r => roleOrder.includes(r.id));
    if (highestSystemRole) return highestSystemRole.color;
    
    // Özel roller varsa ilkinin rengini al
    return roles[0].color;
  };

  // En yüksek rol adını al
  const getHighestRoleName = (member: ServerMember) => {
    const roles = getUserRoles(member);
    if (roles.length === 0) return 'Üye';
    
    // Rol hiyerarşisine göre en yüksek rolu seç
    const roleOrder = ['owner', 'admin', 'moderator', 'member'];
    const highestSystemRole = roles.find(r => roleOrder.includes(r.id));
    if (highestSystemRole) return highestSystemRole.name;
    
    // Özel roller varsa ilkinin adını al
    return roles[0].name;
  };

  const loadServerChannels = async (serverId: string) => {
    try {
      const channels = await getServerChannels(serverId);
      setServerChannels(channels);
      
      // Her kanal için odaları gerçek zamanlı yükle
      channels.forEach((channel: any) => {
        subscribeToChannelRooms(channel.id, (rooms: Room[]) => {
          setChannelRooms(prev => ({
            ...prev,
            [channel.id]: rooms
          }));
        });
      });
      
      // İlk kanalı seç
      if (channels.length > 0 && !currentChannel) {
        setCurrentChannel(channels[0]);
      }
    } catch (error) {
      console.error('Error loading server channels:', error);
    }
  };

  const loadUserData = async () => {
    if (!userProfile?.uid) return;
    
    setLoading(true);
    try {
      const [servers, friends, dms, friendRequests] = await Promise.all([
        getUserServers(userProfile.uid),
        getUserFriends(userProfile.uid),
        getUserDirectMessages(userProfile.uid),
        getIncomingFriendRequests(userProfile.uid),
      ]);
      
      setUserServers(servers);
      setUserFriends(friends);
      setUserDMs(dms);
      setFriendRequests(friendRequests);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Çıkış yapılırken bir hata oluştu: ' + error);
    }
  };

  const handleAddFriend = () => {
    setAddFriendDialogOpen(true);
  };

  const handleFriendAdded = () => {
    // Arkadaş listesini yenile
    loadUserData();
  };

  const handleCreateServer = () => {
    setCreateServerDialogOpen(true);
  };

  const handleServerCreated = () => {
    // Sunucu listesini yenile
    loadUserData();
  };

  const handleOpenServerManagement = () => {
    if (!currentServer || !userProfile?.uid) return;
    
    if (userPermissions.isOwner || userPermissions.canManageServer || userPermissions.canManageChannels || userPermissions.canManageRoles) {
    setServerManagementOpen(true);
    } else {
      // İzin yok - kullanıcıya bilgi ver
      console.log('Sunucu ayarlarına erişim izniniz yok');
    }
  };

  const handleOpenServerInvite = () => {
    setServerInviteOpen(true);
  };

  const handleDeleteFriendship = async (friendId: string) => {
    try {
      const result = await deleteFriendship(userProfile?.uid || '', friendId);
      if (result.success) {
        // Arkadaş listesini güncelle
        setUserFriends(prev => prev.filter(friend => friend.uid !== friendId));
      }
    } catch (error) {
      console.error('Error deleting friendship:', error);
    }
  };

  const handleJoinRoom = React.useCallback(async (room: Room, password?: string) => {
    if (!userProfile?.uid) return;
    
    try {
      // Önce diğer odalardan çık
      await leaveAllRooms(userProfile.uid);
      
      // Yeni odaya katıl
      const result = await joinRoom(room.id, userProfile.uid, password);
      if (result.success) {
        console.log('Successfully joined room:', room.name);
        setCurrentRoom(room);
        setIsInVoiceChannel(true);
        setRoomChatDialogOpen(true); // Discord tarzı pencere aç
        console.log('Room chat dialog should be open now');
        
        // Şifre dialog'unu kapat
        setPasswordDialogOpen(false);
        setPasswordDialogRoom(null);
        setRoomPassword('');
        setPasswordError('');
        
        // WebRTC service'inin mevcut ses durumunu kontrol et ve UI'yi güncelle
        setTimeout(() => {
          const mediaSettings = webrtcService.getMediaSettings();
          setIsMuted(!mediaSettings.audio);
          console.log('🎤 Updated UI mute state based on WebRTC:', !mediaSettings.audio);
        }, 1000);
        
        // Oda dinleyicisini başlat
        subscribeToRoom(room.id, (updatedRoom) => {
          if (updatedRoom) {
            setCurrentRoom(updatedRoom);
            loadRoomParticipants(updatedRoom.currentUsers);
          }
        });
        
        // İlk katılımcıları yükle
        loadRoomParticipants(room.currentUsers);
      } else {
        // Şifre gerekiyorsa dialog aç
        if ((result as any).requiresPassword) {
          setPasswordDialogRoom(room);
          setPasswordDialogOpen(true);
          setPasswordError(result.error || '');
        } else {
          console.error('Failed to join room:', result.error);
        }
      }
    } catch (error) {
      console.error('Error joining room:', error);
    }
  }, [userProfile?.uid, serverMembers]);

  // URL parametrelerini kontrol et ve otomatik oda katılımı
  React.useEffect(() => {
    const autoJoinRoomId = searchParams.get('autoJoinRoom');
    const serverId = searchParams.get('serverId');
    
    if (autoJoinRoomId && serverId && userProfile?.uid && userServers.length > 0) {
      console.log('🎯 Auto-joining room from invite:', autoJoinRoomId, 'in server:', serverId);
      
      // Sunucuyu bul
      const targetServer = userServers.find(s => s.id === serverId);
      if (targetServer) {
        setCurrentServer(targetServer);
        setCurrentView('servers');
        
        // Sunucu kanallarını yükle ve ardından odaya katıl
        loadServerChannels(serverId).then(() => {
          // Odayı bul ve katıl
          setTimeout(async () => {
            try {
              const roomDoc = await getDoc(doc(db, 'rooms', autoJoinRoomId));
              
              if (roomDoc.exists()) {
                const roomData = roomDoc.data();
                const room = {
                  id: autoJoinRoomId,
                  ...roomData,
                  createdAt: roomData.createdAt?.toDate() || new Date()
                } as Room;
                
                console.log('🎯 Found room for auto-join:', room.name);
                await handleJoinRoom(room);
              }
            } catch (error) {
              console.error('Error auto-joining room:', error);
            }
          }, 1000);
        });
      }
      
      // URL parametrelerini temizle
      setSearchParams({});
    }
  }, [searchParams, userProfile?.uid, userServers, handleJoinRoom, setSearchParams]);

  const handlePasswordSubmit = async () => {
    if (!passwordDialogRoom || !roomPassword.trim()) return;
    
    await handleJoinRoom(passwordDialogRoom, roomPassword.trim());
  };

  const handlePasswordDialogClose = () => {
    setPasswordDialogOpen(false);
    setPasswordDialogRoom(null);
    setRoomPassword('');
    setPasswordError('');
  };

  const handleLeaveRoom = async () => {
    if (!userProfile?.uid || !currentRoom) return;
    
    try {
      // Önce WebRTC bağlantısını kes
      await webrtcService.leaveRoom();
      
      const result = await leaveRoom(currentRoom.id, userProfile.uid);
      if (result.success) {
        setCurrentRoom(null);
        setIsInVoiceChannel(false);
        setRoomChatDialogOpen(false);
        safeSetRoomChatMinimized(false, 'leave room');
        setRoomParticipants({});
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  // Arkadaş isteği kabul etme
  const handleAcceptFriendRequest = async (friendshipId: string) => {
    try {
      const result = await acceptFriendRequest(friendshipId);
      if (result.success) {
        // Arkadaş isteklerini ve arkadaş listesini yeniden yükle
        loadUserData();
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  // Arkadaş isteği reddetme
  const handleDeclineFriendRequest = async (friendshipId: string) => {
    try {
      const result = await declineFriendRequest(friendshipId);
      if (result.success) {
        // Arkadaş isteklerini yeniden yükle
        if (userProfile?.uid) {
          const requests = await getIncomingFriendRequests(userProfile.uid);
          setFriendRequests(requests);
        }
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
    }
  };

  return (
    <MainContainer>
      {/* Sol Panel - Sunucular ve Kanallar */}
      <ServerSidebar variant="permanent">
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" color="primary">
              {currentView === 'friends' ? 'Arkadaşlar' : 
               currentView === 'dm' ? 'Direkt Mesajlar' : 
               currentServer?.name || 'Sunucu'}
            </Typography>
          </Box>
          
          <Divider />
          
          {/* Navigasyon Butonları */}
          <List>
            <ListItem disablePadding>
              <ListItemButton 
                selected={currentView === 'friends'}
                onClick={() => {
                  setCurrentView('friends');
                  setCurrentChannel(null);
                  setCurrentServer(null);
                }}
              >
                <ListItemIcon>
                  <Group />
                </ListItemIcon>
                <ListItemText primary="Arkadaşlar" />
                {friendRequests.length > 0 && (
                  <Badge badgeContent={friendRequests.length} color="error" />
                )}
              </ListItemButton>
            </ListItem>
            
            <ListItem disablePadding>
              <ListItemButton 
                selected={currentView === 'dm'}
                onClick={() => {
                  setCurrentView('dm');
                  setCurrentChannel(null);
                  setCurrentServer(null);
                }}
              >
                <ListItemIcon>
                  <Chat />
                </ListItemIcon>
                <ListItemText primary="Direkt Mesajlar" />
                {userDMs.length > 0 && (
                  <Badge badgeContent={userDMs.length} color="primary" />
                )}
              </ListItemButton>
            </ListItem>
            
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => {
                  if (location.pathname === '/notifications') {
                    navigate('/notifications', { replace: true });
                  } else {
                    navigate('/notifications');
                  }
                  setCurrentView('page');
                }}
              >
                <ListItemIcon>
                  <NotificationImportant />
                </ListItemIcon>
                <ListItemText primary="Bildirimler" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <Badge 
                    badgeContent={notifications.filter(n => !n.read).length} 
                    color="error" 
                  />
                )}
              </ListItemButton>
            </ListItem>
          </List>
          
          <Divider />
          
          {/* Sunucular */}
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Sunucular
            </Typography>
            <List sx={{ p: 0 }}>
            {userServers.map((server) => (
              <ListItem key={server.id} disablePadding>
                <ListItemButton 
                    selected={currentServer?.id === server.id}
                  onClick={async () => {
                    setCurrentServer(server);
                    setCurrentView('servers');
                    
                    // Kullanıcı izinlerini yükle
                    if (userProfile?.uid) {
                      try {
                        const permissions = await checkUserPermissions(server.id, userProfile.uid);
                        setUserPermissions({
                          canManageServer: permissions.canManageServer,
                          canManageChannels: permissions.canManageChannels,
                          canManageRoles: permissions.canManageRoles,
                          isOwner: permissions.isOwner
                        });
                      } catch (error) {
                        console.error('İzin yükleme hatası:', error);
                      }
                    }
                  }}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' },
                      '&.Mui-selected': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
                  }}
                >
                    <ListItemAvatar>
                      <Avatar 
                        src={server.iconURL} 
                        sx={{ width: 32, height: 32, backgroundColor: '#5865f2' }}
                      >
                      {server.name.charAt(0).toUpperCase()}
                    </Avatar>
                    </ListItemAvatar>
                  <ListItemText 
                    primary={server.name}
                      secondary={`${server.memberCount || 0} üye`}
                                          primaryTypographyProps={{ 
                      color: isDarkMode ? 'white' : 'black', 
                      fontSize: '0.9rem',
                      fontWeight: currentServer?.id === server.id ? 'bold' : 'normal'
                    }}
                    secondaryTypographyProps={{ 
                      color: 'text.secondary', 
                      fontSize: '0.8rem'
                    }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              
              {/* Sunucu Oluştur */}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={handleCreateServer}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ backgroundColor: '#43b581', width: 32, height: 32 }}>
                      <Add />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary="Sunucu Oluştur"
                    primaryTypographyProps={{ 
                      color: isDarkMode ? 'white' : 'black', 
                      fontSize: '0.9rem'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
          
          {/* Sunucu Kanalları */}
          {currentServer && currentView === 'servers' && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Kanallar
              </Typography>
              <List sx={{ p: 0 }}>
                {serverChannels.map((channel) => (
                  <Box key={channel.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={currentChannel?.id === channel.id}
                        onClick={() => {
                          setCurrentChannel(channel);
                          setCurrentView('servers');
                        }}
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' },
                          '&.Mui-selected': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
                        }}
                      >
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">
                            #
                          </Typography>
                        </ListItemIcon>
                        <ListItemText
                          primary={channel.name}
                          primaryTypographyProps={{ 
                            color: 'white', 
                            fontSize: '0.9rem',
                            fontWeight: currentChannel?.id === channel.id ? 'bold' : 'normal'
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                    
                                        {/* Kanalın odaları */}
                    {channelRooms[channel.id] && channelRooms[channel.id].length > 0 && (
                      <Box sx={{ ml: 3, mb: 1 }}>
                        {channelRooms[channel.id].map((room: Room) => (
                          <Box key={room.id}>
                            <ListItem disablePadding>
                              <ListItemButton
                                onClick={() => handleJoinRoom(room)}
                                sx={{
                                  borderRadius: 1,
                                  mb: 0.5,
                                  py: 0.5,
                                                    backgroundColor: currentRoom?.id === room.id ? '#43b581' : 'transparent',
                  '&:hover': { backgroundColor: currentRoom?.id === room.id ? '#43b581' : (isDarkMode ? '#40444b' : '#e0e0e0') }
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                  <Typography variant="body2" sx={{ 
                                    color: currentRoom?.id === room.id ? 'white' : 
                                           room.type === 'voice' ? '#43b581' : room.type === 'video' ? '#7289da' : '#faa61a',
                                    fontSize: '0.8rem'
                                  }}>
                                    {room.type === 'voice' ? '🔊' : room.type === 'video' ? '📹' : '📺'}
                                  </Typography>
                                </ListItemIcon>
                                <ListItemText
                                  primary={room.name}
                                  secondary={`${room.currentUsers.length}/${room.maxUsers} kişi`}
                                  primaryTypographyProps={{ 
                                    color: currentRoom?.id === room.id ? 'white' : 'white', 
                                    fontSize: '0.85rem',
                                    fontWeight: currentRoom?.id === room.id ? 'bold' : 'normal'
                                  }}
                                  secondaryTypographyProps={{ 
                                    color: currentRoom?.id === room.id ? 'rgba(255,255,255,0.8)' : 'text.secondary', 
                                    fontSize: '0.75rem'
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                            
                            {/* Oda katılımcıları */}
                            {room.currentUsers.length > 0 && (
                              <Box sx={{ ml: 4, mb: 1 }}>
                                {room.currentUsers.map((userId: string) => {
                                  const member = serverMembers.find(m => m.userId === userId);
                                  if (!member || !member.user) return null;
                                  
                                  return (
                                    <Box key={userId} sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 1, 
                                      py: 0.5,
                                      px: 1,
                                      borderRadius: 1,
                                      '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
                                    }}>
                                      <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        badgeContent={
                                          <Box
                                            sx={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: '50%',
                                              backgroundColor: getStatusColor(member.user.status),
                                              border: '2px solid #2f3136',
                                            }}
                                          />
                                        }
                                      >
                                        <Avatar 
                                          src={member.user.photoURL} 
                                          sx={{ 
                                            width: 20, 
                                            height: 20,
                                            border: currentRoom?.id === room.id && userId === userProfile?.uid ? '2px solid #43b581' : 'none'
                                          }}
                                        >
                                          {member.user.displayName.charAt(0).toUpperCase()}
                                        </Avatar>
                                      </Badge>
                                      <Box sx={{ flexGrow: 1 }}>
                                        <Typography 
                                          variant="body2" 
                                          sx={{ 
                                            color: getHighestRoleColor(member), 
                                            fontSize: '0.8rem',
                                            fontWeight: userId === userProfile?.uid ? 'bold' : 'normal'
                                          }}
                                        >
                                          {member.user.displayName}
                                        </Typography>
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            color: 'rgba(255,255,255,0.6)', 
                                            fontSize: '0.7rem'
                                          }}
                                        >
                                          {getHighestRoleName(member)}
                                        </Typography>
                                      </Box>
                                      {/* Konuşma göstergesi */}
                                      <Box sx={{ 
                                        width: 8, 
                                        height: 8, 
                                        borderRadius: '50%', 
                                        backgroundColor: '#43b581',
                                        display: 'none' // Şimdilik gizli, ses algılama eklenince açılacak
                                      }} />
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
            ))}
          </List>
        </Box>
          )}

        </Box>

        {/* Ses Odası Kontrolü */}
        {isInVoiceChannel && currentRoom && (
          <Box sx={{ 
            p: 2, 
            backgroundColor: '#43b581', 
            borderTop: '1px solid #40444b',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
                         <Box sx={{ flexGrow: 1 }}>
               <Typography variant="body2" color="white" sx={{ fontWeight: 'bold' }}>
                 {currentRoom.type === 'voice' ? '🔊' : currentRoom.type === 'video' ? '📹' : '📺'} {currentRoom.name}
               </Typography>
               <Typography variant="caption" color="rgba(255,255,255,0.8)">
                 {currentRoom.currentUsers.length} kişi bağlı
               </Typography>
             </Box>
            <IconButton
              onClick={async () => {
                // WebRTC service'i çağır ve state'i güncelle
                try {
                  const enabled = await webrtcService.toggleAudio();
                  setIsMuted(!enabled);
                } catch (error) {
                  console.error('Error toggling audio:', error);
                }
              }}
              sx={{ 
                color: isMuted ? '#f04747' : 'white',
                backgroundColor: isMuted ? 'rgba(240, 71, 71, 0.2)' : 'rgba(255,255,255,0.1)'
              }}
              size="small"
            >
              {isMuted ? <MicOff /> : <Mic />}
            </IconButton>
            <IconButton
              onClick={() => {
                // Deafen sadece UI state'i, WebRTC'yi etkilemez
                setIsDeafened(!isDeafened);
                
                // Tüm audio elementlerini mute/unmute et
                const audioElements = document.querySelectorAll('audio[data-user-id]');
                audioElements.forEach(audioElement => {
                  const audioEl = audioElement as HTMLAudioElement;
                  audioEl.muted = !isDeafened; // isDeafened false ise mute et, true ise unmute et
                });
              }}
              sx={{ 
                color: isDeafened ? '#f04747' : 'white',
                backgroundColor: isDeafened ? 'rgba(240, 71, 71, 0.2)' : 'rgba(255,255,255,0.1)'
              }}
              size="small"
            >
              {isDeafened ? <VolumeOff /> : <Headphones />}
            </IconButton>
            <IconButton
              onClick={handleLeaveRoom}
              sx={{ 
                color: 'white',
                backgroundColor: 'rgba(240, 71, 71, 0.8)',
                '&:hover': { backgroundColor: 'rgba(240, 71, 71, 1)' }
              }}
              size="small"
            >
              <Close />
            </IconButton>
          </Box>
        )}

        {/* Alt Panel - Profil Dropdown */}
        <UserInfo>
          <ProfileDropdown onLogout={handleLogout} />
        </UserInfo>
      </ServerSidebar>

      {/* Orta Panel - Mesajlar */}
      <ContentArea>
        <ChannelHeader>
          {currentView === 'friends' ? (
            <Typography variant="h6">👥 Arkadaşlar</Typography>
          ) : currentView === 'dm' ? (
            <Typography variant="h6">💬 Direkt Mesajlar</Typography>
          ) : currentView === 'servers' ? (
            <Typography variant="h6">🏠 {currentServer?.name || 'Sunucu'}</Typography>
          ) : currentView === 'page' ? (
            location.pathname === '/profile' ? (
              <Typography variant="h6">👤 Profil Ayarları</Typography>
            ) : location.pathname === '/settings' ? (
              <Typography variant="h6">⚙️ Ayarlar</Typography>
            ) : location.pathname === '/notifications' ? (
              <Typography variant="h6">🔔 Bildirimler</Typography>
            ) : (
              <NexusLogo size="medium" />
            )
          ) : (
            <NexusLogo size="medium" />
          )}
          {currentView === 'servers' && currentServer && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <IconButton 
                onClick={handleOpenServerInvite}
                title="Sunucuya Davet Et"
                sx={{ color: 'text.secondary' }}
              >
                <PersonAdd />
              </IconButton>
              {(userPermissions.isOwner || userPermissions.canManageServer || userPermissions.canManageChannels || userPermissions.canManageRoles) && (
            <IconButton 
              onClick={handleOpenServerManagement}
              title="Sunucu Ayarları"
                  sx={{ color: 'text.secondary' }}
            >
              <Settings />
            </IconButton>
              )}
            </Box>
          )}
        </ChannelHeader>
        
        <ChatArea>
          <MessagesContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  Yükleniyor...
                </Typography>
              </Box>
            ) : currentView === 'friends' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <Box sx={{ p: 3, borderBottom: '1px solid #40444b' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5">
                      👥 Arkadaşlar
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PersonAdd />}
                    onClick={handleAddFriend}
                    sx={{ borderRadius: 2 }}
                  >
                    Arkadaş Ekle
                  </Button>
                </Box>
                
                  {/* Tabs */}
                  <Tabs
                    value={friendsTabValue}
                    onChange={(e, newValue) => setFriendsTabValue(newValue)}
                    sx={{
                      minHeight: 36,
                      '& .MuiTab-root': {
                        minHeight: 36,
                        color: isDarkMode ? '#b9bbbe' : '#666666',
                        fontSize: '0.9rem',
                        textTransform: 'none',
                        '&.Mui-selected': { color: '#5865f2' }
                      },
                      '& .MuiTabs-indicator': { backgroundColor: '#5865f2' }
                    }}
                  >
                    <Tab label={`Arkadaşlar (${userFriends.length})`} />
                    <Tab 
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          Gelen İstekler
                          {friendRequests.length > 0 && (
                            <Badge 
                              badgeContent={friendRequests.length} 
                              color="error"
                              sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </Tabs>
                </Box>

                {/* Content */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
                  {friendsTabValue === 0 ? (
                    // Arkadaşlar Tab
                    userFriends.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Henüz arkadaşınız yok
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Arkadaş ekleyerek sohbete başlayın!
                    </Typography>
                    <Fab variant="extended" color="primary" size="medium" onClick={handleAddFriend}>
                      <PersonAdd sx={{ mr: 1 }} />
                      Arkadaş Ekle
                    </Fab>
                  </Box>
                ) : (
                  <List>
                    {userFriends.map((friend) => (
                          <ListItem key={friend.uid} sx={{ borderRadius: 2, mb: 1, backgroundColor: isDarkMode ? '#40444b' : '#f0f0f0' }}>
                            <Badge
                              overlap="circular"
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              badgeContent={
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: getStatusColor(friend.status),
                                    border: '2px solid #2f3136',
                                  }}
                                />
                              }
                            >
                              <Avatar src={friend.photoURL} sx={{ mr: 2, width: 48, height: 48 }}>
                                {friend.displayName.charAt(0).toUpperCase()}
                              </Avatar>
                            </Badge>
                            <ListItemText 
                              primary={friend.displayName}
                              secondary={
                                friend.status === 'online' ? 'Çevrimiçi' : 
                                friend.status === 'idle' ? 'Boşta' :
                                friend.status === 'dnd' ? 'Rahatsız Etmeyin' : 'Çevrimdışı'
                              }
                              primaryTypographyProps={{ color: isDarkMode ? 'white' : 'black', fontSize: '1.1rem' }}
                              secondaryTypographyProps={{ color: 'text.secondary' }}
                            />
                        <IconButton 
                          onClick={() => handleDeleteFriendship(friend.uid)} 
                          title="Arkadaşlığı Sil"
                          sx={{ 
                            color: 'error.main',
                                '&:hover': { backgroundColor: 'rgba(237, 66, 69, 0.1)' }
                          }}
                        >
                          <PersonRemove />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                    )
                  ) : (
                    // Gelen İstekler Tab
                    friendRequests.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Gelen arkadaş isteği yok
                </Typography>
                <Typography variant="body2" color="text.secondary">
                          Yeni arkadaş istekleri buraya gelecek
                </Typography>
              </Box>
            ) : (
                      <List>
                        {friendRequests.map((request) => (
                          <ListItem key={request.id} sx={{ borderRadius: 2, mb: 1, backgroundColor: isDarkMode ? '#40444b' : '#f0f0f0' }}>
                            <Avatar src={request.senderPhotoURL} sx={{ mr: 2, width: 48, height: 48 }}>
                              {request.senderName?.charAt(0).toUpperCase()}
                      </Avatar>
                    <ListItemText
                              primary={request.senderName || 'Bilinmeyen Kullanıcı'}
                              secondary={`Arkadaş isteği gönderdi • ${new Date(request.createdAt?.toDate()).toLocaleDateString('tr-TR')}`}
                              primaryTypographyProps={{ color: isDarkMode ? 'white' : 'black', fontSize: '1.1rem' }}
                              secondaryTypographyProps={{ color: 'text.secondary' }}
                    />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleAcceptFriendRequest(request.id)}
                        sx={{ 
                                  backgroundColor: '#43b581',
                                  '&:hover': { backgroundColor: '#369868' }
                                }}
                              >
                                Kabul Et
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleDeclineFriendRequest(request.id)}
                        sx={{ 
                                  color: '#f04747',
                                  borderColor: '#f04747',
                                  '&:hover': { 
                                    backgroundColor: 'rgba(240, 71, 71, 0.1)',
                                    borderColor: '#f04747'
                                  }
                                }}
                              >
                                Reddet
                              </Button>
                            </Box>
                  </ListItem>
                ))}
              </List>
                    )
                  )}
                </Box>
              </Box>
            ) : currentView === 'dm' ? (
              <DirectMessagesView 
                friends={userFriends} 
                onStartNewDM={handleAddFriend}
              />
            ) : currentView === 'servers' ? (
              <ServerChannelView 
                channel={currentChannel}
                server={currentServer}
                serverMembers={serverMembers}
              />
            ) : (
              <Outlet />
          )}
          </MessagesContainer>
        </ChatArea>
      </ContentArea>

      {/* Arkadaş Ekleme Dialog */}
      <AddFriendDialog
        open={addFriendDialogOpen}
        onClose={() => setAddFriendDialogOpen(false)}
        onFriendAdded={handleFriendAdded}
      />

      {/* Sunucu Oluşturma Dialog */}
      <CreateServerDialog
        open={createServerDialogOpen}
        onClose={() => setCreateServerDialogOpen(false)}
        onServerCreated={handleServerCreated}
      />

      {/* Sunucu Yönetim Dialog */}
      {currentServer && (
        <ServerManagementDialog
          open={serverManagementOpen}
          onClose={() => setServerManagementOpen(false)}
          server={currentServer}
          members={serverMembers}
          onServerDeleted={() => {
            setCurrentServer(null);
            setCurrentView('friends');
            loadUserData();
          }}
          onServerUpdated={() => {
            loadUserData();
            // Server members'ı yeniden yükle ki izinler güncellenir
            if (currentServer) {
              const unsubscribe = subscribeToServerMembers(currentServer.id, (members) => {
                setServerMembers(members);
              });
              return () => unsubscribe();
            }
          }}
        />
      )}

      {/* Sunucu Davet Dialog */}
      {currentServer && (
        <ServerInviteDialog
          open={serverInviteOpen}
          onClose={() => setServerInviteOpen(false)}
          server={currentServer}
          onInviteSent={() => {
            // Davet gönderildi bildirimi
          }}
        />
      )}

      {/* Sesli Oda Sohbet Dialog */}
      {currentRoom && currentServer && (
        <RoomChatDialog
          open={roomChatDialogOpen}
          onClose={() => {
            // Minimize durumunda dialog'u kapatma
            if (roomChatMinimized) {
              console.log('🚫 Dialog kapatma engellendi - minimize durumunda');
              return;
            }
            
            // Dialog kapatıldığında sadece UI state'i değiştir, WebRTC'yi koru
            setRoomChatDialogOpen(false);
            // Dialog kapatıldığında otomatik olarak minimize et
            safeSetRoomChatMinimized(true, 'dialog closed');
          }}
          onMinimize={() => safeSetRoomChatMinimized(true, 'minimize button')}
          room={currentRoom}
          server={currentServer}
          participants={roomParticipants}
          isMuted={isMuted}
          isDeafened={isDeafened}
          onToggleMute={async () => {
            // WebRTC service'i çağır ve state'i güncelle
            try {
              const enabled = await webrtcService.toggleAudio();
              setIsMuted(!enabled);
            } catch (error) {
              console.error('Error toggling audio:', error);
            }
          }}
          onToggleDeafen={() => {
            // Deafen sadece UI state'i, WebRTC'yi etkilemez
            setIsDeafened(!isDeafened);
            
            // Tüm audio elementlerini mute/unmute et
            const audioElements = document.querySelectorAll('audio[data-user-id]');
            audioElements.forEach(audioElement => {
              const audioEl = audioElement as HTMLAudioElement;
              audioEl.muted = !isDeafened; // isDeafened false ise mute et, true ise unmute et
            });
          }}
          onLeaveRoom={handleLeaveRoom}
          isMinimized={roomChatMinimized}
          serverMembers={serverMembers}
        />
      )}

      {/* Minimize edilmiş oda göstergesi */}
      {currentRoom && roomChatMinimized && (
        <Box 
          ref={minimizeModalRef}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
            borderRadius: 3,
            p: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
            minWidth: 320,
            cursor: 'default',
            userSelect: 'none', // Text seçimini engelle
            pointerEvents: 'auto' // Modal'ın tıklanabilir olduğundan emin ol
          }}
        >
          {/* Hidden audio elements container - minimize durumunda bile çalışır */}
          {/* Audio elementleri RoomChatDialog'da zaten var, burada duplike etmeyelim */}
            
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ 
              backgroundColor: '#43b581', 
              width: 40, 
              height: 40,
              fontSize: '1.2rem'
            }}>
              {currentRoom.type === 'voice' ? '🔊' : currentRoom.type === 'video' ? '📹' : '📺'}
            </Avatar>
            <Box 
              sx={{ 
                flexGrow: 1,
                cursor: 'pointer', // Oda bilgisi kısmı tıklanabilir
                borderRadius: 2,
                p: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)' // Hover efekti
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Room info clicked, expanding...');
                // Modal'ı hem aç hem de minimize durumunu kaldır
                setRoomChatDialogOpen(true);
                safeSetRoomChatMinimized(false, 'room info clicked');
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Typography variant="body1" color={isDarkMode ? 'white' : 'black'} sx={{ fontWeight: 'bold' }}>
                {currentRoom.name}
              </Typography>
              <Typography variant="body2" color={isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}>
                {currentRoom.currentUsers.length} kişi bağlı • Büyütmek için tıklayın
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🎤 Microphone button clicked');
                  // WebRTC service'i çağır ve state'i güncelle
                  try {
                    const enabled = await webrtcService.toggleAudio();
                    setIsMuted(!enabled);
                  } catch (error) {
                    console.error('Error toggling audio:', error);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                sx={{ 
                  color: isMuted ? '#f04747' : (isDarkMode ? 'white' : 'black'),
                  backgroundColor: isMuted ? 'rgba(240, 71, 71, 0.2)' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                  width: 32,
                  height: 32,
                  '&:hover': { backgroundColor: isMuted ? 'rgba(240, 71, 71, 0.3)' : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }
                }}
                size="small"
                title={isMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
              >
                {isMuted ? <MicOff sx={{ fontSize: 16 }} /> : <Mic sx={{ fontSize: 16 }} />}
              </IconButton>

              <IconButton
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('❌ Leave room button clicked');
                  handleLeaveRoom(); // Odadan çık
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                sx={{ 
                  color: 'white',
                  backgroundColor: '#f04747',
                  width: 32,
                  height: 32,
                  '&:hover': { backgroundColor: '#d73636' }
                }}
                size="small"
                title="Odadan Çık"
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      )}

      {/* Şifre Dialog */}
      <Dialog 
        open={passwordDialogOpen} 
        onClose={handlePasswordDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
            color: isDarkMode ? 'white' : 'black'
          }
        }}
      >
        <DialogTitle>Özel Oda Şifresi</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bu özel odaya katılmak için şifre gereklidir.
          </Typography>
          
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}
          
          <TextField
            autoFocus
            fullWidth
            label="Şifre"
            type="password"
            value={roomPassword}
            onChange={(e) => setRoomPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePasswordSubmit();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? '#40444b' : '#f5f5f5',
                color: isDarkMode ? 'white' : 'black',
                '& fieldset': { borderColor: isDarkMode ? '#72767d' : '#e0e0e0' },
                '&:hover fieldset': { borderColor: '#5865f2' },
                '&.Mui-focused fieldset': { borderColor: '#5865f2' },
              },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#5865f2' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordDialogClose} color="secondary">
            İptal
          </Button>
          <Button 
            onClick={handlePasswordSubmit} 
            variant="contained"
            disabled={!roomPassword.trim()}
            sx={{ backgroundColor: '#5865f2' }}
          >
            Katıl
          </Button>
        </DialogActions>
      </Dialog>

    </MainContainer>
  );
};

export default MainLayout; 