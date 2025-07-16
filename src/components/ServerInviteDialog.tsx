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
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Chip,
  Divider,
  InputAdornment,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  PersonAdd,
  Search,
  ContentCopy,
  Link,
  Send,
  Check,
  Close,
  Refresh
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getUserFriends } from '../services/userService';
import { createServerInviteNotification } from '../services/notificationService';
import { User } from '../types';

interface ServerInviteDialogProps {
  open: boolean;
  onClose: () => void;
  server: any;
  onInviteSent?: () => void;
}

export const ServerInviteDialog: React.FC<ServerInviteDialogProps> = ({
  open,
  onClose,
  server,
  onInviteSent
}) => {
  const { userProfile } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [sendingInvites, setSendingInvites] = useState<string[]>([]);
  const [sentInvites, setSentInvites] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [neverExpire, setNeverExpire] = useState(false);
  const [maxUses, setMaxUses] = useState(10);

  useEffect(() => {
    if (open && userProfile?.uid) {
      loadFriends();
      generateInviteLink();
    }
  }, [open, userProfile?.uid]);

  const loadFriends = async () => {
    if (!userProfile?.uid) return;
    
    setLoading(true);
    try {
      const friendsList = await getUserFriends(userProfile.uid);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = () => {
    // Davet linkini oluştur
    const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/invite/${inviteCode}`;
    setInviteLink(link);
    
    // Burada Firebase'e davet kodu kaydedilir
    // await saveInviteCode(server.id, inviteCode, { neverExpire, maxUses });
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const sendInviteToFriend = async (friend: User) => {
    if (!userProfile?.uid || sendingInvites.includes(friend.uid)) return;

    setSendingInvites(prev => [...prev, friend.uid]);
    try {
      // Sunucu davet bildirimi gönder
      const result = await createServerInviteNotification(
        friend.uid,
        userProfile.uid,
        userProfile.displayName,
        server.name,
        server.id
      );
      
      if (result.success) {
        setSentInvites(prev => [...prev, friend.uid]);
        setMessage({ type: 'success', text: `${friend.displayName} kullanıcısına davet gönderildi!` });
        onInviteSent?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Davet gönderilirken hata oluştu' });
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      setMessage({ type: 'error', text: 'Davet gönderilirken hata oluştu' });
    } finally {
      setSendingInvites(prev => prev.filter(id => id !== friend.uid));
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setMessage(null);
    setSentInvites([]);
    setSendingInvites([]);
    onClose();
  };

  const filteredFriends = friends.filter(friend =>
    friend.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
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
        <PersonAdd />
        {server?.name} Sunucusuna Davet Et
      </DialogTitle>

      <DialogContent sx={{ p: 3, backgroundColor: '#36393f' }}>
        {message && (
          <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>
            {message.text}
          </Alert>
        )}

        {/* Davet Linki */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" color="white" gutterBottom>
            Davet Linki
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bu linki paylaşarak sunucunuza kimseyi davet edebilirsiniz.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              value={inviteLink}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <Link sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={copyInviteLink} sx={{ color: linkCopied ? 'success.main' : 'text.secondary' }}>
                      {linkCopied ? <Check /> : <ContentCopy />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#40444b',
                  color: 'white',
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: '#5865f2' },
                  '&.Mui-focused fieldset': { borderColor: '#5865f2' },
                },
              }}
            />
            <IconButton
              onClick={generateInviteLink}
              sx={{ 
                color: 'text.secondary',
                backgroundColor: '#40444b',
                '&:hover': { backgroundColor: '#4f545c' }
              }}
              title="Yeni Link Oluştur"
            >
              <Refresh />
            </IconButton>
          </Box>

          {/* Link Ayarları */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={neverExpire}
                  onChange={(e) => setNeverExpire(e.target.checked)}
                  color="primary"
                />
              }
              label="Asla süresi dolmasın"
              sx={{ color: 'white' }}
            />
            {!neverExpire && (
              <TextField
                type="number"
                label="Maksimum kullanım"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                size="small"
                sx={{
                  width: 150,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#40444b',
                    color: 'white',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'text.secondary',
                  },
                }}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ borderColor: '#40444b', mb: 3 }} />

        {/* Arkadaş Listesi */}
        <Box>
          <Typography variant="h6" color="white" gutterBottom>
            Arkadaşlarınıza Davet Gönderin
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Arkadaş ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#40444b',
                color: 'white',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: '#5865f2' },
                '&.Mui-focused fieldset': { borderColor: '#5865f2' },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
          />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : filteredFriends.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'Arkadaş bulunamadı' : 'Arkadaş listeniz boş'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {filteredFriends.map((friend) => (
                <ListItem
                  key={friend.uid}
                  sx={{
                    backgroundColor: '#40444b',
                    borderRadius: 2,
                    mb: 1,
                    '&:hover': { backgroundColor: '#4f545c' }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={friend.photoURL} sx={{ width: 40, height: 40 }}>
                      {friend.displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={friend.displayName}
                    secondary={friend.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
                    primaryTypographyProps={{ color: 'white' }}
                    secondaryTypographyProps={{ color: 'text.secondary' }}
                  />
                  {sentInvites.includes(friend.uid) ? (
                    <Chip
                      label="Gönderildi"
                      color="success"
                      icon={<Check />}
                      size="small"
                    />
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={sendingInvites.includes(friend.uid) ? <CircularProgress size={16} /> : <Send />}
                      onClick={() => sendInviteToFriend(friend)}
                      disabled={sendingInvites.includes(friend.uid)}
                      sx={{
                        backgroundColor: '#5865f2',
                        '&:hover': { backgroundColor: '#4752c4' }
                      }}
                    >
                      {sendingInvites.includes(friend.uid) ? 'Gönderiliyor...' : 'Davet Et'}
                    </Button>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, backgroundColor: '#36393f', borderTop: '1px solid #40444b' }}>
        <Button
          onClick={handleClose}
          sx={{ color: 'text.secondary' }}
        >
          Kapat
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 