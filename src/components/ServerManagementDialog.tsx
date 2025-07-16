import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Divider,
  Tab,
  Tabs,
  Card,
  CardContent,
  Chip,
  Switch,
  FormControlLabel,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  Grid,
  Tooltip,
  Paper,
  Badge
} from '@mui/material';
import {
  Settings,
  Delete,
  Add,
  Edit,
  People,
  Tag,
  VolumeUp,
  VolumeOff,
  AdminPanelSettings,
  PersonRemove,
  Close,
  PhotoCamera,
  Security,
  History,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  PersonAdd,
  Notifications,
  Insights
} from '@mui/icons-material';
import { 
  updateServer, 
  deleteServer, 
  createChannel, 
  deleteChannel, 
  getServerChannels,
  removeServerMember,
  updateMemberRole,
  checkUserPermissions,
  changeUserRole,
  SERVER_ROLES,
  getHighestRole,
  getRoleHierarchy,
  getServerMembers,
  removeServerMember as removeServerMemberService,
  getPendingMembers,
  approvePendingMember,
  rejectPendingMember
} from '../services/serverService';
import { RoleManagementDialog } from './RoleManagementDialog';
import { getAuditLogs, getServerRoles, assignRoleToUser, removeRoleFromUser, deleteAuditLog, clearAuditLogs } from '../services/roleService';
import { uploadServerIcon } from '../services/storageService';
import { 
  createRoom, 
  deleteRoom, 
  getChannelRooms,
  subscribeToChannelRooms
} from '../services/roomService';
import { useAuth } from '../contexts/AuthContext';
import { Server, ServerMember, Room } from '../types';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

