import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  Paper,
  InputAdornment,
  CircularProgress,
  Badge,
  Chip,
  Button
} from '@mui/material';
import {
  Send,
  AttachFile,
  EmojiEmotions,
  Tag,
  VolumeUp,
  Circle
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { ServerMember } from '../types';
import { subscribeToChannelMessages, sendMessage, deleteMessage, subscribeToRoomMessages, sendRoomMessage } from '../services/messageService';
import { getUserCurrentRoom } from '../services/roomService';
import { getServerRoles } from '../services/roleService';
import { checkUserPermissions } from '../services/serverService';
import Picker from '@emoji-mart/react';
import { useDropzone } from 'react-dropzone';
import data from '@emoji-mart/data';
import { UserProfileDialog } from './UserProfileDialog';
import { uploadFile } from '../services/storageService';

interface ServerChannelViewProps {
  channel: any;
  server: any;
  serverMembers: ServerMember[];
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

export const ServerChannelView: React.FC<ServerChannelViewProps> = ({
  channel,
  server,
  serverMembers
}) => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useThemeContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [serverRoles, setServerRoles] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [mentionType, setMentionType] = useState<'user' | 'role'>('user');
  const [userPermissions, setUserPermissions] = useState({
    canSendMessages: true,
    canAttachFiles: true,
    canMentionEveryone: false,
    canConnect: true,
    canSpeak: true,
    canVideo: true,
    canMuteMembers: false,
    canDeafenMembers: false,
    canMoveMembers: false
  });

  // Rol bahsetme formatı için fonksiyon
  const formatMessage = (content: string) => {
    // Rol bahsetmelerini bul ve format et
    const roleMentionRegex = /@&(\w+)/g;
    const userMentionRegex = /@(\w+)/g;
    
    let formattedContent = content;
    
    // Rol bahsetmelerini format et
    formattedContent = formattedContent.replace(roleMentionRegex, (match, roleName) => {
      const role = serverRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      if (role) {
        return `@${role.name}`;
      }
      return match;
    });
    
    // Kullanıcı bahsetmelerini format et
    formattedContent = formattedContent.replace(userMentionRegex, (match, username) => {
      const member = serverMembers.find(m => m.user?.displayName.toLowerCase() === username.toLowerCase());
      if (member) {
        return `@${member.user?.displayName}`;
      }
      return match;
    });
    
    return formattedContent;
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
                    maxWidth: '300px', 
                    maxHeight: '300px',
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

  // Mesaj içeriğini React elementine dönüştür
  const renderMessageContent = (content: string) => {
    const roleMentionRegex = /@&(\w+)/g;
    const userMentionRegex = /@(\w+)/g;
    const everyoneMentionRegex = /@everyone/g;
    
    let parts = [content];
    
    // Rol bahsetmelerini işle
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      
      const matches = [...part.matchAll(roleMentionRegex)];
      if (matches.length === 0) return part;
      
      const result = [];
      let lastIndex = 0;
      
      matches.forEach(match => {
        // Önceki metin
        if (match.index! > lastIndex) {
          result.push(part.substring(lastIndex, match.index!));
        }
        
        // Rol bahsetme
        const roleName = match[1];
        const role = serverRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role) {
          result.push(
            <Chip
              key={`role-${match.index}`}
              label={`@${role.name}`}
              size="small"
              sx={{
                backgroundColor: role.color || '#5865f2',
                color: 'white',
                fontSize: '0.8rem',
                height: 'auto',
                mx: 0.5
              }}
            />
          );
        } else {
          result.push(match[0]);
        }
        
        lastIndex = match.index! + match[0].length;
      });
      
      // Kalan metin
      if (lastIndex < part.length) {
        result.push(part.substring(lastIndex));
      }
      
      return result;
    });
    
    // Kullanıcı bahsetmelerini işle
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      
      const matches = [...part.matchAll(userMentionRegex)];
      if (matches.length === 0) return part;
      
      const result = [];
      let lastIndex = 0;
      
      matches.forEach(match => {
        // Önceki metin
        if (match.index! > lastIndex) {
          result.push(part.substring(lastIndex, match.index!));
        }
        
        // Kullanıcı bahsetme
        const username = match[1];
        const member = serverMembers.find(m => m.user?.displayName.toLowerCase() === username.toLowerCase());
        if (member) {
          result.push(
            <Chip
              key={`user-${match.index}`}
              label={`@${member.user?.displayName}`}
              size="small"
              sx={{
                backgroundColor: '#5865f2',
                color: 'white',
                fontSize: '0.8rem',
                height: 'auto',
                mx: 0.5
              }}
            />
          );
        } else {
          result.push(match[0]);
        }
        
        lastIndex = match.index! + match[0].length;
      });
      
      // Kalan metin
      if (lastIndex < part.length) {
        result.push(part.substring(lastIndex));
      }
      
      return result;
    });
    
    // @everyone bahsetmelerini işle
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      
      const matches = [...part.matchAll(everyoneMentionRegex)];
      if (matches.length === 0) return part;
      
      const result = [];
      let lastIndex = 0;
      
      matches.forEach(match => {
        // Önceki metin
        if (match.index! > lastIndex) {
          result.push(part.substring(lastIndex, match.index!));
        }
        
        // @everyone bahsetme
        result.push(
          <Chip
            key={`everyone-${match.index}`}
            label="@everyone"
            size="small"
            sx={{
              backgroundColor: '#f04747',
              color: 'white',
              fontSize: '0.8rem',
              height: 'auto',
              mx: 0.5,
              fontWeight: 'bold'
            }}
          />
        );
        
        lastIndex = match.index! + match[0].length;
      });
      
      // Kalan metin
      if (lastIndex < part.length) {
        result.push(part.substring(lastIndex));
      }
      
      return result;
    });
    
    return parts.map((part, index) => 
      typeof part === 'string' ? <span key={index}>{part}</span> : part
    );
  };

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
    if (channel?.id) {
      checkUserRoom();
    }
  }, [channel?.id]);

  useEffect(() => {
    if (channel?.id) {
      loadMessages();
    }
  }, [channel?.id, isInRoom, currentRoom]);

  useEffect(() => {
    if (server?.id && userProfile?.uid) {
      loadServerRoles();
      loadUserPermissions();
    }
  }, [server?.id, userProfile?.uid]);

  const loadUserPermissions = async () => {
    if (!server?.id || !userProfile?.uid) return;
    
    try {
      // Backend'den doğrudan permission'ları al
      const permissions = await checkUserPermissions(server.id, userProfile.uid);
      
      setUserPermissions({
        canSendMessages: permissions.canSendMessages,
        canAttachFiles: permissions.canAttachFiles,
        canMentionEveryone: permissions.canMentionEveryone,
        canConnect: permissions.canConnect,
        canSpeak: permissions.canSpeak,
        canVideo: permissions.canVideo,
        canMuteMembers: permissions.canMuteMembers,
        canDeafenMembers: permissions.canDeafenMembers,
        canMoveMembers: permissions.canMoveMembers
      });
    } catch (error) {
      console.error('Error loading user permissions:', error);
      // Hata durumunda tüm izinleri kapat
      setUserPermissions({
        canSendMessages: false,
        canAttachFiles: false,
        canMentionEveryone: false,
        canConnect: false,
        canSpeak: false,
        canVideo: false,
        canMuteMembers: false,
        canDeafenMembers: false,
        canMoveMembers: false
      });
    }
  };

  const loadServerRoles = async () => {
    if (!server?.id) return;
    
    try {
      const roles = await getServerRoles(server.id);
      setServerRoles(roles);
    } catch (error) {
      console.error('Error loading server roles:', error);
    }
  };

  const checkUserRoom = async () => {
    if (!userProfile?.uid) return;
    
    const result = await getUserCurrentRoom(userProfile.uid);
    if (result.success && result.data) {
      setCurrentRoom(result.data);
      setIsInRoom(true);
    } else {
      setCurrentRoom(null);
      setIsInRoom(false);
    }
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const loadMessages = () => {
    if (!channel?.id) return;
    
    // Önceki dinleyiciyi temizle
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);
    
    try {
      // Eğer kullanıcı odadaysa oda mesajlarını yükle, yoksa kanal mesajlarını
      if (isInRoom && currentRoom) {
        const unsubscribe = subscribeToRoomMessages(currentRoom.id, (firebaseMessages) => {
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
          setLoading(false);
        });
        unsubscribeRef.current = unsubscribe;
      } else {
        // Kanal mesajlarını yükle
        const unsubscribe = subscribeToChannelMessages(channel.id, (firebaseMessages) => {
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
          setLoading(false);
        });
        unsubscribeRef.current = unsubscribe;
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
    }
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

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !channel?.id || !userProfile?.uid || sendingMessage) return;
    
    setSendingMessage(true);
    setFileError(null);

    // İzin kontrolleri
    if (!userPermissions.canSendMessages) {
      setFileError('Mesaj gönderme izniniz yok.');
      setSendingMessage(false);
      return;
    }
    
    if (selectedFile && !userPermissions.canAttachFiles) {
      setFileError('Dosya ekleme izniniz yok.');
      setSendingMessage(false);
      return;
    }
    
    // @everyone kontrolü
    if (newMessage.includes('@everyone') && !userPermissions.canMentionEveryone) {
      setFileError('@everyone kullanma izniniz yok.');
      setSendingMessage(false);
      return;
    }
    
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
        const uploadPath = server?.id ? `messages/${server.id}/${channel.id}` : `messages/dm/${channel.id}`;
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
      // Eğer kullanıcı odadaysa oda mesajı gönder, yoksa kanal mesajı gönder
      if (isInRoom && currentRoom) {
        await sendRoomMessage(
          currentRoom.id,
          server.id,
          messageContent,
          userProfile.uid,
          userProfile.displayName || 'Anonim',
          userProfile.photoURL || '',
          attachments.length > 0 ? attachments : undefined
        );
      } else {
        await sendMessage(
          channel.id,
          userProfile.uid,
          userProfile.displayName,
          messageContent,
          server?.id,
          userProfile.photoURL || undefined,
          undefined,
          attachments.length > 0 ? attachments : undefined
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setFileError('Mesaj veya dosya gönderilemedi.');
      setNewMessage(messageContent);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Mention önerilerini kontrol et
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    
    // Rol bahsetme kontrolü (@&)
    const roleMatch = textBeforeCursor.match(/@&(\w*)$/);
    if (roleMatch) {
      const searchTerm = roleMatch[1].toLowerCase();
      const filteredRoles = serverRoles.filter(role => 
        role.name.toLowerCase().includes(searchTerm)
      );
      setMentionSuggestions(filteredRoles);
      setMentionType('role');
      setShowMentionSuggestions(true);
      return;
    }
    
    // Kullanıcı bahsetme kontrolü (@)
    const userMatch = textBeforeCursor.match(/@(\w*)$/);
    if (userMatch) {
      const searchTerm = userMatch[1].toLowerCase();
      
      // @everyone önerisi ekle
      let suggestions: any[] = [];
      
      if (userPermissions.canMentionEveryone && 'everyone'.includes(searchTerm)) {
        suggestions.push({ 
          id: 'everyone', 
          type: 'everyone', 
          name: 'everyone',
          displayName: 'everyone' 
        });
      }
      
      // Normal kullanıcı önerileri
      const filteredMembers = serverMembers.filter(member => 
        member.user?.displayName.toLowerCase().includes(searchTerm)
      );
      
      suggestions = [...suggestions, ...filteredMembers];
      
      setMentionSuggestions(suggestions);
      setMentionType('user');
      setShowMentionSuggestions(true);
      return;
    }
    
    setShowMentionSuggestions(false);
  };

  const handleMentionSelect = (suggestion: any) => {
    const cursorPosition = newMessage.length;
    const textBeforeCursor = newMessage;
    
    let newText = '';
    if (mentionType === 'role') {
      const roleMatch = textBeforeCursor.match(/@&(\w*)$/);
      if (roleMatch) {
        newText = textBeforeCursor.replace(/@&(\w*)$/, `@&${suggestion.name} `);
      }
    } else {
      const userMatch = textBeforeCursor.match(/@(\w*)$/);
      if (userMatch) {
        if (suggestion.type === 'everyone') {
          newText = textBeforeCursor.replace(/@(\w*)$/, `@everyone `);
        } else {
          newText = textBeforeCursor.replace(/@(\w*)$/, `@${suggestion.user.displayName} `);
        }
      }
    }
    
    setNewMessage(newText);
    setShowMentionSuggestions(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
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

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice': return <VolumeUp />;
      case 'game': return <Tag />;
      default: return '#';
    }
  };

  // Mesaj silme fonksiyonu
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Mesajı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Mesaj silinirken hata:', error);
    }
  };

  // Rol rengini al
  const getRoleColor = (roleId: string) => {
    // Önce özel rolleri kontrol et
    const customRole = serverRoles.find(r => r.id === roleId);
    if (customRole) {
      return customRole.color;
    }
    
    // Sistem rolleri için varsayılan renkler
    switch (roleId) {
      case 'owner': return '#f04747';
      case 'admin': return '#ff9500';
      case 'moderator': return '#5865f2';
      default: return '#99aab5';
    }
  };

  // Rol adını al
  const getRoleName = (roleId: string) => {
    // Önce özel rolleri kontrol et
    const customRole = serverRoles.find(r => r.id === roleId);
    if (customRole) {
      return customRole.name;
    }
    
    // Sistem rolleri için varsayılan isimler
    switch (roleId) {
      case 'owner': return 'Sahip';
      case 'admin': return 'Admin';
      case 'moderator': return 'Moderatör';
      case 'member': return 'Üye';
      default: return roleId;
    }
  };

  // Üyeleri rollerine göre gruplandır
  const getGroupedMembers = () => {
    const groups: { [key: string]: { members: ServerMember[], priority: number, color: string } } = {};
    
    serverMembers.forEach(member => {
      if (!member.user) return;
      
      // Üyenin en yüksek rolünü bul
      let highestRole = 'member';
      let highestPriority = 0;
      
      member.roles.forEach(roleId => {
        let priority = 0;
        
        // Sistem rolleri için öncelik
        switch (roleId) {
          case 'owner': priority = 1000; break;
          case 'admin': priority = 900; break;
          case 'moderator': priority = 800; break;
          case 'member': priority = 100; break;
          default:
            // Özel roller için pozisyona göre öncelik
            const customRole = serverRoles.find(r => r.id === roleId);
            if (customRole) {
              priority = 500 + (customRole.position || 0);
            }
        }
        
        if (priority > highestPriority) {
          highestPriority = priority;
          highestRole = roleId;
        }
      });
      
      const roleName = getRoleName(highestRole);
      const roleColor = getRoleColor(highestRole);
      
      if (!groups[roleName]) {
        groups[roleName] = {
          members: [],
          priority: highestPriority,
          color: roleColor
        };
      }
      
      groups[roleName].members.push(member);
    });
    
    // Grupları önceliğe göre sırala
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1].priority - a[1].priority);
    
    return sortedGroups.map(([roleName, group]) => ({
      roleName,
      members: group.members.sort((a, b) => 
        (a.user?.displayName || '').localeCompare(b.user?.displayName || '')
      ),
      color: group.color
    }));
  };

  // Üyenin tüm rollerini göster
  const renderMemberRoles = (member: ServerMember) => {
    if (!member.roles || member.roles.length === 0) return null;
    
    // 'member' rolünü filtrele ve diğer rolleri göster
    const visibleRoles = member.roles.filter(roleId => roleId !== 'member');
    
    if (visibleRoles.length === 0) return null;
    
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {visibleRoles.map(roleId => (
          <Chip
            key={roleId}
            label={getRoleName(roleId)}
            size="small"
            sx={{
              height: 16,
              fontSize: '0.7rem',
              backgroundColor: getRoleColor(roleId),
              color: 'white'
            }}
          />
        ))}
      </Box>
    );
  };

  if (!channel) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center'
      }}>
        <Box>
          <Typography variant="h5" color="white" gutterBottom>
            Kanal Seçin
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Sol taraftan bir kanal seçerek mesajlaşmaya başlayın.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Ana Mesaj Alanı */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Channel Header */}
        <Box sx={{ 
          p: 2, 
          borderBottom: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          backgroundColor: isInRoom && currentRoom ? '#43b581' : (isDarkMode ? '#36393f' : '#ffffff')
        }}>
          <Typography variant="h6" color={isDarkMode ? 'white' : 'black'} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ color: isInRoom && currentRoom ? 'white' : 'text.secondary' }}>
              {isInRoom && currentRoom ? 
                (currentRoom.type === 'voice' ? '🔊' : currentRoom.type === 'video' ? '📹' : '📺') :
                getChannelIcon(channel.type)
              }
            </Box>
            {isInRoom && currentRoom ? currentRoom.name : channel.name}
          </Typography>
          {isInRoom && currentRoom ? (
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              Ses odasında • {currentRoom.currentUsers.length} kişi
            </Typography>
          ) : (
            channel.description && (
              <Typography variant="body2" color="text.secondary">
                {channel.description}
              </Typography>
            )
          )}
        </Box>

        {/* Mesajlar */}
        <Box sx={{ 
          flexGrow: 1, 
          overflowY: 'auto', 
          p: 2,
          backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
          height: 0, // Flexbox'ta scroll çalışması için
          display: 'flex',
          flexDirection: 'column'
        }}>
          {loading ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              flexGrow: 1
            }}>
              <CircularProgress />
            </Box>
          ) : messages.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexGrow: 1,
              textAlign: 'center'
            }}>
              <Typography variant="h6" color={isDarkMode ? 'white' : 'black'} gutterBottom>
                #{channel.name} kanalına hoş geldiniz!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bu kanalda henüz mesaj yok. İlk mesajı göndermek için aşağıdaki kutucuğu kullanın.
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
                  <ListItem key={message.id} alignItems="flex-start" sx={{ px: 0, py: 1, position: 'relative', '&:hover .delete-button': { opacity: 1 } }}>
                    <Box sx={{ display: 'flex', width: '100%', gap: 2 }}>
                      <Avatar 
                        src={message.authorPhoto}
                        sx={{ width: 48, height: 48, flexShrink: 0 }}
                      >
                        {message.authorName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0, position: 'relative' }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2" color={isDarkMode ? 'white' : 'black'} fontWeight="bold">
                            {message.authorName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(message.timestamp)}
                          </Typography>
                          {/* Silme butonu sadece kendi mesajı için */}
                          {message.isOwn && (
                            <IconButton
                              size="small"
                              className="delete-button"
                              sx={{ ml: 1, opacity: 0, transition: 'opacity 0.2s', color: 'error.main', position: 'absolute', right: 0, top: 0 }}
                              onClick={() => handleDeleteMessage(message.id)}
                            >
                              <span className="material-icons">delete</span>
                            </IconButton>
                          )}
                        </Box>
                        <Box sx={{ 
                          color: isDarkMode ? 'white' : 'black', 
                          wordBreak: 'break-word',
                          fontSize: '0.875rem',
                          lineHeight: 1.43,
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          gap: 0
                        }}>
                          {renderMessageContent(message.content)}
                        </Box>
                        {renderMessageAttachments(message.attachments || [])}
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
          {showMentionSuggestions && (
            <Box sx={{ 
              position: 'absolute', 
              bottom: 60, 
              left: 0, 
              right: 0, 
              zIndex: 2000,
              backgroundColor: isDarkMode ? '#36393f' : '#ffffff',
              border: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
              borderRadius: 1,
              maxHeight: 200,
              overflowY: 'auto'
            }}>
              {mentionSuggestions.map((suggestion, index) => (
                <Box
                  key={index}
                  onClick={() => handleMentionSelect(suggestion)}
                  sx={{
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: isDarkMode ? '#40444b' : '#e0e0e0'
                    }
                  }}
                >
                  {mentionType === 'role' ? (
                    <>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: suggestion.color || '#5865f2'
                        }}
                      />
                      <Typography variant="body2" color={isDarkMode ? 'white' : 'black'}>
                        @{suggestion.name}
                      </Typography>
                    </>
                  ) : suggestion.type === 'everyone' ? (
                    <>
                      <Avatar
                        sx={{ 
                          width: 24, 
                          height: 24,
                          backgroundColor: '#f04747'
                        }}
                      >
                        @
                      </Avatar>
                      <Typography variant="body2" color={isDarkMode ? 'white' : 'black'} sx={{ fontWeight: 'bold' }}>
                        @everyone
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Avatar
                        src={suggestion.user?.photoURL}
                        sx={{ width: 24, height: 24 }}
                      >
                        {suggestion.user?.displayName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" color={isDarkMode ? 'white' : 'black'}>
                        @{suggestion.user?.displayName}
                      </Typography>
                    </>
                  )}
                </Box>
              ))}
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
            placeholder={
              !userPermissions.canSendMessages 
                ? "Mesaj gönderme izniniz yok"
                : isInRoom && currentRoom 
                  ? `${currentRoom.name} odasında mesaj gönderin...` 
                  : `#${channel.name} kanalında mesaj gönderin...`
            }
            value={newMessage}
            onChange={handleMessageChange}
            onKeyPress={handleKeyPress}
            disabled={!userPermissions.canSendMessages}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: !userPermissions.canSendMessages ? (isDarkMode ? '#2f3136' : '#f0f0f0') : (isDarkMode ? '#40444b' : '#f0f0f0'),
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
                  <IconButton 
                    size="small" 
                    sx={{ 
                      color: userPermissions.canAttachFiles ? 'text.secondary' : 'text.disabled' 
                    }} 
                    onClick={openFileDialog}
                    disabled={!userPermissions.canAttachFiles || !userPermissions.canSendMessages}
                  >
                    <AttachFile />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    size="small" 
                    sx={{ 
                      color: userPermissions.canSendMessages ? 'text.secondary' : 'text.disabled' 
                    }} 
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    disabled={!userPermissions.canSendMessages}
                  >
                    <EmojiEmotions />
                  </IconButton>
                  <IconButton 
                    onClick={handleSendMessage}
                    disabled={!userPermissions.canSendMessages || (!newMessage.trim() && !selectedFile) || sendingMessage}
                    size="small" 
                    sx={{ 
                      color: (userPermissions.canSendMessages && (newMessage.trim() || selectedFile) && !sendingMessage) ? '#5865f2' : 'text.secondary',
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
      </Box>

      {/* Sağ Panel - Üye Listesi */}
      <Box sx={{ 
        width: 200, 
        backgroundColor: isDarkMode ? '#2f3136' : '#f5f5f5',
        borderLeft: `1px solid ${isDarkMode ? '#40444b' : '#e0e0e0'}`,
        display: 'flex',
        flexDirection: 'column',
        p: 2
      }}>
        {/* Eğer odadaysa oda katılımcılarını göster */}
        {isInRoom && currentRoom ? (
          <>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {currentRoom.name} — {currentRoom.currentUsers.length} kişi
            </Typography>
            <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
              {currentRoom.currentUsers.map((userId: string) => {
                const member = serverMembers.find(m => m.userId === userId);
                if (!member || !member.user) return null;
                
                return (
                  <ListItem key={userId} sx={{ px: 0, py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <Circle
                            sx={{
                              width: 8,
                              height: 8,
                              color: getStatusColor(member.user.status),
                            }}
                          />
                        }
                      >
                        <Avatar 
                          src={member.user.photoURL}
                          sx={{ 
                            width: 32, 
                            height: 32, 
                            cursor: 'pointer',
                            border: userId === userProfile?.uid ? '2px solid #43b581' : 'none'
                          }}
                          onClick={() => {
                            setProfileDialogUser(member.user);
                            setProfileDialogRoles(member.roles);
                            setProfileDialogOpen(true);
                          }}
                        >
                          {member.user.displayName.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                    <Typography
                              variant="body2"
                              color={isDarkMode ? 'white' : 'black'}
                              sx={{ 
                                fontSize: '0.85rem', 
                                cursor: 'pointer',
                                fontWeight: userId === userProfile?.uid ? 'bold' : 'normal'
                              }}
                              noWrap
                              onClick={() => {
                                setProfileDialogUser(member.user);
                                setProfileDialogRoles(member.roles);
                                setProfileDialogOpen(true);
                              }}
                            >
                              {member.user.displayName}
                            </Typography>
                        {renderMemberRoles(member)}
                      </Box>
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          </>
        ) : (
          /* Normal sunucu üyeleri */
          <>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Üyeler — {serverMembers.length}
            </Typography>
            <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
              {getGroupedMembers().map((group, groupIndex) => (
                <Box key={groupIndex} sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {group.roleName}
                  </Typography>
                  {group.members.map((member) => {
                    if (!member.user) return null;
                    
                    return (
                      <ListItem key={member.id} sx={{ px: 0, py: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                          <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            badgeContent={
                              <Circle
                                sx={{
                                  width: 8,
                                  height: 8,
                                  color: getStatusColor(member.user.status),
                                }}
                              />
                            }
                          >
                            <Avatar 
                              src={member.user.photoURL}
                              sx={{ width: 32, height: 32, cursor: 'pointer' }}
                              onClick={() => {
                                setProfileDialogUser(member.user);
                                setProfileDialogRoles(member.roles);
                                setProfileDialogOpen(true);
                              }}
                            >
                              {member.user.displayName.charAt(0).toUpperCase()}
                            </Avatar>
                          </Badge>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              color={isDarkMode ? 'white' : 'black'}
                              sx={{ fontSize: '0.85rem', cursor: 'pointer' }}
                              noWrap
                              onClick={() => {
                                setProfileDialogUser(member.user);
                                setProfileDialogRoles(member.roles);
                                setProfileDialogOpen(true);
                              }}
                            >
                              {member.user.displayName}
                            </Typography>
                            {renderMemberRoles(member)}
                          </Box>
                        </Box>
                      </ListItem>
                    );
                  })}
                </Box>
              ))}
            </List>
          </>
        )}
      </Box>
      <UserProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        user={profileDialogUser || { displayName: '', photoURL: '' }}
        roles={profileDialogRoles}
        serverRoles={serverRoles}
      />
    </Box>
  );
}; 