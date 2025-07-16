import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Chip,
  Divider,
  Button,
  Badge,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Notifications,
  PersonAdd,
  Message,
  Group,
  Settings,
  Delete,
  MarkEmailRead,
  MarkEmailUnread,
  Clear,
  FilterList,
} from '@mui/icons-material';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markNotificationAsUnread, 
  markAllNotificationsAsRead, 
  deleteNotification, 
  deleteAllNotifications,
  subscribeToNotifications,
  type Notification
} from '../services/notificationService';
import { acceptServerInvite, rejectServerInvite } from '../services/serverService';
import { acceptFriendRequest, declineFriendRequest } from '../services/userService';
import { acceptVoiceChannelInvite, declineVoiceChannelInvite } from '../services/roomInviteService';
import { useNavigate } from 'react-router-dom';

interface NotificationItem {
  id: string;
  type: 'friend_request' | 'message' | 'server_invite' | 'mention';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  avatar?: string;
  from?: string;
}

const NotificationsPage: React.FC = () => {
  const { isDarkMode } = useThemeContext();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time bildirim dinleme
  useEffect(() => {
    if (!userProfile?.uid) return;

    const unsubscribe = subscribeToNotifications(userProfile.uid, (notificationData) => {
      setNotifications(notificationData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const markAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAsUnread = async (id: string) => {
    try {
      await markNotificationAsUnread(id);
    } catch (error) {
      console.error('Error marking as unread:', error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userProfile?.uid) return;
    try {
      await markAllNotificationsAsRead(userProfile.uid);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearAll = async () => {
    if (!userProfile?.uid) return;
    try {
      await deleteAllNotifications(userProfile.uid);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const handleAcceptServerInvite = async (serverId: string, notificationId: string) => {
    if (!userProfile?.uid) return;
    try {
      const result = await acceptServerInvite(serverId, userProfile.uid);
      if (result.success) {
        // Notification otomatik olarak silinecek
        console.log('Server invite accepted successfully');
        // Sayfayı yenile veya parent component'e bildir
        window.location.reload(); // Geçici çözüm - daha sonra parent callback ile değiştirilebilir
      } else {
        console.error('Error accepting server invite:', result.error);
      }
    } catch (error) {
      console.error('Error accepting server invite:', error);
    }
  };

  const handleRejectServerInvite = async (serverId: string, notificationId: string) => {
    if (!userProfile?.uid) return;
    try {
      const result = await rejectServerInvite(serverId, userProfile.uid);
      if (result.success) {
        console.log('Server invite rejected successfully');
      } else {
        console.error('Error rejecting server invite:', result.error);
      }
    } catch (error) {
      console.error('Error rejecting server invite:', error);
    }
  };

  const handleAcceptFriendRequest = async (friendshipId: string, notificationId: string) => {
    try {
      const result = await acceptFriendRequest(friendshipId);
      if (result.success) {
        await handleDeleteNotification(notificationId);
        console.log('Friend request accepted successfully');
      } else {
        console.error('Error accepting friend request:', result.error);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleRejectFriendRequest = async (friendshipId: string, notificationId: string) => {
    try {
      const result = await declineFriendRequest(friendshipId);
      if (result.success) {
        await handleDeleteNotification(notificationId);
        console.log('Friend request rejected successfully');
      } else {
        console.error('Error rejecting friend request:', result.error);
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  // Sesli kanal davet kabul etme
  const handleAcceptVoiceChannelInvite = async (inviteId: string, notificationId: string) => {
    try {
      // Önce bildirim verilerini al
      const notification = notifications.find(n => n.id === notificationId);
      const roomId = notification?.data?.roomId;
      const serverId = notification?.data?.serverId;
      
      const result = await acceptVoiceChannelInvite(inviteId, userProfile?.uid || '');
      if (result.success) {
        await handleDeleteNotification(notificationId);
        console.log('Voice channel invite accepted successfully');
        
        // Kullanıcıyı ana sayfaya yönlendir ve oda bilgilerini parametre olarak geç
        if (roomId && serverId) {
          // URL'de parametreleri geç
          const searchParams = new URLSearchParams();
          searchParams.set('autoJoinRoom', roomId);
          searchParams.set('serverId', serverId);
          
          navigate(`/?${searchParams.toString()}`);
        } else {
          // Eğer roomId yoksa sadana ana sayfaya yönlendir
          navigate('/');
        }
      } else {
        console.error('Error accepting voice channel invite:', result.error);
        // Hata durumunda kullanıcıya bilgi ver
        alert('Davet kabul edilemedi: ' + result.error);
      }
    } catch (error) {
      console.error('Error accepting voice channel invite:', error);
    }
  };

  // Sesli kanal davet reddetme
  const handleDeclineVoiceChannelInvite = async (inviteId: string, notificationId: string) => {
    try {
      const result = await declineVoiceChannelInvite(inviteId, userProfile?.uid || '');
      if (result.success) {
        await handleDeleteNotification(notificationId);
        console.log('Voice channel invite declined successfully');
      } else {
        console.error('Error declining voice channel invite:', result.error);
      }
    } catch (error) {
      console.error('Error declining voice channel invite:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <PersonAdd />;
      case 'message':
        return <Message />;
      case 'server_invite':
        return <Group />;
      case 'mention':
        return <Notifications />;
      case 'voice_channel_invite':
        return <Typography sx={{ fontSize: '1.5rem' }}>🔊</Typography>;
      default:
        return <Notifications />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'friend_request':
        return '#5865f2';
      case 'message':
        return '#57f287';
      case 'server_invite':
        return '#fee75c';
      case 'mention':
        return '#ed4245';
      case 'voice_channel_invite':
        return '#7289da';
      default:
        return '#5865f2';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes} dakika önce`;
    } else if (hours < 24) {
      return `${hours} saat önce`;
    } else {
      return `${days} gün önce`;
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (tabValue === 0) return true; // Tümü
    if (tabValue === 1) return !notif.read; // Okunmamış
    if (tabValue === 2) return notif.read; // Okunmuş
    return true;
  });

  const unreadCount = notifications.filter(notif => !notif.read).length;

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      p: 3,
      backgroundColor: isDarkMode ? '#36393f' : '#f5f5f5',
      overflow: 'auto'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Bildirimler
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="primary" sx={{ ml: 2 }}>
              <Box />
            </Badge>
          )}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MarkEmailRead />}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Tümünü Okundu İşaretle
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Clear />}
            onClick={clearAll}
            disabled={notifications.length === 0}
            color="error"
          >
            Tümünü Temizle
          </Button>
          <IconButton onClick={handleFilterClick}>
            <FilterList />
          </IconButton>
        </Box>
      </Box>

      <Card sx={{ 
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
        mb: 2
      }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 'medium',
            },
          }}
        >
          <Tab label={`Tümü (${notifications.length})`} />
          <Tab label={`Okunmamış (${unreadCount})`} />
          <Tab label={`Okunmuş (${notifications.length - unreadCount})`} />
        </Tabs>
      </Card>

      {loading ? (
        <Card sx={{ 
          backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
          borderRadius: 2,
          p: 4,
          textAlign: 'center'
        }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Bildirimler yükleniyor...
          </Typography>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card sx={{ 
          backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
          borderRadius: 2,
          p: 4,
          textAlign: 'center'
        }}>
          <Notifications sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {tabValue === 0 ? 'Henüz bildirim yok' : 
             tabValue === 1 ? 'Okunmamış bildirim yok' : 
             'Okunmuş bildirim yok'}
          </Typography>
        </Card>
      ) : (
        <Card sx={{ 
          backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
          borderRadius: 2,
        }}>
          <List>
            {filteredNotifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    backgroundColor: !notification.read ? 'rgba(88, 101, 242, 0.1)' : 'transparent',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      backgroundColor: getNotificationColor(notification.type),
                      color: 'white'
                    }}>
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {notification.title}
                      </Typography>
                      {!notification.read && (
                        <Box sx={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%', 
                          backgroundColor: 'primary.main' 
                        }} />
                      )}
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {formatTime(notification.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {/* Sunucu davet butonları */}
                      {notification.type === 'server_invite' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={() => handleAcceptServerInvite(notification.data?.serverId!, notification.id)}
                            sx={{ minWidth: 60 }}
                          >
                            Kabul Et
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleRejectServerInvite(notification.data?.serverId!, notification.id)}
                            sx={{ minWidth: 60 }}
                          >
                            Reddet
                          </Button>
                        </>
                      )}
                      
                      {/* Arkadaş isteği butonları */}
                      {notification.type === 'friend_request' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={() => handleAcceptFriendRequest(notification.data?.friendshipId!, notification.id)}
                            sx={{ minWidth: 60 }}
                          >
                            Kabul Et
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleRejectFriendRequest(notification.data?.friendshipId!, notification.id)}
                            sx={{ minWidth: 60 }}
                          >
                            Reddet
                          </Button>
                        </>
                      )}
                      
                      {/* Sesli kanal davet butonları */}
                      {notification.type === 'voice_channel_invite' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            sx={{ 
                              minWidth: 60,
                              backgroundColor: '#43b581',
                              '&:hover': { backgroundColor: '#369868' }
                            }}
                            onClick={() => handleAcceptVoiceChannelInvite(notification.data?.inviteId!, notification.id)}
                          >
                            Katıl
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleDeclineVoiceChannelInvite(notification.data?.inviteId!, notification.id)}
                            sx={{ minWidth: 60 }}
                          >
                            Reddet
                          </Button>
                        </>
                      )}
                      
                      {/* Genel butonlar */}
                      <IconButton
                        size="small"
                        onClick={() => notification.read ? markAsUnread(notification.id) : markAsRead(notification.id)}
                      >
                        {notification.read ? <MarkEmailUnread /> : <MarkEmailRead />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteNotification(notification.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Card>
      )}

      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
      >
        <MenuItem onClick={handleFilterClose}>Arkadaş İstekleri</MenuItem>
        <MenuItem onClick={handleFilterClose}>Mesajlar</MenuItem>
        <MenuItem onClick={handleFilterClose}>Sunucu Davetleri</MenuItem>
        <MenuItem onClick={handleFilterClose}>Bahsedilmeler</MenuItem>
      </Menu>
    </Box>
  );
};

export default NotificationsPage; 