interface ServerManagementDialogProps {
  open: boolean;
  onClose: () => void;
  server: Server;
  members: ServerMember[];
  onServerDeleted?: () => void;
  onServerUpdated?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`server-tabpanel-${index}`}
      aria-labelledby={`server-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const ServerManagementDialog: React.FC<ServerManagementDialogProps> = ({
  open,
  onClose,
  server,
  members,
  onServerDeleted,
  onServerUpdated
}) => {
  const { userProfile } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Server ayarları
  const [serverName, setServerName] = useState(server.name);
  const [serverDescription, setServerDescription] = useState(server.description || '');
  const [isPublic, setIsPublic] = useState(server.isPublic);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Kanal yönetimi
  const [channels, setChannels] = useState<any[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice' | 'game'>('text');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelPermissions, setNewChannelPermissions] = useState<string[]>(['member']);
  
  // Yeni durumlar
  const [roleManagementOpen, setRoleManagementOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<ServerMember[]>([]);
  const [pendingMembersDialogOpen, setPendingMembersDialogOpen] = useState(false);
  const [serverMembers, setServerMembers] = useState<ServerMember[]>(members);
  const [createChannelDialogOpen, setCreateChannelDialogOpen] = useState(false);
  
  // Oda yönetimi
  const [rooms, setRooms] = useState<{ [channelId: string]: Room[] }>({});
  const [selectedChannelForRoom, setSelectedChannelForRoom] = useState<string>('');
  
  // Rol yönetimi
  const [serverRoles, setServerRoles] = useState<any[]>([]);
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'voice' | 'video' | 'screen'>('voice');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomMaxUsers, setNewRoomMaxUsers] = useState(10);
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  
  // Yetki kontrolü
  const [userPermissions, setUserPermissions] = useState({
    isOwner: false,
    isAdmin: false,
    canManageServer: false,
    canManageChannels: false,
    canManageRoles: false,
    canKickMembers: false,
    canBanMembers: false,
    canViewAuditLog: false,
    canViewServerInsights: false,
    roles: [] as string[]
  });

  // Subscription cleanup referansları
  const subscriptions = React.useRef<(() => void)[]>([]);

  // Sunucu üyelerini getir
  const fetchMembers = async () => {
    const members = await getServerMembers(server.id);
    setServerMembers(members);
  };

  // Pending üyeleri getir
  const fetchPendingMembers = async () => {
    const pending = await getPendingMembers(server.id);
    setPendingMembers(pending);
  };

  // Pending üye onaylama
  const handleApprovePendingMember = async (memberId: string) => {
    if (!userProfile?.uid) return;
    
    const member = pendingMembers.find(m => m.id === memberId);
    if (!member) return;
    
    setLoading(true);
    try {
      const result = await approvePendingMember(server.id, member.userId, userProfile.uid);
      if (result.success) {
        setMessage({ type: 'success', text: `${member.user?.displayName} sunucuya kabul edildi.` });
        fetchPendingMembers();
        fetchMembers();
      } else {
        setMessage({ type: 'error', text: result.error || 'Üye onaylanamadı.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Üye onaylanırken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  // Pending üye reddetme
  const handleRejectPendingMember = async (memberId: string) => {
    if (!userProfile?.uid) return;
    
    const member = pendingMembers.find(m => m.id === memberId);
    if (!member) return;
    
    setLoading(true);
    try {
      const result = await rejectPendingMember(server.id, member.userId, userProfile.uid);
      if (result.success) {
        setMessage({ type: 'success', text: `${member.user?.displayName} reddedildi.` });
        fetchPendingMembers();
      } else {
        setMessage({ type: 'error', text: result.error || 'Üye reddedilemedi.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Üye reddedilirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && userProfile?.uid) {
      loadPermissions();
      loadChannels();
      loadServerRoles();
      fetchMembers();
      fetchPendingMembers();
      if (tabValue === 5) { // Audit log sekmesi - index 5
        loadAuditLogs();
      }
    }
  }, [open, userProfile?.uid, server.id, tabValue]);

  // Cleanup subscriptions when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      subscriptions.current.forEach(unsubscribe => unsubscribe());
      subscriptions.current = [];
    };
  }, []);

  useEffect(() => {
    if (!open) {
      // Dialog kapatıldığında subscription'ları temizle
      subscriptions.current.forEach(unsubscribe => unsubscribe());
      subscriptions.current = [];
    }
  }, [open]);

  const loadPermissions = async () => {
    if (!userProfile?.uid) return;
    
    const permissions = await checkUserPermissions(server.id, userProfile.uid);
    setUserPermissions(permissions);
  };

  const loadChannels = async () => {
    const serverChannels = await getServerChannels(server.id);
    setChannels(serverChannels);
    
    // Önceki subscription'ları temizle
    subscriptions.current.forEach(unsubscribe => unsubscribe());
    subscriptions.current = [];
    
    // Her kanal için odaları gerçek zamanlı yükle
    serverChannels.forEach((channel: any) => {
      const unsubscribe = subscribeToChannelRooms(channel.id, (rooms: Room[]) => {
        setRooms(prev => ({
          ...prev,
          [channel.id]: rooms
        }));
      });
      subscriptions.current.push(unsubscribe);
    });
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await getAuditLogs(server.id);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const loadServerRoles = async () => {
    try {
      const roles = await getServerRoles(server.id);
      setServerRoles(roles);
    } catch (error) {
      console.error('Error loading server roles:', error);
    }
  };

  const loadChannelRooms = async (channelId: string) => {
    const result = await getChannelRooms(channelId);
    if (result.success) {
      setRooms(prev => ({
        ...prev,
        [channelId]: result.data || []
      }));
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIconFile(file);
      
      // Önizleme oluştur
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadIcon = async () => {
    if (!iconFile) return;
    
    setLoading(true);
    try {
      const result = await uploadServerIcon(iconFile, server.id, setUploadProgress);
      if (result.success) {
        setMessage({ type: 'success', text: 'Sunucu icon\'u başarıyla güncellendi!' });
        setIconFile(null);
        setIconPreview(null);
        setUploadProgress(0);
        onServerUpdated?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Icon yüklenirken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Icon yüklenirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateServer = async () => {
    if (!userPermissions.canManageServer) {
      setMessage({ type: 'error', text: 'Bu işlem için yetkiniz yok' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await updateServer(server.id, {
        name: serverName.trim(),
        description: serverDescription.trim(),
        isPublic
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Sunucu güncellendi!' });
        onServerUpdated?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Güncelleme başarısız' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!userPermissions.isOwner) {
      setMessage({ type: 'error', text: 'Sadece sunucu sahibi sunucuyu silebilir' });
      return;
    }

    if (!window.confirm(`"${server.name}" sunucusunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteServer(server.id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Sunucu silindi!' });
        onServerDeleted?.();
        setTimeout(() => onClose(), 1000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Silme başarısız' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!userPermissions.canManageChannels || !newChannelName.trim()) return;

    setLoading(true);
    try {
      const result = await createChannel(
        server.id,
        newChannelName.trim(),
        newChannelType,
        newChannelDescription.trim(),
        userProfile?.uid
      );

      if (result.success) {
        setMessage({ type: 'success', text: 'Kanal başarıyla oluşturuldu!' });
        setNewChannelName('');
        setNewChannelDescription('');
        setNewChannelType('text');
        setNewChannelPermissions(['member']);
        setCreateChannelDialogOpen(false);
        loadChannels();
      } else {
        setMessage({ type: 'error', text: result.error || 'Kanal oluşturulamadı' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (!userPermissions.canManageChannels) return;

    if (!window.confirm(`"${channelName}" kanalını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const result = await deleteChannel(channelId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Kanal silindi!' });
        loadChannels();
      } else {
        setMessage({ type: 'error', text: result.error || 'Kanal silinemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    }
  };

  const handleCreateRoom = async () => {
    if (!userPermissions.canManageChannels || !newRoomName.trim() || !selectedChannelForRoom) return;

    setLoading(true);
    try {
      const result = await createRoom(
        selectedChannelForRoom,
        server.id,
        newRoomName.trim(),
        newRoomType,
        newRoomDescription.trim(),
        newRoomMaxUsers,
        newRoomIsPrivate,
        newRoomPassword.trim(),
        userProfile?.uid || ''
      );

      if (result.success) {
        setMessage({ type: 'success', text: 'Oda başarıyla oluşturuldu!' });
        setNewRoomName('');
        setNewRoomDescription('');
        setNewRoomType('voice');
        setNewRoomMaxUsers(10);
        setNewRoomIsPrivate(false);
        setNewRoomPassword('');
        setCreateRoomDialogOpen(false);
        // Gerçek zamanlı subscription otomatik olarak güncelleyecek
      } else {
        setMessage({ type: 'error', text: result.error || 'Oda oluşturulamadı' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string, channelId: string) => {
    if (!userPermissions.canManageChannels) return;

    if (!window.confirm(`"${roomName}" odasını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const result = await deleteRoom(roomId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Oda silindi!' });
        // Gerçek zamanlı subscription otomatik olarak güncelleyecek
      } else {
        setMessage({ type: 'error', text: result.error || 'Oda silinemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    }
  };

  const handleKickMember = async (member: ServerMember) => {
    if (!userProfile?.uid) return;
    
    const result = await removeServerMemberService(server.id, member.userId);
    if (result.success) {
      setMessage({ type: 'success', text: `${member.user?.displayName} sunucudan atıldı.` });
      onServerUpdated?.();
    } else {
      setMessage({ type: 'error', text: result.error || 'Üye atılırken hata oluştu.' });
    }
  };

  // Rol değiştirme fonksiyonu
  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    if (!userProfile?.uid) return;
    
    setLoading(true);
    try {
      const result = await changeUserRole(server.id, targetUserId, newRole, userProfile.uid);
      if (result.success) {
        // İzinleri yeniden yükle
        loadPermissions();
        loadServerRoles();
        onServerUpdated?.();
        
        setMessage({ type: 'success', text: 'Rol başarıyla değiştirildi.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Rol değiştirirken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol değiştirirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      setLoading(true);
      await assignRoleToUser(server.id, userId, roleId, userProfile?.uid || '');
      
      // İzinleri yeniden yükle
      loadPermissions();
      loadServerRoles();
      fetchMembers(); // Üye listesini yenile
      onServerUpdated?.();
      
      setMessage({ type: 'success', text: 'Rol başarıyla atandı!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol atanırken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      setLoading(true);
      await removeRoleFromUser(server.id, userId, roleId, userProfile?.uid || '');
      
      // İzinleri yeniden yükle
      loadPermissions();
      loadServerRoles();
      fetchMembers(); // Üye listesini yenile
      onServerUpdated?.();
      
      setMessage({ type: 'success', text: 'Rol başarıyla kaldırıldı!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol kaldırılırken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAuditLog = async (logId: string) => {
    if (!window.confirm('Bu audit log kaydını silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      const result = await deleteAuditLog(logId, server.id, userProfile?.uid || '');
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Audit log kaydı başarıyla silindi!' });
        loadAuditLogs();
      } else {
        setMessage({ type: 'error', text: result.error || 'Audit log silinirken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Audit log silinirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAuditLogs = async () => {
    if (!window.confirm('Tüm audit log kayıtlarını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    try {
      setLoading(true);
      const result = await clearAuditLogs(server.id, userProfile?.uid || '');
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Tüm audit log kayıtları başarıyla temizlendi!' });
        loadAuditLogs();
      } else {
        setMessage({ type: 'error', text: result.error || 'Audit log temizlenirken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Audit log temizlenirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (roles: string[]) => {
    if (roles.includes('owner')) return '#ff6b6b';
    if (roles.includes('admin')) return '#ff9500';
    if (roles.includes('moderator')) return '#5865f2';
    
    // Özel roller için kontrol
    const customRoles = serverRoles.filter(role => roles.includes(role.id));
    if (customRoles.length > 0) {
      // En yüksek sıradaki (en düşük position değeri) rolün rengini göster
      const highestRole = customRoles.reduce((prev, current) => 
        (prev.position || 999) < (current.position || 999) ? prev : current
      );
      return highestRole.color;
    }
    
    return '#99aab5';
  };

  const getRoleText = (roles: string[]) => {
    if (roles.includes('owner')) return 'Sahip';
    if (roles.includes('admin')) return 'Admin';
    if (roles.includes('moderator')) return 'Moderatör';
    
    // Özel roller için kontrol
    const customRoles = serverRoles.filter(role => roles.includes(role.id));
    if (customRoles.length > 0) {
      // En yüksek sıradaki (en düşük position değeri) rolü göster
      const highestRole = customRoles.reduce((prev, current) => 
        (prev.position || 999) < (current.position || 999) ? prev : current
      );
      return highestRole.name;
    }
    
    return 'Üye';
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice': return <VolumeUp />;
      case 'game': return <VolumeOff />;
      default: return <Tag />;
    }
  };

  if (!userPermissions.canManageServer && !userPermissions.canManageChannels) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="error" gutterBottom>
              Yetkisiz Erişim
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bu sunucuyu yönetmek için gerekli yetkilere sahip değilsiniz.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Kapat</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      PaperProps={{
        sx: {
          backgroundColor: '#2f3136',
          borderRadius: 3,
          minHeight: '600px'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: 'white', 
        fontSize: '1.5rem', 
        fontWeight: 'bold',
        borderBottom: '1px solid #40444b',
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <Settings />
        {server.name} - Sunucu Yönetimi
        <Box sx={{ ml: 'auto' }}>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: '#40444b' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': { color: 'text.secondary' },
            '& .MuiTab-root.Mui-selected': { color: '#5865f2' },
            '& .MuiTabs-indicator': { backgroundColor: '#5865f2' }
          }}
        >
          <Tab label="Genel Ayarlar" />
          <Tab label="Kanallar" />
          <Tab label="Üyeler" />
          <Tab label="Bekleyen Üyeler" />
          {userPermissions.canManageRoles && <Tab label="Rol Yönetimi" />}
          {userPermissions.canViewAuditLog && <Tab label="Audit Log" />}
          {userPermissions.canViewServerInsights && <Tab label="İstatistikler" />}
          {userPermissions.isOwner && <Tab label="Tehlikeli Zone" />}
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {message && (
          <Alert severity={message.type} sx={{ m: 3, borderRadius: 2 }}>
            {message.text}
          </Alert>
        )}

        {/* Genel Ayarlar */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" color="white" gutterBottom>
            Sunucu Bilgileri
          </Typography>
          
          {/* Server Icon Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" color="white" gutterBottom>
              Sunucu İconu
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="server-icon-upload"
                  disabled={!userPermissions.canManageServer}
                />
                <label htmlFor="server-icon-upload">
                  <Avatar 
                    src={iconPreview || server.iconURL || undefined}
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      fontSize: '2rem',
                      backgroundColor: '#5865f2',
                      color: 'white',
                      cursor: userPermissions.canManageServer ? 'pointer' : 'default',
                      transition: 'opacity 0.2s',
                      '&:hover': {
                        opacity: userPermissions.canManageServer ? 0.8 : 1
                      }
                    }}
                  >
                    {(iconPreview || server.iconURL) ? null : server.name.charAt(0).toUpperCase()}
                  </Avatar>
                </label>
                {userPermissions.canManageServer && (
                  <IconButton
                    sx={{
                      position: 'absolute',
                      bottom: -5,
                      right: -5,
                      backgroundColor: '#5865f2',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: '#4752c4',
                      },
                    }}
                    component="label"
                    htmlFor="server-icon-upload"
                    size="small"
                  >
                    <PhotoCamera fontSize="small" />
                  </IconButton>
                )}
              </Box>
              
              {iconFile && (
                <Box>
                  <Typography variant="body2" color="white" gutterBottom>
                    Seçilen dosya: {iconFile.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleUploadIcon}
                      disabled={loading}
                      sx={{ backgroundColor: '#5865f2' }}
                    >
                      {loading ? 'Yükleniyor...' : 'Yükle'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setIconFile(null);
                        setIconPreview(null);
                      }}
                      disabled={loading}
                    >
                      İptal
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Yükleniyor... {Math.round(uploadProgress)}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={uploadProgress} 
                  sx={{ 
                    backgroundColor: '#40444b',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#5865f2'
                    }
                  }}
                />
              </Box>
            )}
          </Box>
          
          <TextField
            fullWidth
            label="Sunucu Adı"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            disabled={!userPermissions.canManageServer}
            sx={{ mb: 3 }}
          />
          
          <TextField
            fullWidth
            label="Açıklama"
            value={serverDescription}
            onChange={(e) => setServerDescription(e.target.value)}
            multiline
            rows={3}
            disabled={!userPermissions.canManageServer}
            sx={{ mb: 3 }}
          />
          
          <FormControlLabel
            control={
              <Switch 
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={!userPermissions.canManageServer}
              />
            }
            label="Herkese Açık Sunucu"
            sx={{ color: 'white', mb: 3 }}
          />
          
          {userPermissions.canManageServer && (
            <Button
              variant="contained"
              onClick={handleUpdateServer}
              disabled={loading}
              sx={{ backgroundColor: '#5865f2' }}
            >
              {loading ? 'Güncelleniyor...' : 'Güncelle'}
            </Button>
          )}
        </TabPanel>

        {/* Kanallar */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" color="white">
              Kanallar ({channels.length})
            </Typography>
            {userPermissions.canManageChannels && (
              <Button
                startIcon={<Add />}
                variant="contained"
                size="small"
                sx={{ 
                  backgroundColor: '#5865f2',
                  '&:hover': {
                    backgroundColor: '#4752c4'
                  },
                  zIndex: 1
                }}
                onClick={() => setCreateChannelDialogOpen(true)}
              >
                Kanal Ekle
              </Button>
            )}
          </Box>

          <List>
            {channels.map((channel) => (
              <Box key={channel.id} sx={{ mb: 2 }}>
              <ListItem 
                sx={{ 
                  backgroundColor: '#40444b', 
                  borderRadius: 2, 
                  color: 'white'
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: '#5865f2' }}>
                    {getChannelIcon(channel.type)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={channel.name}
                  secondary={channel.description || `${channel.type} kanalı`}
                  primaryTypographyProps={{ color: 'white' }}
                  secondaryTypographyProps={{ color: 'text.secondary' }}
                />
                {userPermissions.canManageChannels && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        onClick={() => {
                          setSelectedChannelForRoom(channel.id);
                          setCreateRoomDialogOpen(true);
                        }}
                        sx={{ color: '#5865f2' }}
                        title="Oda Ekle"
                      >
                        <Add />
                      </IconButton>
                  <IconButton
                    onClick={() => handleDeleteChannel(channel.id, channel.name)}
                    sx={{ color: 'error.main' }}
                        title="Kanalı Sil"
                  >
                    <Delete />
                      </IconButton>
                    </Box>
                  )}
                </ListItem>

                {/* Kanalın odaları */}
                {rooms[channel.id] && rooms[channel.id].length > 0 && (
                  <Box sx={{ ml: 6, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Sesli Odalar:
                    </Typography>
                    {rooms[channel.id].map((room) => (
                      <ListItem 
                        key={room.id}
                        sx={{ 
                          backgroundColor: '#36393f', 
                          borderRadius: 1, 
                          mb: 1,
                          color: 'white',
                          py: 1
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ 
                            backgroundColor: room.type === 'voice' ? '#43b581' : room.type === 'video' ? '#7289da' : '#faa61a',
                            width: 32,
                            height: 32
                          }}>
                            {room.type === 'voice' ? '🔊' : room.type === 'video' ? '📹' : '📺'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={room.name}
                          secondary={`${room.currentUsers.length}/${room.maxUsers} kişi ${room.isPrivate ? '🔒' : ''}`}
                          primaryTypographyProps={{ color: 'white', fontSize: '0.9rem' }}
                          secondaryTypographyProps={{ color: 'text.secondary', fontSize: '0.8rem' }}
                        />
                        {userPermissions.canManageChannels && (
                          <IconButton
                            onClick={() => handleDeleteRoom(room.id, room.name, channel.id)}
                            sx={{ color: 'error.main' }}
                            size="small"
                          >
                            <Delete fontSize="small" />
                  </IconButton>
                )}
              </ListItem>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </List>
        </TabPanel>

        {/* Üyeler */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" color="white" gutterBottom>
            Sunucu Üyeleri ({members.length})
          </Typography>

          <List>
            {members.map((member) => (
              <ListItem 
                key={member.id}
                sx={{ 
                  backgroundColor: '#40444b', 
                  borderRadius: 2, 
                  mb: 1,
                  color: 'white'
                }}
              >
                <ListItemAvatar>
                  <Avatar src={member.user?.photoURL} sx={{ width: 40, height: 40 }}>
                    {member.user?.displayName?.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.user?.displayName}
                  secondary={`Katılım: ${member.joinedAt.toLocaleDateString('tr-TR')}`}
                  primaryTypographyProps={{ color: 'white' }}
                  secondaryTypographyProps={{ color: 'text.secondary' }}
                />
                <Chip
                  label={getRoleText(member.roles)}
                  size="small"
                  sx={{ 
                    backgroundColor: getRoleColor(member.roles),
                    color: 'white',
                    mr: 1
                  }}
                />
                {userPermissions.isAdmin && !member.roles.includes('owner') && member.userId !== userProfile?.uid && (
                  <IconButton
                    onClick={() => handleKickMember(member)}
                    sx={{ color: 'error.main' }}
                  >
                    <PersonRemove />
                  </IconButton>
                )}
              </ListItem>
            ))}
          </List>
        </TabPanel>

        {/* Bekleyen Üyeler */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" color="white">
              Bekleyen Üyeler ({pendingMembers.length})
            </Typography>
            {userPermissions.canManageServer && (
              <Button
                startIcon={<PersonAdd />}
                variant="contained"
                size="small"
                sx={{ 
                  backgroundColor: '#5865f2',
                  '&:hover': {
                    backgroundColor: '#4752c4'
                  },
                  zIndex: 1
                }}
                onClick={() => setPendingMembersDialogOpen(true)}
              >
                Yeni Üye Ekle
              </Button>
            )}
          </Box>

          <List>
            {pendingMembers.map((member) => (
              <ListItem 
                key={member.id}
                sx={{ 
                  backgroundColor: '#40444b', 
                  borderRadius: 2, 
                  mb: 1,
                  color: 'white'
                }}
              >
                <ListItemAvatar>
                  <Avatar src={member.user?.photoURL} sx={{ width: 40, height: 40 }}>
                    {member.user?.displayName?.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.user?.displayName}
                                     secondary={`Beklemede: ${member.requestedAt?.toLocaleDateString('tr-TR') || 'Tarih bilinmiyor'}`}
                  primaryTypographyProps={{ color: 'white' }}
                  secondaryTypographyProps={{ color: 'text.secondary' }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Onayla">
                    <IconButton
                      onClick={() => handleApprovePendingMember(member.id)}
                      sx={{ color: '#57f287' }}
                      disabled={loading}
                    >
                      <CheckCircle />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reddet">
                    <IconButton
                      onClick={() => handleRejectPendingMember(member.id)}
                      sx={{ color: '#ed4245' }}
                      disabled={loading}
                    >
                      <Cancel />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        {/* Rol Yönetimi */}
        {userPermissions.canManageRoles && (
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h6" color="white" gutterBottom>
                  Rol Yönetimi
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sunucu üyelerinin yetkilerini yönetin.
                </Typography>
              </Box>
              <Button
                startIcon={<Security />}
                variant="contained"
                onClick={() => setRoleManagementOpen(true)}
                sx={{ backgroundColor: '#5865f2' }}
              >
                Rol Ayarları
              </Button>
            </Box>

            <List>
              {serverMembers.map((member) => {
                if (!member.user) return null;
                
                const memberHighestRole = getHighestRole(member.roles || []);
                const userHighestRole = getHighestRole(userPermissions.roles || []);
                
                return (
                  <ListItem 
                    key={member.id}
                    sx={{ 
                      backgroundColor: '#40444b', 
                      borderRadius: 2, 
                      mb: 1,
                      color: 'white',
                      position: 'relative'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar src={member.user.photoURL} sx={{ width: 48, height: 48 }}>
                        {member.user.displayName.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" color="white">
                        {member.user.displayName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        <Chip
                          label={getRoleText(member.roles)}
                          size="small"
                          sx={{
                            backgroundColor: getRoleColor(member.roles),
                            color: 'white',
                            fontSize: '0.75rem',
                            height: 20
                          }}
                        />
                      </Box>
                    </Box>
                    {/* Rol değiştirme butonları - sadece yetkili kullanıcılar için */}
                    {getRoleHierarchy(userHighestRole) > getRoleHierarchy(memberHighestRole) && member.userId !== userProfile?.uid && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {/* Sistem Rolleri */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {memberHighestRole !== SERVER_ROLES.ADMIN && getRoleHierarchy(userHighestRole) > getRoleHierarchy(SERVER_ROLES.ADMIN) && (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={loading}
                              onClick={() => handleRoleChange(member.userId, SERVER_ROLES.ADMIN)}
                              sx={{ 
                                color: '#7289da', 
                                borderColor: '#7289da',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: '#7289da20',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 2px 8px #7289da40'
                                },
                                '&:active': {
                                  transform: 'translateY(0px)'
                                }
                              }}
                            >
                              {loading ? <CircularProgress size={12} color="inherit" /> : 'Admin Yap'}
                            </Button>
                          )}
                          {memberHighestRole !== SERVER_ROLES.MODERATOR && getRoleHierarchy(userHighestRole) > getRoleHierarchy(SERVER_ROLES.MODERATOR) && (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={loading}
                              onClick={() => handleRoleChange(member.userId, SERVER_ROLES.MODERATOR)}
                              sx={{ 
                                color: '#f47b67', 
                                borderColor: '#f47b67',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: '#f47b6720',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 2px 8px #f47b6740'
                                },
                                '&:active': {
                                  transform: 'translateY(0px)'
                                }
                              }}
                            >
                              {loading ? <CircularProgress size={12} color="inherit" /> : 'Moderator Yap'}
                            </Button>
                          )}
                          {memberHighestRole !== SERVER_ROLES.MEMBER && (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={loading}
                              onClick={() => handleRoleChange(member.userId, SERVER_ROLES.MEMBER)}
                              sx={{ 
                                color: '#99aab5', 
                                borderColor: '#99aab5',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: '#99aab520',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 2px 8px #99aab540'
                                },
                                '&:active': {
                                  transform: 'translateY(0px)'
                                }
                              }}
                            >
                              {loading ? <CircularProgress size={12} color="inherit" /> : 'Üye Yap'}
                            </Button>
                          )}
                        </Box>
                        
                        {/* Özel Roller */}
                        {serverRoles.filter(role => !role.isDefault).length > 0 && (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                              Özel Roller:
                            </Typography>
                            {serverRoles.filter(role => !role.isDefault).map((role) => (
                              <Box key={role.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant={member.roles.includes(role.id) ? "contained" : "outlined"}
                                  disabled={loading}
                                  onClick={() => {
                                    if (member.roles.includes(role.id)) {
                                      handleRemoveRole(member.userId, role.id);
                                    } else {
                                      handleAssignRole(member.userId, role.id);
                                    }
                                  }}
                                  sx={{ 
                                    color: member.roles.includes(role.id) ? 'white' : role.color,
                                    borderColor: role.color,
                                    backgroundColor: member.roles.includes(role.id) ? role.color : 'transparent',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      backgroundColor: member.roles.includes(role.id) ? role.color : `${role.color}20`,
                                      transform: 'translateY(-1px)',
                                      boxShadow: `0 2px 8px ${role.color}40`
                                    },
                                    '&:active': {
                                      transform: 'translateY(0px)'
                                    },
                                    fontSize: '0.75rem',
                                    minWidth: 'auto',
                                    px: 1
                                  }}
                                >
                                  {loading ? <CircularProgress size={10} color="inherit" /> : (
                                    member.roles.includes(role.id) ? `${role.name} ✓` : `+ ${role.name}`
                                  )}
                                </Button>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </TabPanel>
        )}

        {/* Audit Log */}
        {userPermissions.canViewAuditLog && (
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="white">
              <History sx={{ mr: 1 }} />
              Audit Log
            </Typography>
              {auditLogs.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Delete />}
                  onClick={handleClearAuditLogs}
                  disabled={loading}
                >
                  Tümünü Temizle
                </Button>
              )}
            </Box>
            
            {auditLogs.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Henüz audit log kaydı bulunmuyor.
                </Typography>
              </Box>
            ) : (
            <List>
              {auditLogs.map((log, index) => {
                const getActionIcon = (action: string) => {
                  switch (action) {
                    case 'ROLE_ASSIGNED':
                    case 'ROLE_REMOVED':
                    case 'ROLE_UPDATED':
                    case 'ROLE_UPDATE':
                      return <AdminPanelSettings />;
                    case 'MEMBER_KICKED':
                    case 'MEMBER_BANNED':
                      return <PersonRemove />;
                    case 'CHANNEL_CREATED':
                    case 'CHANNEL_DELETED':
                      return <Tag />;
                    case 'SERVER_UPDATED':
                    case 'PERMISSION_UPDATED':
                      return <Settings />;
                    case 'AUDIT_LOG_DELETED':
                    case 'AUDIT_LOG_CLEARED':
                      return <Delete />;
                    default:
                      return <History />;
                  }
                };

                const getActionColor = (action: string) => {
                  switch (action) {
                    case 'ROLE_ASSIGNED':
                    case 'CHANNEL_CREATED':
                      return '#57f287';
                    case 'ROLE_REMOVED':
                    case 'MEMBER_KICKED':
                    case 'MEMBER_BANNED':
                    case 'CHANNEL_DELETED':
                    case 'AUDIT_LOG_DELETED':
                    case 'AUDIT_LOG_CLEARED':
                      return '#ed4245';
                    case 'ROLE_UPDATED':
                    case 'ROLE_UPDATE':
                    case 'SERVER_UPDATED':
                    case 'PERMISSION_UPDATED':
                      return '#fee75c';
                    default:
                      return '#99aab5';
                  }
                };

                const getActionText = (action: string) => {
                  switch (action) {
                    case 'ROLE_ASSIGNED':
                      return 'Rol Atandı';
                    case 'ROLE_REMOVED':
                      return 'Rol Kaldırıldı';
                    case 'ROLE_UPDATED':
                    case 'ROLE_UPDATE':
                      return 'Rol Güncellendi';
                    case 'MEMBER_KICKED':
                      return 'Üye Atıldı';
                    case 'MEMBER_BANNED':
                      return 'Üye Yasaklandı';
                    case 'CHANNEL_CREATED':
                      return 'Kanal Oluşturuldu';
                    case 'CHANNEL_DELETED':
                      return 'Kanal Silindi';
                    case 'SERVER_UPDATED':
                      return 'Sunucu Güncellendi';
                    case 'PERMISSION_UPDATED':
                      return 'İzin Güncellendi';
                    case 'AUDIT_LOG_DELETED':
                      return 'Audit Log Silindi';
                    case 'AUDIT_LOG_CLEARED':
                      return 'Audit Log Temizlendi';
                    default:
                      return 'Bilinmeyen İşlem';
                  }
                };

                const getActionDetails = (log: any) => {
                  const action = String(log.action || '');
                  const details = String(log.details || '');
                    
                    switch (action) {
                      case 'ROLE_ASSIGNED':
                        return details ? `Atanan rol: ${details}` : 'Bir rol atandı';
                      case 'ROLE_REMOVED':
                        return details ? `Kaldırılan rol: ${details}` : 'Bir rol kaldırıldı';
                      case 'ROLE_UPDATED':
                      case 'ROLE_UPDATE':
                        return details ? `Güncellenen rol: ${details}` : 'Rol izinleri güncellendi';
                      case 'MEMBER_KICKED':
                        return details ? `Sebep: ${details}` : 'Üye sunucudan atıldı';
                      case 'MEMBER_BANNED':
                        return details ? `Sebep: ${details}` : 'Üye sunucudan yasaklandı';
                      case 'CHANNEL_CREATED':
                        return details ? `Kanal: ${details}` : 'Yeni kanal oluşturuldu';
                      case 'CHANNEL_DELETED':
                        return details ? `Kanal: ${details}` : 'Kanal silindi';
                      case 'SERVER_UPDATED':
                        return details ? `Değişiklik: ${details}` : 'Sunucu ayarları güncellendi';
                      case 'PERMISSION_UPDATED':
                        return details ? `İzin: ${details}` : 'İzinler güncellendi';
                      case 'AUDIT_LOG_DELETED':
                        return details ? `${details}` : 'Audit log kaydı silindi';
                      case 'AUDIT_LOG_CLEARED':
                        return details ? `${details}` : 'Tüm audit log kayıtları temizlendi';
                      default:
                        return details || 'Detay bulunmuyor';
                    }
                  };

                  return (
                <ListItem 
                  key={index}
                  sx={{ 
                    backgroundColor: '#40444b', 
                    borderRadius: 2, 
                    mb: 1,
                        color: 'white',
                        border: `1px solid ${getActionColor(String(log.action || ''))}20`
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ 
                          backgroundColor: `${getActionColor(String(log.action || ''))}20`,
                          color: getActionColor(String(log.action || ''))
                        }}>
                          {getActionIcon(String(log.action || ''))}
                        </Avatar>
                      </ListItemAvatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" color="white" sx={{ fontWeight: 'bold' }}>
                          {getActionText(String(log.action || ''))}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {getActionDetails(log)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {log.timestamp?.toLocaleString('tr-TR')} • {String(log.userId || 'Bilinmeyen')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={getActionText(String(log.action || ''))}
                          size="small"
                          sx={{
                            backgroundColor: getActionColor(String(log.action || '')),
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAuditLog(log.id)}
                          disabled={loading}
                          sx={{ color: '#ed4245' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                </ListItem>
                  );
                })}
            </List>
            )}
          </TabPanel>
        )}

        {/* İstatistikler */}
        {userPermissions.canViewServerInsights && (
          <TabPanel value={tabValue} index={6}>
            <Typography variant="h6" color="white" gutterBottom>
              <Insights sx={{ mr: 1 }} />
              Sunucu İstatistikleri
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card sx={{ backgroundColor: '#40444b' }}>
                  <CardContent>
                    <Typography variant="h6" color="white" gutterBottom>
                      Genel Bilgiler
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Toplam Üye: {members.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Toplam Kanal: {channels.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sunucu Yaşı: {Math.floor((new Date().getTime() - (server.createdAt instanceof Date ? server.createdAt.getTime() : (server.createdAt as any).toDate().getTime())) / (1000 * 60 * 60 * 24))} gün
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card sx={{ backgroundColor: '#40444b' }}>
                  <CardContent>
                    <Typography variant="h6" color="white" gutterBottom>
                      Üye Dağılımı
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {Object.entries(
                        members.reduce((acc, member) => {
                          const role = getRoleText(member.roles);
                          acc[role] = (acc[role] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([role, count]) => (
                        <Box key={role} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            {role}:
                          </Typography>
                          <Typography variant="body2" color="white">
                            {count}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        )}

        {/* Tehlikeli Zone */}
        {userPermissions.isOwner && (
          <TabPanel value={tabValue} index={7}>
            <Typography variant="h6" color="error" gutterBottom>
              ⚠️ Tehlikeli İşlemler
            </Typography>
            
            <Card sx={{ backgroundColor: '#40444b', mb: 3 }}>
              <CardContent>
                <Typography variant="h6" color="white" gutterBottom>
                  Sunucu Silme
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Bu işlem geri alınamaz. Sunucu ve tüm verileri kalıcı olarak silinir.
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDeleteServer}
                  disabled={loading}
                  sx={{ 
                    backgroundColor: '#ed4245',
                    '&:hover': { backgroundColor: '#c73e41' }
                  }}
                >
                  {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                  Sunucuyu Sil
                </Button>
              </CardContent>
            </Card>
          </TabPanel>
        )}
      </DialogContent>
      
      {/* Kanal Oluşturma Dialog */}
      <Dialog
        open={createChannelDialogOpen}
        onClose={() => setCreateChannelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#2f3136',
            borderRadius: 3
          }
        }}
        disablePortal={false}
        disableEnforceFocus={false}
        disableAutoFocus={false}
      >
        <DialogTitle sx={{ 
          color: 'white', 
          fontSize: '1.2rem', 
          fontWeight: 'bold',
          borderBottom: '1px solid #40444b'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Add />
            Yeni Kanal Oluştur
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Sunucunuza yeni bir kanal ekleyin
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Kanal Adı"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            disabled={loading}
            sx={{ 
              mb: 3,
              '& .MuiInputBase-root': {
                backgroundColor: '#40444b',
                color: 'white'
              },
              '& .MuiInputLabel-root': {
                color: '#99aab5'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#40444b'
                },
                '&:hover fieldset': {
                  borderColor: '#5865f2'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865f2'
                }
              }
            }}
            placeholder="genel-sohbet"
            autoFocus
          />

          <FormControl fullWidth sx={{ 
            mb: 3,
            '& .MuiInputLabel-root': {
              color: '#99aab5'
            },
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#40444b',
              color: 'white',
              '& fieldset': {
                borderColor: '#40444b'
              },
              '&:hover fieldset': {
                borderColor: '#5865f2'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#5865f2'
              }
            }
          }}>
            <InputLabel>Kanal Türü</InputLabel>
            <Select
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value as 'text' | 'voice' | 'game')}
              label="Kanal Türü"
              disabled={loading}
              MenuProps={{ disablePortal: false }}
            >
              <MenuItem value="text">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  # Metin Kanalı
                </Box>
              </MenuItem>
              <MenuItem value="voice">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔊 Ses Kanalı
                </Box>
              </MenuItem>
              <MenuItem value="game">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🎮 Oyun Kanalı
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Açıklama (İsteğe bağlı)"
            value={newChannelDescription}
            onChange={(e) => setNewChannelDescription(e.target.value)}
            disabled={loading}
            multiline
            rows={2}
            sx={{ 
              mb: 3,
              '& .MuiInputBase-root': {
                backgroundColor: '#40444b',
                color: 'white'
              },
              '& .MuiInputLabel-root': {
                color: '#99aab5'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#40444b'
                },
                '&:hover fieldset': {
                  borderColor: '#5865f2'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865f2'
                }
              }
            }}
            placeholder="Bu kanal hakkında kısa bir açıklama..."
          />

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="white" gutterBottom>
              Kanal Yetkileri
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Bu kanala kimler erişebilir?
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newChannelPermissions.includes('member')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewChannelPermissions([...newChannelPermissions, 'member']);
                      } else {
                        setNewChannelPermissions(newChannelPermissions.filter(p => p !== 'member'));
                      }
                    }}
                    sx={{ color: '#99aab5' }}
                  />
                }
                label="Tüm Üyeler"
                sx={{ color: 'white' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newChannelPermissions.includes('moderator')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewChannelPermissions([...newChannelPermissions, 'moderator']);
                      } else {
                        setNewChannelPermissions(newChannelPermissions.filter(p => p !== 'moderator'));
                      }
                    }}
                    sx={{ color: '#f47b67' }}
                  />
                }
                label="Sadece Moderatörler ve Üstü"
                sx={{ color: 'white' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newChannelPermissions.includes('admin')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewChannelPermissions([...newChannelPermissions, 'admin']);
                      } else {
                        setNewChannelPermissions(newChannelPermissions.filter(p => p !== 'admin'));
                      }
                    }}
                    sx={{ color: '#7289da' }}
                  />
                }
                label="Sadece Adminler ve Sahibi"
                sx={{ color: 'white' }}
              />
            </FormGroup>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid #40444b' }}>
          <Button 
            onClick={() => setCreateChannelDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
            disabled={loading}
          >
            İptal
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateChannel}
            disabled={loading || !newChannelName.trim()}
            sx={{ 
              backgroundColor: '#5865f2',
              '&:hover': {
                backgroundColor: '#4752c4'
              },
              '&:disabled': {
                backgroundColor: '#4f545c'
              }
            }}
          >
            {loading ? 'Oluşturuluyor...' : 'Kanal Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Oda Oluşturma Dialog */}
      <Dialog
        open={createRoomDialogOpen}
        onClose={() => setCreateRoomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#2f3136',
            borderRadius: 3
          }
        }}
        disablePortal={false}
        disableEnforceFocus={false}
        disableAutoFocus={false}
      >
        <DialogTitle sx={{ 
          color: 'white', 
          fontSize: '1.2rem', 
          fontWeight: 'bold',
          borderBottom: '1px solid #40444b'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeUp />
            Yeni Sesli Oda Oluştur
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Kanala yeni bir sesli oda ekleyin
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Oda Adı"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            disabled={loading}
            sx={{ 
              mb: 3,
              '& .MuiInputBase-root': {
                backgroundColor: '#40444b',
                color: 'white'
              },
              '& .MuiInputLabel-root': {
                color: '#99aab5'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#40444b'
                },
                '&:hover fieldset': {
                  borderColor: '#5865f2'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865f2'
                }
              }
            }}
            placeholder="Genel Sesli"
            autoFocus
          />

          <FormControl fullWidth sx={{ 
            mb: 3,
            '& .MuiInputLabel-root': {
              color: '#99aab5'
            },
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#40444b',
              color: 'white',
              '& fieldset': {
                borderColor: '#40444b'
              },
              '&:hover fieldset': {
                borderColor: '#5865f2'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#5865f2'
              }
            }
          }}>
            <InputLabel>Oda Türü</InputLabel>
            <Select
              value={newRoomType}
              onChange={(e) => setNewRoomType(e.target.value as 'voice' | 'video' | 'screen')}
              label="Oda Türü"
              disabled={loading}
              MenuProps={{ disablePortal: false }}
            >
              <MenuItem value="voice">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔊 Sesli Oda
                </Box>
              </MenuItem>
              <MenuItem value="video">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  📹 Videolu Oda
                </Box>
              </MenuItem>
              <MenuItem value="screen">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  📺 Ekran Paylaşımı
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Açıklama (İsteğe bağlı)"
            value={newRoomDescription}
            onChange={(e) => setNewRoomDescription(e.target.value)}
            disabled={loading}
            multiline
            rows={2}
            sx={{ 
              mb: 3,
              '& .MuiInputBase-root': {
                backgroundColor: '#40444b',
                color: 'white'
              },
              '& .MuiInputLabel-root': {
                color: '#99aab5'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#40444b'
                },
                '&:hover fieldset': {
                  borderColor: '#5865f2'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865f2'
                }
              }
            }}
            placeholder="Bu oda hakkında kısa bir açıklama..."
          />

          <TextField
            fullWidth
            label="Maksimum Kullanıcı Sayısı"
            type="number"
            value={newRoomMaxUsers}
            onChange={(e) => setNewRoomMaxUsers(parseInt(e.target.value) || 10)}
            disabled={loading}
            sx={{ 
              mb: 3,
              '& .MuiInputBase-root': {
                backgroundColor: '#40444b',
                color: 'white'
              },
              '& .MuiInputLabel-root': {
                color: '#99aab5'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#40444b'
                },
                '&:hover fieldset': {
                  borderColor: '#5865f2'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865f2'
                }
              }
            }}
            inputProps={{ min: 1, max: 50 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={newRoomIsPrivate}
                onChange={(e) => setNewRoomIsPrivate(e.target.checked)}
                sx={{ 
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#5865f2'
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#5865f2'
                  }
                }}
              />
            }
            label="Özel Oda (Şifre gerekli)"
            sx={{ color: 'white', mb: 2 }}
          />

          {newRoomIsPrivate && (
            <TextField
              fullWidth
              label="Oda Şifresi"
              type="password"
              value={newRoomPassword}
              onChange={(e) => setNewRoomPassword(e.target.value)}
              disabled={loading}
              sx={{ 
                mb: 3,
                '& .MuiInputBase-root': {
                  backgroundColor: '#40444b',
                  color: 'white'
                },
                '& .MuiInputLabel-root': {
                  color: '#99aab5'
                },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#40444b'
                  },
                  '&:hover fieldset': {
                    borderColor: '#5865f2'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#5865f2'
                  }
                }
              }}
              placeholder="Odaya giriş şifresi..."
            />
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid #40444b' }}>
          <Button 
            onClick={() => setCreateRoomDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
            disabled={loading}
          >
            İptal
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateRoom}
            disabled={loading || !newRoomName.trim()}
            sx={{ 
              backgroundColor: '#5865f2',
              '&:hover': {
                backgroundColor: '#4752c4'
              },
              '&:disabled': {
                backgroundColor: '#4f545c'
              }
            }}
          >
            {loading ? 'Oluşturuluyor...' : 'Oda Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Role Management Dialog */}
      <RoleManagementDialog
        open={roleManagementOpen}
        onClose={() => setRoleManagementOpen(false)}
        server={server}
        members={members}
        onRoleUpdated={() => {
          // Rollerin güncellendiğinde izinleri yeniden yükle
          loadPermissions();
          loadServerRoles();
          onServerUpdated?.();
        }}
      />
    </Dialog>
  );
}; 