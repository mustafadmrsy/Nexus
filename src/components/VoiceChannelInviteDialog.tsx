import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Avatar,
  Typography,
  Box,
  TextField,
  Badge,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import { Close, PersonAdd, VolumeUp, VolumeOff, VideocamOff, Videocam } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { sendVoiceChannelInvite } from '../services/roomInviteService';
import { checkUserPermissions } from '../services/serverService';
import { ServerMember, Room } from '../types';

interface VoiceChannelInviteDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room;
  serverId: string;
  serverName: string;
  serverMembers: ServerMember[];
  currentParticipants: string[];
}

const VoiceChannelInviteDialog: React.FC<VoiceChannelInviteDialogProps> = ({
  open,
  onClose,
  room,
  serverId,
  serverName,
  serverMembers,
  currentParticipants
}) => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useThemeContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<ServerMember | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [canInvite, setCanInvite] = useState(false);

  // Kullanıcının izinlerini kontrol et
  useEffect(() => {
    const checkPermissions = async () => {
      if (!userProfile?.uid) return;
      
      try {
        const permissions = await checkUserPermissions(serverId, userProfile.uid);
        setCanInvite(permissions.canMoveMembers);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setCanInvite(false);
      }
    };

    if (open) {
      checkPermissions();
    }
  }, [open, serverId, userProfile?.uid]);

  // Davet edilebilir üyeleri filtrele
  const getInvitableMembers = () => {
    return serverMembers.filter(member => {
      // Kendi kendine davet gönderme
      if (member.userId === userProfile?.uid) return false;
      
      // Zaten odada olan üyeleri filtrele
      if (currentParticipants.includes(member.userId)) return false;
      
      // Çevrimdışı üyeleri filtrele
      if (member.user?.status === 'offline') return false;
      
      // Arama terimine göre filtrele
      if (searchTerm && !member.user?.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#43b581';
    }
  };

  const getRoleColor = (member: ServerMember) => {
    const roles = member.roles || [];
    if (roles.includes('owner')) return '#f04747';
    if (roles.includes('admin')) return '#ff9500';
    if (roles.includes('moderator')) return '#5865f2';
    return '#99aab5';
  };

  const getRoleName = (member: ServerMember) => {
    const roles = member.roles || [];
    if (roles.includes('owner')) return 'Sahip';
    if (roles.includes('admin')) return 'Admin';
    if (roles.includes('moderator')) return 'Moderatör';
    return 'Üye';
  };

  const handleInvite = async () => {
    if (!selectedUser || !userProfile?.uid) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await sendVoiceChannelInvite(
        room.id,
        serverId,
        userProfile.uid,
        selectedUser.userId,
        inviteMessage.trim()
      );
      
      if (result.success) {
        setSuccess(`${selectedUser.user?.displayName} kullanıcısına davet gönderildi!`);
        setSelectedUser(null);
        setInviteMessage('');
        
        // 2 saniye sonra dialog'u kapat
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Davet gönderilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      setError('Davet gönderilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setInviteMessage('');
    setError('');
    setSuccess('');
    setSearchTerm('');
    onClose();
  };

  const invitableMembers = getInvitableMembers();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
          color: isDarkMode ? 'white' : 'black'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Box>
          <Typography variant="h6" component="div">
            Sesli Kanala Davet Et
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {room.type === 'voice' ? '🔊' : room.type === 'video' ? '📹' : '📺'} {room.name}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        {!canInvite ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Üyeleri sesli kanala davet etme izniniz yok.
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
            
            {/* Arama */}
            <TextField
              fullWidth
              placeholder="Üye ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                mb: 2,
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
            
            {/* Oda Bilgileri */}
            <Box sx={{ 
              p: 2, 
              backgroundColor: isDarkMode ? '#40444b' : '#f5f5f5',
              borderRadius: 2,
              mb: 2
            }}>
              <Typography variant="body2" color="text.secondary">
                Oda Durumu
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Typography variant="body2">
                  {currentParticipants.length} / {room.maxUsers} kişi
                </Typography>
                <Chip
                  label={room.isPrivate ? 'Özel' : 'Herkese Açık'}
                  size="small"
                  color={room.isPrivate ? 'warning' : 'primary'}
                />
                {room.password && (
                  <Chip
                    label="Şifreli"
                    size="small"
                    color="error"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
              {room.password && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Bu oda şifreli. Davet gönderdiğinizde kişiye şifre otomatik olarak bildirilecek.
                </Alert>
              )}
            </Box>
            
            {/* Üye Listesi */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Davet Edilebilir Üyeler ({invitableMembers.length})
            </Typography>
            
            {invitableMembers.length === 0 ? (
              <Box sx={{ 
                textAlign: 'center', 
                py: 4,
                backgroundColor: isDarkMode ? '#40444b' : '#f5f5f5',
                borderRadius: 2
              }}>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'Arama kriterine uygun üye bulunamadı' : 'Davet edilebilir çevrimiçi üye yok'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ 
                maxHeight: 300, 
                overflow: 'auto',
                backgroundColor: isDarkMode ? '#40444b' : '#f5f5f5',
                borderRadius: 2
              }}>
                {invitableMembers.map((member) => (
                  <ListItem key={member.userId} disablePadding>
                    <ListItemButton 
                      onClick={() => setSelectedUser(member)}
                      selected={selectedUser?.userId === member.userId}
                      sx={{
                        borderRadius: 1,
                        mx: 1,
                        my: 0.5,
                        '&.Mui-selected': {
                          backgroundColor: '#5865f2',
                          '&:hover': { backgroundColor: '#4752c4' }
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: getStatusColor(member.user?.status || 'offline'),
                                border: `2px solid ${isDarkMode ? '#2f3136' : '#ffffff'}`,
                              }}
                            />
                          }
                        >
                          <Avatar 
                            src={member.user?.photoURL} 
                            sx={{ 
                              width: 40, 
                              height: 40,
                              border: `2px solid ${getRoleColor(member)}`
                            }}
                          >
                            {member.user?.displayName.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={member.user?.displayName}
                        secondary={getRoleName(member)}
                        primaryTypographyProps={{
                          color: selectedUser?.userId === member.userId ? 'white' : 'text.primary',
                          fontWeight: selectedUser?.userId === member.userId ? 'bold' : 'normal'
                        }}
                        secondaryTypographyProps={{
                          color: selectedUser?.userId === member.userId ? 'rgba(255,255,255,0.7)' : getRoleColor(member)
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={member.user?.status === 'online' ? 'Çevrimiçi' : 
                                member.user?.status === 'idle' ? 'Boşta' : 
                                member.user?.status === 'dnd' ? 'Rahatsız Etme' : 'Çevrimdışı'}
                          size="small"
                          sx={{
                            backgroundColor: getStatusColor(member.user?.status || 'offline'),
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
            
            {/* Davet Mesajı */}
            {selectedUser && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {selectedUser.user?.displayName} kullanıcısına davet mesajı (isteğe bağlı)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Kısa bir mesaj ekleyin..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? '#40444b' : '#f5f5f5',
                      color: isDarkMode ? 'white' : 'black',
                      '& fieldset': { borderColor: isDarkMode ? '#72767d' : '#e0e0e0' },
                      '&:hover fieldset': { borderColor: '#5865f2' },
                      '&.Mui-focused fieldset': { borderColor: '#5865f2' },
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} color="secondary">
          İptal
        </Button>
        <Button
          onClick={handleInvite}
          variant="contained"
          disabled={!selectedUser || loading || !canInvite}
          startIcon={loading ? <CircularProgress size={16} /> : <PersonAdd />}
          sx={{ backgroundColor: '#5865f2', '&:hover': { backgroundColor: '#4752c4' } }}
        >
          {loading ? 'Gönderiliyor...' : 'Davet Gönder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VoiceChannelInviteDialog; 