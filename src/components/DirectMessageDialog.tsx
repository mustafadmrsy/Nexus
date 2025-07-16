import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Divider,
  Badge,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Send,
  Close,
  AttachFile,
  EmojiEmotions,
  Circle
} from '@mui/icons-material';
import { getOrCreateDirectMessage } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';

interface DirectMessageDialogProps {
  open: boolean;
  onClose: () => void;
  friendId: string;
  friendName: string;
  friendPhotoURL?: string;
  friendStatus?: string;
}

interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: Date;
  isOwn: boolean;
}

export const DirectMessageDialog: React.FC<DirectMessageDialogProps> = ({
  open,
  onClose,
  friendId,
  friendName,
  friendPhotoURL,
  friendStatus = 'online'
}) => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [dmId, setDmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && userProfile?.uid) {
      initializeDM();
    }
  }, [open, userProfile?.uid, friendId]);

  const initializeDM = async () => {
    if (!userProfile?.uid) return;

    setLoading(true);
    try {
      const result = await getOrCreateDirectMessage(userProfile.uid, friendId);
      if (result.success && result.dmId) {
        setDmId(result.dmId);
        // Burada gerçek mesajları yükleyebilirsiniz
        // Şimdilik örnek mesajlar
        setMessages([
          {
            id: '1',
            content: 'Merhaba! Nasılsın?',
            authorId: friendId,
            authorName: friendName,
            timestamp: new Date(Date.now() - 60000),
            isOwn: false
          },
          {
            id: '2',
            content: 'İyiyim teşekkürler, sen nasılsın?',
            authorId: userProfile.uid,
            authorName: userProfile.displayName,
            timestamp: new Date(Date.now() - 30000),
            isOwn: true
          }
        ]);
      }
    } catch (error) {
      console.error('Error initializing DM:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !dmId || !userProfile?.uid) return;

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage.trim(),
      authorId: userProfile.uid,
      authorName: userProfile.displayName,
      timestamp: new Date(),
      isOwn: true
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    
    // Burada Firebase'e mesaj gönderme işlemi yapılabilir
    // await addMessageToFirebase(dmId, message);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'offline': return '#747f8d';
      default: return '#43b581';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#36393f',
          borderRadius: 2,
          height: '80vh',
          maxHeight: '600px'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: 'white', 
        fontSize: '1.2rem', 
        fontWeight: 'bold',
        borderBottom: '1px solid #40444b',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2
      }}>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <Circle
              sx={{
                width: 12,
                height: 12,
                color: getStatusColor(friendStatus),
              }}
            />
          }
        >
          <Avatar src={friendPhotoURL} sx={{ width: 40, height: 40 }}>
            {friendName.charAt(0).toUpperCase()}
          </Avatar>
        </Badge>
        <Box>
          <Typography variant="h6" color="white">
            {friendName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {friendStatus === 'online' ? 'Çevrimiçi' : 
             friendStatus === 'idle' ? 'Boşta' : 'Çevrimdışı'}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%' 
          }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Mesajlar */}
            <Box sx={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              p: 2,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {messages.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center'
                }}>
                  <Avatar 
                    src={friendPhotoURL} 
                    sx={{ width: 80, height: 80, mb: 2 }}
                  >
                    {friendName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h6" color="white" gutterBottom>
                    {friendName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {friendName} ile direkt mesaj geçmişinizin başlangıcı
                  </Typography>
                </Box>
              ) : (
                <List sx={{ width: '100%', p: 0 }}>
                  {messages.map((message) => (
                    <ListItem key={message.id} alignItems="flex-start" sx={{ px: 0 }}>
                      <Box sx={{ 
                        display: 'flex', 
                        width: '100%',
                        justifyContent: message.isOwn ? 'flex-end' : 'flex-start'
                      }}>
                        <Box sx={{ 
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: message.isOwn ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          gap: 1
                        }}>
                          <Avatar 
                            src={message.isOwn ? userProfile?.photoURL : friendPhotoURL}
                            sx={{ width: 40, height: 40 }}
                          >
                            {message.authorName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Paper sx={{ 
                            p: 1.5, 
                            backgroundColor: message.isOwn ? '#5865f2' : '#40444b',
                            color: 'white',
                            borderRadius: 2,
                            wordBreak: 'break-word'
                          }}>
                            <Typography variant="body2">
                              {message.content}
                            </Typography>
                            <Typography variant="caption" 
                              sx={{ 
                                color: message.isOwn ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                mt: 0.5,
                                display: 'block'
                              }}
                            >
                              {formatTime(message.timestamp)}
                            </Typography>
                          </Paper>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Mesaj Gönderme */}
            <Box sx={{ 
              p: 2, 
              borderTop: '1px solid #40444b',
              backgroundColor: '#36393f'
            }}>
              <TextField
                fullWidth
                multiline
                maxRows={3}
                placeholder={`${friendName} ile mesajlaş...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#40444b',
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'transparent',
                    },
                    '&:hover fieldset': {
                      borderColor: '#5865f2',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#5865f2',
                    },
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'text.secondary',
                  },
                }}
                InputProps={{
                  style: { color: 'white' },
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton size="small" sx={{ color: 'text.secondary' }}>
                        <AttachFile />
                      </IconButton>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" sx={{ color: 'text.secondary' }}>
                        <EmojiEmotions />
                      </IconButton>
                      <IconButton 
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        size="small" 
                        sx={{ 
                          color: newMessage.trim() ? '#5865f2' : 'text.secondary',
                          ml: 1
                        }}
                      >
                        <Send />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}; 