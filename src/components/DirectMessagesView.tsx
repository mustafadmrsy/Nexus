import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Paper,
  Divider,
  Badge,
  InputAdornment,
  CircularProgress,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import {
  Send,
  AttachFile,
  EmojiEmotions,
  Circle,
  Search,
  Add,
  Chat,
  Group,
  Delete,
  MoreVert,
  Clear
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { getUserDirectMessages, getOrCreateDirectMessage, deleteDirectMessage } from '../services/userService';
import { DirectMessage, User } from '../types';
import { subscribeToDMMessages, sendDMMessage, deleteDMMessage } from '../services/messageService';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useDropzone } from 'react-dropzone';
import { UserProfileDialog } from './UserProfileDialog';
import { uploadFile } from '../services/storageService';

interface DirectMessagesViewProps {
  friends: User[];
  onStartNewDM: () => void;
}

interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  timestamp: Date;
  isOwn: boolean;
  attachments?: MessageAttachment[];
}

interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export const DirectMessagesView: React.FC<DirectMessagesViewProps> = ({
  friends,
  onStartNewDM
}) => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useThemeContext();
  const [selectedDM, setSelectedDM] = useState<DirectMessage | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<any>(null);
  const [profileDialogRoles, setProfileDialogRoles] = useState<string[]>([]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    if (userProfile?.uid) {
      loadDirectMessages();
    }
  }, [userProfile?.uid]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const loadDirectMessages = async () => {
    if (!userProfile?.uid) return;

    setLoading(true);
    try {
      const dms = await getUserDirectMessages(userProfile.uid);
      setDirectMessages(dms);
      
      // İlk DM'i seç
      if (dms.length > 0 && !selectedDM) {
        setSelectedDM(dms[0]);
        // Friend bilgisini bul
        const friendId = dms[0].participants.find(p => p !== userProfile.uid);
        const friend = friends.find(f => f.uid === friendId);
        if (friend) {
          setSelectedFriend(friend);
          loadMessages(dms[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading direct messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = (dmId: string) => {
    // Önceki dinleyiciyi temizle
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Firebase'den gerçek mesajları yükle
    const unsubscribe = subscribeToDMMessages(dmId, (firebaseMessages) => {
      const convertedMessages = firebaseMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        authorId: msg.authorId,
        authorName: msg.authorName,
        authorPhoto: msg.authorPhotoURL || '',
        timestamp: msg.timestamp,
        isOwn: msg.authorId === userProfile?.uid,
        attachments: msg.attachments || []
      }));
      setMessages(convertedMessages);
    });

    // Cleanup referansını sakla
    unsubscribeRef.current = unsubscribe;
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setFilePreview(URL.createObjectURL(acceptedFiles[0]));
      setFileError(null);
    }
  };
  const { getRootProps, getInputProps, open: openFileDialog } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': [] }
  });

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedDM || !userProfile?.uid || sendingMessage) return;
    
    setSendingMessage(true);
    setFileError(null);
    
    const messageContent = newMessage.trim();
    const currentSelectedFile = selectedFile;
    const currentFileName = selectedFile?.name || '';
    const currentFileType = selectedFile?.type || '';
    const currentFileSize = selectedFile?.size || 0;
    
    setNewMessage('');
    setShowEmojiPicker(false);
    setSelectedFile(null);
    setFilePreview(null);
    
    let attachments: MessageAttachment[] = [];
    if (currentSelectedFile) {
      try {
        // Dosyayı Firebase Storage'a yükle
        const uploadPath = `messages/dm/${selectedDM.id}`;
        const uploadResult = await uploadFile(currentSelectedFile, uploadPath);
        
        if (uploadResult.success && uploadResult.downloadURL) {
          attachments = [{
            id: Date.now().toString(),
            name: currentFileName,
            url: uploadResult.downloadURL,
            type: currentFileType,
            size: currentFileSize
          }];
        } else {
          setFileError(uploadResult.error || 'Dosya yükleme hatası');
          setSendingMessage(false);
          return;
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        setFileError('Dosya yüklenirken hata oluştu.');
        setSendingMessage(false);
        return;
      }
    }
    
    try {
      await sendDMMessage(
        selectedDM.id,
        userProfile.uid,
        userProfile.displayName,
        messageContent,
        userProfile.photoURL || undefined,
        undefined,
        attachments.length > 0 ? attachments : undefined
      );
    } catch (error) {
      setFileError('Mesaj veya dosya gönderilemedi.');
      setNewMessage(messageContent);
    } finally {
      setSendingMessage(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userProfile?.uid) return;

    try {
      const result = await deleteDMMessage(messageId);
      if (result.success) {
        console.log('Message deleted successfully');
      } else {
        console.error('Error deleting message:', result.error);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const deleteDMConversation = async () => {
    if (!selectedDM || !userProfile?.uid) return;

    if (window.confirm('Bu konuşma sadece sizin için silinecek. Karşı taraf konuşmayı görebilir. Silmek istediğinizden emin misiniz?')) {
      try {
        const result = await deleteDirectMessage(selectedDM.id, userProfile.uid);
        if (result.success) {
          // DM silindi, liste yenile ve seçimi temizle
          setSelectedDM(null);
          setSelectedFriend(null);
          setMessages([]);
          await loadDirectMessages();
        } else {
          console.error('Error deleting DM:', result.error);
          alert('Konuşma silinirken hata oluştu: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting DM:', error);
        alert('Bir hata oluştu');
      }
    }
  };

  const handleSelectDM = (dm: DirectMessage) => {
    setSelectedDM(dm);
    const friendId = dm.participants.find(p => p !== userProfile?.uid);
    const friend = friends.find(f => f.uid === friendId);
    if (friend) {
      setSelectedFriend(friend);
      loadMessages(dm.id);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleStartDMWithFriend = async (friend: User) => {
    if (!userProfile?.uid) return;

    setLoading(true);
    try {
      const result = await getOrCreateDirectMessage(userProfile.uid, friend.uid);
      if (result.success && result.dmId) {
        // Yeni DM oluşturuldu veya mevcut DM bulundu
        // DM listesini yenile
        await loadDirectMessages();
        
        // Oluşturulan/bulunan DM'i seç
        const newDM = {
          id: result.dmId,
          participants: [userProfile.uid, friend.uid],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        setSelectedDM(newDM);
        setSelectedFriend(friend);
        loadMessages(result.dmId);
        
        // DM sekmesine geç
        setTabValue(0);
      }
    } catch (error) {
      console.error('Error starting DM with friend:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return 'Dün';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('tr-TR', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('tr-TR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
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

  // Mesaj attachment'larını render et
  const renderMessageAttachments = (attachments: MessageAttachment[]) => {
    if (!attachments || attachments.length === 0) return null;
    
    return (
      <Box sx={{ mt: 1 }}>
        {attachments.map((attachment) => {
          // Resim dosyası kontrolü
          if (attachment.type.startsWith('image/')) {
            return (
              <Box key={attachment.id} sx={{ mb: 1 }}>
                <img 
                  src={attachment.url} 
                  alt={attachment.name}
                  style={{ 
                    maxWidth: '250px', 
                    maxHeight: '250px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'block'
                  }}
                  onClick={() => window.open(attachment.url, '_blank')}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {attachment.name} • {Math.round(attachment.size / 1024)} KB
                </Typography>
              </Box>
            );
          }
          
          // Diğer dosya türleri için basit link
          return (
            <Box key={attachment.id} sx={{ mb: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.open(attachment.url, '_blank')}
                sx={{ color: '#5865f2', borderColor: '#5865f2' }}
              >
                📎 {attachment.name}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {Math.round(attachment.size / 1024)} KB
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  };

  const filteredDMs = directMessages.filter(dm => {
    const friendId = dm.participants.find(p => p !== userProfile?.uid);
    const friend = friends.find(f => f.uid === friendId);
    return friend?.displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <Box sx={{ display: 'flex', height: '100%', backgroundColor: isDarkMode ? '#36393f' : '#ffffff' }}>
      {/* Sol Panel - DM Listesi */}
      <Box sx={{ 
        width: 280, 
        backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5', 
        borderRight: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <Box sx={{ borderBottom: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}` }}>
          <Typography variant="h6" color={isDarkMode ? 'white' : 'black'} sx={{ p: 2, pb: 1 }}>
            Direkt Mesajlar
          </Typography>
          
          {/* Tabs */}
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                color: isDarkMode ? '#b9bbbe' : '#666666',
                fontSize: '0.85rem',
                textTransform: 'none',
                '&.Mui-selected': { color: '#5865f2' }
              },
              '& .MuiTabs-indicator': { backgroundColor: '#5865f2' }
            }}
          >
            <Tab label="Sohbetler" icon={<Chat sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label="Arkadaşlar" icon={<Group sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
          
          {/* Search */}
          <Box sx={{ p: 2, pt: 1 }}>
          <TextField
            fullWidth
            size="small"
              placeholder={tabValue === 0 ? "Sohbet ara" : "Arkadaş ara"}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? '#40444b' : '#f0f0f0',
                color: isDarkMode ? 'white' : 'black',
                height: 32,
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: '#5865f2' },
                '&.Mui-focused fieldset': { borderColor: '#5865f2' },
              },
              '& .MuiInputBase-input::placeholder': { color: 'text.secondary' },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
                </InputAdornment>
              )
            }}
          />
          </Box>
        </Box>

        {/* Liste İçeriği */}
        <List sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
          {tabValue === 0 ? (
            // DM Listesi
            <>
          {/* Yeni DM Başlat */}
          <ListItemButton 
            onClick={onStartNewDM}
            sx={{ 
              borderRadius: 2, 
              mb: 1,
              '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
            }}
          >
            <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: '#5865f2', width: 40, height: 40 }}>
                <Add />
              </Avatar>
            </ListItemAvatar>
            <ListItemText 
              primary="Yeni Mesaj"
              primaryTypographyProps={{ color: isDarkMode ? 'white' : 'black', fontSize: '0.9rem' }}
            />
              </ListItemButton>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : filteredDMs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Henüz direkt mesajınız yok
              </Typography>
            </Box>
          ) : (
            filteredDMs.map((dm) => {
              const friendId = dm.participants.find(p => p !== userProfile?.uid);
              const friend = friends.find(f => f.uid === friendId);
              
              if (!friend) return null;

              return (
                    <ListItemButton
                  key={dm.id}
                  selected={selectedDM?.id === dm.id}
                  onClick={() => handleSelectDM(dm)}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' },
                    '&.Mui-selected': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Circle
                          sx={{
                            width: 10,
                            height: 10,
                            color: getStatusColor(friend.status),
                          }}
                        />
                      }
                    >
                      <Avatar 
                        src={friend.photoURL} 
                            sx={{ width: 40, height: 40, cursor: 'pointer' }}
                        onClick={() => {
                          setProfileDialogUser(friend);
                          setProfileDialogRoles([]);
                          setProfileDialogOpen(true);
                        }}
                      >
                        {friend.displayName.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={friend.displayName}
                    secondary="Son mesaj burada görünecek..."
                    primaryTypographyProps={{ 
                      color: isDarkMode ? 'white' : 'black', 
                      fontSize: '0.9rem',
                      fontWeight: selectedDM?.id === dm.id ? 'bold' : 'normal'
                    }}
                    secondaryTypographyProps={{ 
                      color: 'text.secondary', 
                      fontSize: '0.8rem',
                      noWrap: true
                    }}
                    onClick={() => {
                      setProfileDialogUser(friend);
                      setProfileDialogRoles([]);
                      setProfileDialogOpen(true);
                    }}
                  />
                    </ListItemButton>
              );
            })
              )}
            </>
          ) : (
            // Arkadaş Listesi
            <>
              {friends.filter(friend => 
                friend.displayName.toLowerCase().includes(searchTerm.toLowerCase())
              ).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm ? 'Arkadaş bulunamadı' : 'Arkadaş listeniz boş'}
                  </Typography>
                </Box>
              ) : (
                friends
                  .filter(friend => 
                    friend.displayName.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((friend) => (
                    <ListItemButton
                      key={friend.uid}
                      onClick={() => handleStartDMWithFriend(friend)}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        '&:hover': { backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0' }
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Circle
                              sx={{
                                width: 10,
                                height: 10,
                                color: getStatusColor(friend.status),
                              }}
                            />
                          }
                        >
                          <Avatar 
                            src={friend.photoURL} 
                            sx={{ width: 32, height: 32, cursor: 'pointer' }}
                            onClick={() => {
                              setProfileDialogUser(friend);
                              setProfileDialogRoles([]);
                              setProfileDialogOpen(true);
                            }}
                          >
                            {friend.displayName.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={friend.displayName}
                        secondary={
                          friend.status === 'online' ? 'Çevrimiçi' : 
                          friend.status === 'idle' ? 'Boşta' : 
                          friend.status === 'dnd' ? 'Rahatsız Etmeyin' : 'Çevrimdışı'
                        }
                        primaryTypographyProps={{ 
                          color: isDarkMode ? 'white' : 'black', 
                          fontSize: '0.9rem'
                        }}
                        secondaryTypographyProps={{ 
                          color: 'text.secondary', 
                          fontSize: '0.8rem'
                        }}
                      />
                      <Button
                        size="small"
                        startIcon={<Chat />}
                        sx={{
                          color: '#5865f2',
                          minWidth: 'auto',
                          fontSize: '0.75rem',
                          px: 1
                        }}
                      >
                        Mesaj
                      </Button>
                    </ListItemButton>
                  ))
              )}
            </>
          )}
        </List>
      </Box>

      {/* Sağ Panel - Mesaj Alanı */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedDM && selectedFriend ? (
          <>
            {/* Mesaj Header */}
            <Box sx={{ 
              p: 2, 
              borderBottom: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Circle
                    sx={{
                      width: 12,
                      height: 12,
                      color: getStatusColor(selectedFriend.status),
                    }}
                  />
                }
              >
                <Avatar src={selectedFriend.photoURL} sx={{ width: 48, height: 48, cursor: 'pointer' }} onClick={() => {
                  setProfileDialogUser(selectedFriend);
                  setProfileDialogRoles([]);
                  setProfileDialogOpen(true);
                }}>
                  {selectedFriend.displayName.charAt(0).toUpperCase()}
                </Avatar>
              </Badge>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" color={isDarkMode ? 'white' : 'black'}>
                  {selectedFriend.displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedFriend.status === 'online' ? 'Çevrimiçi' : 
                   selectedFriend.status === 'idle' ? 'Boşta' : 
                   selectedFriend.status === 'dnd' ? 'Rahatsız Etmeyin' : 'Çevrimdışı'}
                </Typography>
              </Box>
              
              {/* Konuşma Silme Butonu */}
              <IconButton
                onClick={deleteDMConversation}
                sx={{
                  color: '#ed4245',
                  '&:hover': {
                    backgroundColor: 'rgba(237, 66, 69, 0.1)',
                  }
                }}
                title="Konuşmayı Sil"
              >
                <Clear />
              </IconButton>
            </Box>

            {/* Mesajlar */}
            <Box sx={{ 
              flexGrow: 1, 
              overflowY: 'auto',
              overflowX: 'hidden',
              p: 2,
              backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
              height: 0, // Flexbox'ta scroll çalışması için
              display: 'flex',
              flexDirection: 'column'
            }}>
              {messages.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexGrow: 1,
                  textAlign: 'center'
                }}>
                  <Avatar 
                    src={selectedFriend.photoURL} 
                    sx={{ width: 80, height: 80, mb: 2 }}
                  >
                    {selectedFriend.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h6" color={isDarkMode ? 'white' : 'black'} gutterBottom>
                    {selectedFriend.displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedFriend.displayName} ile direkt mesaj geçmişinizin başlangıcı
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ 
                  flexGrow: 1, 
                  overflowY: 'auto',
                  overflowX: 'hidden' 
                }}>
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
                            gap: 1,
                            position: 'relative',
                            '&:hover .delete-button': {
                              opacity: 1
                            }
                          }}>
                            <Avatar 
                              src={message.authorPhoto || (message.isOwn ? userProfile?.photoURL : selectedFriend.photoURL)}
                              sx={{ width: 40, height: 40 }}
                            >
                              {message.authorName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ position: 'relative' }}>
                            <Paper sx={{ 
                              p: 1.5, 
                              backgroundColor: message.isOwn ? '#5865f2' : (isDarkMode ? '#40444b' : '#f0f0f0'),
                              color: message.isOwn ? 'white' : (isDarkMode ? 'white' : 'black'),
                              borderRadius: 2,
                              wordBreak: 'break-word'
                            }}>
                              <Typography variant="body2">
                                {message.content}
                              </Typography>
                              {renderMessageAttachments(message.attachments || [])}
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
                              {/* Silme butonu - sadece kendi mesajları için */}
                              {message.isOwn && (
                                <IconButton
                                  className="delete-button"
                                  onClick={() => deleteMessage(message.id)}
                                  sx={{
                                    position: 'absolute',
                                    top: -8,
                                    right: message.isOwn ? -8 : 'auto',
                                    left: message.isOwn ? 'auto' : -8,
                                    width: 28,
                                    height: 28,
                                    backgroundColor: '#ed4245',
                                    color: 'white',
                                    opacity: 0,
                                    transition: 'opacity 0.2s ease',
                                    '&:hover': {
                                      backgroundColor: '#c73e41',
                                    }
                                  }}
                                  size="small"
                                >
                                  <Delete sx={{ fontSize: 16 }} />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Mesaj Gönderme */}
            <Box sx={{ 
              p: 2, 
              borderTop: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
              backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
              position: 'relative'
            }} {...getRootProps()}>
              <input {...getInputProps()} />
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 60, right: 60, zIndex: 2000 }}>
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: any) => {
                      setNewMessage(newMessage + (emoji.native || emoji.colons || ''));
                      setShowEmojiPicker(false);
                    }}
                    theme="dark"
                    locale="tr"
                  />
                </Box>
              )}
              {filePreview && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <img src={filePreview} alt="preview" style={{ maxHeight: 80, borderRadius: 8 }} />
                  <Button size="small" color="error" onClick={() => { setSelectedFile(null); setFilePreview(null); }}>Kaldır</Button>
                </Box>
              )}
              {fileError && (
                <Typography color="error" variant="body2" sx={{ mb: 1 }}>{fileError}</Typography>
              )}
              <TextField
                fullWidth
                multiline
                maxRows={3}
                placeholder={`${selectedFriend ? selectedFriend.displayName : ''} ile mesajlaş...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDarkMode ? '#40444b' : '#f0f0f0',
                    color: isDarkMode ? 'white' : 'black',
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: '#5865f2' },
                    '&.Mui-focused fieldset': { borderColor: '#5865f2' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: 'text.secondary' },
                }}
                InputProps={{
                  style: { color: isDarkMode ? 'white' : 'black' },
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={openFileDialog}>
                        <AttachFile />
                      </IconButton>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={() => setShowEmojiPicker((v) => !v)}>
                        <EmojiEmotions />
                      </IconButton>
                      <IconButton 
                        onClick={sendMessage}
                        disabled={(!newMessage.trim() && !selectedFile) || sendingMessage}
                        size="small" 
                        sx={{ 
                          color: ((newMessage.trim() || selectedFile) && !sendingMessage) ? '#5865f2' : 'text.secondary',
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
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            p: 4
          }}>
            <Typography variant="h5" color={isDarkMode ? 'white' : 'black'} gutterBottom>
              Arkadaşlarınızla sohbet edin
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Konuşmaya başlamak için sol taraftan {tabValue === 0 ? 'bir sohbet seçin' : 'bir arkadaşınızın yanındaki mesaj butonuna tıklayın'} veya yeni bir mesaj başlatın.
            </Typography>
            <Card 
              sx={{ 
                mt: 3, 
                backgroundColor: isDarkMode ? '#40444b' : '#f0f0f0', 
                cursor: 'pointer',
                '&:hover': { backgroundColor: isDarkMode ? '#4f545c' : '#e0e0e0' }
              }}
              onClick={() => setTabValue(1)}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ backgroundColor: '#5865f2' }}>
                  <Group />
                </Avatar>
                <Typography color={isDarkMode ? 'white' : 'black'}>
                  Arkadaş listesine git
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>
      <UserProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        user={profileDialogUser || { displayName: '', photoURL: '' }}
        roles={profileDialogRoles}
        serverRoles={[]}
      />
    </Box>
  );
}; 