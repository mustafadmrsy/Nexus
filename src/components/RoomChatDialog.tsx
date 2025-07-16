import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  InputAdornment,
  Badge,
  Divider,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  Send,
  AttachFile,
  EmojiEmotions,
  Close,
  Mic,
  MicOff,
  Headphones,
  VolumeOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  StopScreenShare,
  Settings,
  FullscreenExit,
  Minimize,
  PersonAdd
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToRoomMessages, sendRoomMessage } from '../services/messageService';
import { webrtcService, PeerInfo } from '../services/webrtcService';
import { getServerRoles } from '../services/roleService';
import { checkUserPermissions } from '../services/serverService';
import { Room, ServerMember } from '../types';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import VoiceChannelInviteDialog from './VoiceChannelInviteDialog';

interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  timestamp: Date;
  isOwn: boolean;
}

interface RoomChatDialogProps {
  open: boolean;
  onClose: () => void;
  onMinimize: () => void;
  room: Room;
  server: any;
  participants: { [userId: string]: any };
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeaveRoom: () => void;
  isMinimized?: boolean;
  serverMembers?: ServerMember[];
}

export const RoomChatDialog: React.FC<RoomChatDialogProps> = ({
  open,
  onClose,
  onMinimize,
  room,
  server,
  participants,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  onLeaveRoom,
  isMinimized = false,
  serverMembers = []
}) => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // WebRTC state
  const [webrtcPeers, setWebrtcPeers] = useState<PeerInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [webrtcInitialized, setWebrtcInitialized] = useState(false);
  const [fullscreenUserId, setFullscreenUserId] = useState<string | null>(null);
  const videoRefs = useRef<{ [userId: string]: HTMLVideoElement }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [serverRoles, setServerRoles] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState({
    canSpeak: true,
    canVideo: true,
    canMuteMembers: false,
    canDeafenMembers: false,
    canMoveMembers: false
  });
  
  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [canInviteUsers, setCanInviteUsers] = useState(false);

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

  // Local video stream güncelleme
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Server rollerini yükle
  useEffect(() => {
    if (server?.id) {
      loadServerRoles();
      loadUserPermissions();
    }
  }, [server?.id, userProfile?.uid]);

  const loadServerRoles = async () => {
    if (!server?.id) return;
    
    try {
      const roles = await getServerRoles(server.id);
      setServerRoles(roles);
    } catch (error) {
      console.error('Error loading server roles:', error);
    }
  };

  const loadUserPermissions = async () => {
    if (!server?.id || !userProfile?.uid) return;
    
    try {
      const permissions = await checkUserPermissions(server.id, userProfile.uid);
      setUserPermissions({
        canSpeak: permissions.canSpeak,
        canVideo: permissions.canVideo,
        canMuteMembers: permissions.canMuteMembers,
        canDeafenMembers: permissions.canDeafenMembers,
        canMoveMembers: permissions.canMoveMembers
      });
      
      // Set invite permission
      setCanInviteUsers(permissions.canMoveMembers);
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
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
            <Box
              key={`role-${match.index}`}
              component="span"
              sx={{
                backgroundColor: role.color || '#5865f2',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                margin: '0 2px',
                display: 'inline-block'
              }}
            >
              @{role.name}
            </Box>
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
        const participant = participants.find((p: any) => p.displayName.toLowerCase() === username.toLowerCase());
        if (participant) {
          result.push(
            <Box
              key={`user-${match.index}`}
              component="span"
              sx={{
                backgroundColor: '#5865f2',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                margin: '0 2px',
                display: 'inline-block'
              }}
            >
              @{participant.displayName}
            </Box>
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
          <Box
            key={`everyone-${match.index}`}
            component="span"
            sx={{
              backgroundColor: '#f04747',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              margin: '0 2px',
              display: 'inline-block'
            }}
          >
            @everyone
          </Box>
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

  // Debug audio elements
  useEffect(() => {
    const checkAudioElements = () => {
      const videos = document.querySelectorAll('video');
      const audios = document.querySelectorAll('audio[data-user-id]');
      console.log(`🎵 Audio/Video elements: videos: ${videos.length}, audios: ${audios.length}`);
      
      audios.forEach((audio, index) => {
        const userId = audio.getAttribute('data-user-id');
        const stream = (audio as HTMLAudioElement).srcObject as MediaStream;
        const audioTracks = stream ? stream.getAudioTracks() : [];
        console.log(`🎵 Audio ${index} - User: ${userId}, Stream: ${!!stream}, AudioTracks: ${audioTracks.length}, Playing: ${!(audio as HTMLAudioElement).paused}, Muted: ${(audio as HTMLAudioElement).muted}`);
        
        if (audioTracks.length > 0) {
          audioTracks.forEach((track, trackIndex) => {
            console.log(`🎵   Track ${trackIndex}: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
          });
        }
      });
    };
    
    checkAudioElements();
    const interval = setInterval(checkAudioElements, 3000);
    return () => clearInterval(interval);
  }, [participants, webrtcPeers]);

  // Deafen durumunda audio elementlerini otomatik mute et
  useEffect(() => {
    const audioElements = document.querySelectorAll('audio[data-user-id]');
    audioElements.forEach(audioElement => {
      const audioEl = audioElement as HTMLAudioElement;
      audioEl.muted = isDeafened;
    });
    
    console.log(`🔇 Deafen effect: ${isDeafened ? 'Muted' : 'Unmuted'} ${audioElements.length} audio elements`);
  }, [isDeafened, webrtcPeers]);

  // Minimize durumunda bile audio elementlerinin çalışmasını sağla
  useEffect(() => {
    if (isMinimized) {
      console.log('🎵 Modal minimized, ensuring audio elements are working');
      
      // Audio elementlerini kontrol et ve gerekirse yeniden başlat
      const audioElements = document.querySelectorAll('audio[data-user-id]');
      audioElements.forEach(audioElement => {
        const audioEl = audioElement as HTMLAudioElement;
        if (audioEl.paused && audioEl.srcObject) {
          audioEl.play().catch(console.error);
        }
        audioEl.muted = isDeafened;
      });
    }
  }, [isMinimized, isDeafened]);

  useEffect(() => {
    if (room?.id) {
      loadMessages();
      // WebRTC'yi sadece ilk kez initialize et
      if (!webrtcInitialized) {
        initializeWebRTC();
      }
    }
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      // Messages cleanup'ı - WebRTC'yi koruyoruz
    };
  }, [room?.id]);

  // Component unmount olduğunda WebRTC cleanup
  useEffect(() => {
    return () => {
      if (webrtcInitialized) {
        cleanupWebRTC();
      }
    };
  }, []);

  // WebRTC initialization
  const initializeWebRTC = async () => {
    if (!userProfile?.uid || !room?.id || webrtcInitialized) return;

    // HTTPS kontrolü
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('WebRTC requires HTTPS in production');
      alert('Sesli sohbet ve ekran paylaşımı için HTTPS bağlantısı gereklidir.');
      return;
    }

    // Mikrofon izni kontrolü
    try {
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🎤 Microphone permission status:', permissions.state);
      
      if (permissions.state === 'denied') {
        alert('Sesli sohbet için mikrofon izni gerekli. Lütfen tarayıcı ayarlarından mikrofon iznini etkinleştirin.');
        return;
      }
    } catch (error) {
      console.log('Permission API not supported, continuing...');
    }

    try {
      // Setup event listeners
      webrtcService.onPeerJoinedListener((peer) => {
        setWebrtcPeers(prev => [...prev.filter(p => p.userId !== peer.userId), peer]);
        
        // Setup video element for peer
        setTimeout(() => {
          const videoElement = videoRefs.current[peer.userId];
          if (videoElement && peer.stream) {
            videoElement.srcObject = peer.stream;
          }
        }, 100);
      });

      webrtcService.onPeerLeftListener((userId) => {
        setWebrtcPeers(prev => prev.filter(p => p.userId !== userId));
        delete videoRefs.current[userId];
      });

      console.log(`🔧 Setting up onPeerStreamChangedListener`);
      webrtcService.onPeerStreamChangedListener((userId, stream) => {
        console.log(`🔄 Stream changed for ${userId}:`, stream);
        
        // Update peer state with new stream
        setWebrtcPeers(prev => prev.map(peer => 
          peer.userId === userId ? { ...peer, stream: stream || undefined } : peer
        ));
        
        const videoElement = videoRefs.current[userId];
        if (videoElement && videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
          console.log(`✅ Updated video element for ${userId}`);
        }
        
        // Also update audio elements - sadece farklı stream'lerde
        const audioElements = document.querySelectorAll(`audio[data-user-id="${userId}"]`);
        audioElements.forEach(audioElement => {
          const audioEl = audioElement as HTMLAudioElement;
          if (audioEl.srcObject !== stream) {
            audioEl.srcObject = stream;
            audioEl.play().catch(console.error);
          }
        });
        console.log(`🔊 Updated ${audioElements.length} audio elements for ${userId}`);
      });

      webrtcService.onPeerSpeakingChangedListener((userId, isSpeaking) => {
        setSpeakingUsers(prev => {
          const newSet = new Set(prev);
          if (isSpeaking) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      });

      webrtcService.onLocalStreamChangedListener((stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });

      // Mevcut mikrofon durumunu kontrol et
      const currentMediaSettings = webrtcService.getMediaSettings();
      let audioPermissionGranted = currentMediaSettings.audio; // Mevcut durumu koru
      
      // Eğer daha önce ses durumu ayarlanmadıysa, mikrofon izni kontrol et
      if (!webrtcInitialized) {
        try {
          console.log('🎤 Checking microphone access for first time...');
          const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('🎤 Microphone access granted');
          audioPermissionGranted = true;
          testStream.getTracks().forEach(track => track.stop()); // Test stream'i durdur
        } catch (error) {
          console.warn('🎤 Microphone access denied or failed:', error);
          audioPermissionGranted = false;
        }
      } else {
        console.log('🎤 Using existing microphone state:', audioPermissionGranted);
      }

      // Join WebRTC room
      const result = await webrtcService.joinRoom(
        room.id,
        userProfile.uid,
        userProfile.displayName || 'Anonim',
        userProfile.photoURL || '',
        { audio: audioPermissionGranted, video: false, screen: false } // Mevcut ses durumunu koru
      );

      if (result.success) {
        setWebrtcInitialized(true);
        
        // WebRTC service artık kendi participant tracking'ini yapıyor
        // Eski participants prop'una güvenmek yerine WebRTC'nin kendi sistemini kullanıyoruz
        console.log('WebRTC initialized successfully for room:', room.id);
        
        // Ses durumunu kontrol et ve logla
        setTimeout(() => {
          const mediaSettings = webrtcService.getMediaSettings();
          const localStream = webrtcService.getLocalStream();
          console.log('🎵 Post-init audio check:', {
            mediaSettings,
            hasLocalStream: !!localStream,
            audioTracks: localStream ? localStream.getAudioTracks().length : 0,
            audioEnabled: localStream ? localStream.getAudioTracks().some(t => t.enabled) : false
          });
          
          // Eğer ses açık olması bekleniyordu ama kapalıysa, kullanıcıya bildir
          if (!mediaSettings.audio) {
            console.warn('⚠️ Mikrofon başlatılamadı - kullanıcıya bildirim göster');
            // Kullanıcıya mikrofon durumunu bildir
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #f44336;
              color: white;
              padding: 12px 16px;
              border-radius: 8px;
              z-index: 10000;
              font-family: Arial, sans-serif;
              font-size: 14px;
              max-width: 300px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            `;
            notification.innerHTML = `
              <strong>Mikrofon Kapalı</strong><br>
              Sesli sohbet için mikrofon izni gerekli.<br>
              Mikrofon butonuna tıklayarak açabilirsiniz.
            `;
            document.body.appendChild(notification);
            
            // 5 saniye sonra bildirimi kaldır
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 5000);
          }
        }, 1000);
      } else {
        console.error('WebRTC initialization failed:', result.error);
        alert('Sesli sohbet başlatılamadı: ' + result.error);
      }
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      alert('Sesli sohbet başlatılırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  };

  const cleanupWebRTC = async () => {
    if (webrtcInitialized) {
      await webrtcService.leaveRoom();
      setWebrtcInitialized(false);
      setWebrtcPeers([]);
      setLocalStream(null);
      setSpeakingUsers(new Set());
      videoRefs.current = {};
    }
  };

  const loadMessages = () => {
    if (!room?.id) return;
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);
    
    try {
      const unsubscribe = subscribeToRoomMessages(room.id, (firebaseMessages) => {
        const convertedMessages = firebaseMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          authorId: msg.authorId,
          authorName: msg.authorName,
          authorPhoto: msg.authorPhotoURL || '',
          timestamp: msg.timestamp,
          isOwn: msg.authorId === userProfile?.uid
        }));
        setMessages(convertedMessages);
        setLoading(false);
      });

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error loading room messages:', error);
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !room?.id || !userProfile?.uid || sendingMessage) return;
    
    setSendingMessage(true);
    const messageContent = newMessage.trim();
    setNewMessage('');
    setShowEmojiPicker(false);

    try {
      await sendRoomMessage(
        room.id,
        server.id,
        messageContent,
        userProfile.uid,
        userProfile.displayName || 'Anonim',
        userProfile.photoURL || ''
      );
    } catch (error) {
      console.error('Error sending room message:', error);
      setNewMessage(messageContent);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setNewMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleLeaveRoom = () => {
    onLeaveRoom();
    onClose();
  };

  // WebRTC media control handlers
  const handleToggleVideo = async () => {
    if (webrtcInitialized) {
      try {
        const enabled = await webrtcService.toggleVideo();
        setIsVideoEnabled(enabled);
        console.log('Video toggled:', enabled);
        
        // Video stream'i güncelle
        const localStream = webrtcService.getLocalStream();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
             } catch (error) {
         console.error('Error toggling video:', error);
         const errorMessage = error instanceof Error ? error.message : 'Kamera açılamadı.';
         alert(errorMessage);
       }
    } else {
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

    const handleToggleScreenShare = async () => {
    if (webrtcInitialized) {
      // Önce destek kontrolü yap
      const supportCheck = webrtcService.checkScreenShareSupport();
      if (!supportCheck.supported) {
        alert(`Ekran paylaşımı desteklenmiyor: ${supportCheck.reason}`);
        return;
      }

      try {
        const enabled = await webrtcService.toggleScreenShare();
        setIsScreenSharing(enabled);
        console.log('Screen share toggled:', enabled);
        
        // Screen share stream'i güncelle
        const localStream = webrtcService.getLocalStream();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      } catch (error) {
        console.error('Error toggling screen share:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ekran paylaşımı başlatılamadı.';
        
        // Hata türüne göre farklı mesajlar
        let userMessage = '';
        let solutions = [];
        
        if (errorMessage.includes('Not supported') || errorMessage.includes('desteklenmiyor')) {
          userMessage = 'Ekran paylaşımı bu tarayıcı sürümünde desteklenmiyor.';
          solutions = [
            'Chrome 72+ veya Firefox 66+ kullanın',
            'Tarayıcınızı en son sürüme güncelleyin',
            'Farklı bir tarayıcı deneyin'
          ];
        } else if (errorMessage.includes('NotAllowedError') || errorMessage.includes('denied') || errorMessage.includes('cancelled')) {
          userMessage = 'Ekran paylaşımı izni reddedildi.';
          solutions = [
            'Tarayıcının izin penceresinde "İzin Ver" seçeneğini tıklayın',
            'Adres çubuğundaki kilit simgesine tıklayıp izinleri kontrol edin',
            'Tarayıcı ayarlarından site izinlerini sıfırlayın'
          ];
        } else if (errorMessage.includes('NotReadableError')) {
          userMessage = 'Ekran paylaşımı kaynağına erişilemiyor.';
          solutions = [
            'Başka uygulamalar ekranı kullanıyor olabilir',
            'Bilgisayarınızı yeniden başlatın',
            'Farklı bir ekran seçin'
          ];
        } else if (errorMessage.includes('Timeout')) {
          userMessage = 'Ekran paylaşımı zaman aşımına uğradı.';
          solutions = [
            'İnternet bağlantınızı kontrol edin',
            'Tarayıcıyı yeniden başlatın',
            'Tekrar deneyin'
          ];
        } else {
          userMessage = 'Ekran paylaşımı başlatılamadı.';
          solutions = [
            'Tarayıcınızı yenileyin ve tekrar deneyin',
            'Farklı bir tarayıcı deneyin',
            'Bilgisayarınızı yeniden başlatın'
          ];
        }
        
        const detailedMessage = `${userMessage}\n\nÖnerilen çözümler:\n${solutions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nTeknik hata: ${errorMessage}`;
        alert(detailedMessage);
      }
    } else {
      setIsScreenSharing(!isScreenSharing);
    }
  };

  const handleToggleMute = async () => {
    // Parent callback'i çağır - bu artık WebRTC service'i de çağırıyor
    await onToggleMute();
  };

  const handleToggleDeafen = () => {
    // Parent callback'i çağır - bu artık audio elementlerini de kontrol ediyor
    onToggleDeafen();
  };

  const handleUserClick = async (userId: string) => {
    const isClosing = fullscreenUserId === userId;
    
    if (isClosing) {
      setFullscreenUserId(null);
    } else {
      setFullscreenUserId(userId);
      
      // Eğer kendi kameranı tam ekrana alıyorsan ve kamera kapalıysa, kullanıcıya sor
      if (userId === userProfile?.uid && !isVideoEnabled && webrtcInitialized) {
        const shouldEnableCamera = window.confirm('Kameranı tam ekranda görmek için kamerayı açmak ister misin?');
        
        if (shouldEnableCamera) {
          console.log('🎥 Opening camera for fullscreen view');
          try {
            const enabled = await webrtcService.toggleVideo();
            setIsVideoEnabled(enabled);
            console.log('🎥 Camera enabled for fullscreen:', enabled);
          } catch (error) {
            console.error('Error enabling camera:', error);
            alert('Kamera açılırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
          }
        }
      }
    }
  };

  const handleCloseFullscreen = () => {
    setFullscreenUserId(null);
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSettings = async () => {
    // Ses/video ayarları menüsü
    const settings = webrtcService.getMediaSettings();
    const screenSupport = webrtcService.checkScreenShareSupport();
    
    // Ekran paylaşımı testi yap
    const testResult = await webrtcService.testScreenShare();
    
    const info = `
Mevcut Ayarlar:
- Ses: ${settings.audio ? 'Açık' : 'Kapalı'}
- Video: ${settings.video ? 'Açık' : 'Kapalı'}
- Ekran Paylaşımı: ${settings.screen ? 'Açık' : 'Kapalı'}
- WebRTC: ${webrtcInitialized ? 'Aktif' : 'Pasif'}
- Local Stream: ${localStream ? 'Var' : 'Yok'}
- Konuşan Kullanıcılar: ${speakingUsers.size}

Tarayıcı Desteği:
- Ekran Paylaşımı: ${screenSupport.supported ? '✅ Destekleniyor' : '❌ ' + screenSupport.reason}
- Protocol: ${location.protocol}
- Hostname: ${location.hostname}
- MediaDevices: ${navigator.mediaDevices ? '✅' : '❌'}
- getDisplayMedia: ${navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices ? '✅' : '❌'}
- User Agent: ${navigator.userAgent}

Ekran Paylaşımı Testi:
- Test Sonucu: ${testResult.success ? '✅ Başarılı' : '❌ Başarısız'}
${testResult.error ? `- Hata: ${testResult.error}` : ''}
    `;
    alert(info);
  };

  console.log('RoomChatDialog render - open:', open, 'room:', room?.name, 'participants:', Object.keys(participants).length);
  console.log('Media states:', { 
    isVideoEnabled, 
    isScreenSharing, 
    isMuted, 
    isDeafened, 
    webrtcInitialized,
    hasLocalStream: !!localStream,
    speakingUsersCount: speakingUsers.size
  });

  // Minimize durumunda sadece audio elementlerini render et
  if (isMinimized) {
    return (
      <div style={{ display: 'none' }}>
        {/* Minimize durumunda sadece audio elementleri render et */}
        {room.currentUsers.map((userId: string) => {
          const participant = participants[userId];
          if (!participant || userId === userProfile?.uid) return null;
          
          const peerInfo = webrtcPeers.find(p => p.userId === userId);
          if (!peerInfo?.stream) return null;
          
          return (
            <audio
              key={`minimized-audio-${userId}`}
              data-user-id={userId}
              ref={(el) => {
                if (el && peerInfo.stream && el.srcObject !== peerInfo.stream) {
                  el.srcObject = peerInfo.stream;
                  el.muted = isDeafened;
                  el.play().catch(console.error);
                }
              }}
              autoPlay
              style={{ display: 'none' }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <Dialog
      open={open} // Minimize durumunda bu render edilmeyecek
      onClose={onClose}
      fullScreen
      maxWidth={false}
      PaperProps={{
        sx: {
          backgroundColor: '#1e1f23',
          margin: 0,
          borderRadius: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300
        }
      }}
    >
      <DialogContent sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        width: '100%',
        overflow: 'visible'
      }}>
        {/* Header */}
        <Box sx={{ 
          p: 2, 
          backgroundColor: '#2f3136',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #40444b'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" color="white" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {room.type === 'voice' ? '🔊' : room.type === 'video' ? '📹' : '📺'} {room.name}
            </Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.6)">
              {room.currentUsers.length} / {room.maxUsers}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={handleToggleVideo}
              disabled={!userPermissions.canVideo}
              sx={{ 
                color: !userPermissions.canVideo 
                  ? 'rgba(255,255,255,0.3)' 
                  : isVideoEnabled ? '#43b581' : 'rgba(255,255,255,0.6)',
                backgroundColor: !userPermissions.canVideo 
                  ? 'rgba(255,255,255,0.05)' 
                  : 'rgba(255,255,255,0.1)',
                '&:hover': { 
                  backgroundColor: !userPermissions.canVideo 
                    ? 'rgba(255,255,255,0.05)' 
                    : 'rgba(255,255,255,0.2)' 
                }
              }}
              size="small"
            >
              {isVideoEnabled ? <Videocam /> : <VideocamOff />}
            </IconButton>
            
            <IconButton
              onClick={handleToggleScreenShare}
              sx={{ 
                color: isScreenSharing ? '#43b581' : 'rgba(255,255,255,0.6)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
              }}
              size="small"
            >
              {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
            </IconButton>
            
            <IconButton
              onClick={handleToggleMute}
              disabled={!userPermissions.canSpeak}
              sx={{ 
                color: !userPermissions.canSpeak 
                  ? 'rgba(255,255,255,0.3)' 
                  : isMuted ? '#f04747' : 'rgba(255,255,255,0.6)',
                backgroundColor: !userPermissions.canSpeak 
                  ? 'rgba(255,255,255,0.05)' 
                  : isMuted ? 'rgba(240, 71, 71, 0.2)' : 'rgba(255,255,255,0.1)',
                '&:hover': { 
                  backgroundColor: !userPermissions.canSpeak 
                    ? 'rgba(255,255,255,0.05)' 
                    : isMuted ? 'rgba(240, 71, 71, 0.3)' : 'rgba(255,255,255,0.2)' 
                }
              }}
              size="small"
            >
              {isMuted ? <MicOff /> : <Mic />}
            </IconButton>
            
            <IconButton
              onClick={handleToggleDeafen}
              sx={{ 
                color: isDeafened ? '#f04747' : 'rgba(255,255,255,0.6)',
                backgroundColor: isDeafened ? 'rgba(240, 71, 71, 0.2)' : 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: isDeafened ? 'rgba(240, 71, 71, 0.3)' : 'rgba(255,255,255,0.2)' }
              }}
              size="small"
            >
              {isDeafened ? <VolumeOff /> : <Headphones />}
            </IconButton>
            
            <IconButton
              onClick={handleSettings}
              sx={{ 
                color: 'rgba(255,255,255,0.6)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
              }}
              size="small"
            >
              <Settings />
            </IconButton>
            
            {/* Davet Et Butonu */}
            {canInviteUsers && (
              <IconButton
                onClick={() => setInviteDialogOpen(true)}
                sx={{ 
                  color: 'rgba(255,255,255,0.6)',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                }}
                size="small"
                title="Sesli Kanala Davet Et"
              >
                <PersonAdd />
              </IconButton>
            )}
            
            <IconButton
              onClick={onMinimize}
              sx={{ 
                color: 'white',
                backgroundColor: '#5865f2',
                '&:hover': { backgroundColor: '#4752c4' }
              }}
              size="small"
              title="Küçült (Sesli sohbet devam eder)"
            >
              <Minimize />
            </IconButton>
            
            <IconButton
              onClick={handleLeaveRoom}
              sx={{ 
                color: 'white',
                backgroundColor: '#f04747',
                '&:hover': { backgroundColor: '#d73636' }
              }}
              size="small"
              title="Odadan Çık (Sesli sohbet kesilir)"
            >
              <Close />
            </IconButton>
          </Box>
        </Box>

        {/* Ana İçerik */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Sol Panel - Katılımcılar Grid */}
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: '#1e1f23',
            p: 3,
            overflow: 'auto'
          }}>
            {/* Katılımcılar Grid */}
            <Grid container spacing={3} sx={{ flexGrow: 1 }}>
              {room.currentUsers.map((userId: string) => {
                const participant = participants[userId];
                if (!participant) {
                  console.log(`❌ Participant ${userId} not found in participants`);
                  return null;
                }
                
                const isCurrentUser = userId === userProfile?.uid;
                const isSpeaking = speakingUsers.has(userId);
                const peerInfo = webrtcPeers.find(p => p.userId === userId);
                
                // hasVideo hesaplamasını düzelt
                let hasVideo = false;
                if (isCurrentUser) {
                  // Mevcut kullanıcı için local stream ve video/screen sharing durumunu kontrol et
                  hasVideo = !!(localStream && (isVideoEnabled || isScreenSharing));
                } else {
                  // Diğer kullanıcılar için peer stream'i kontrol et ve video track'i olup olmadığını kontrol et
                  if (peerInfo?.stream) {
                    const videoTracks = peerInfo.stream.getVideoTracks();
                    hasVideo = videoTracks.length > 0 && videoTracks.some(track => track.enabled);
                  }
                }
                
                console.log(`👤 Rendering participant ${userId}:`, {
                  isCurrentUser,
                  hasVideo,
                  peerInfo: !!peerInfo,
                  peerStream: !!peerInfo?.stream,
                  webrtcPeersCount: webrtcPeers.length,
                  localStream: !!localStream,
                  isVideoEnabled,
                  isScreenSharing,
                  videoTracks: peerInfo?.stream ? peerInfo.stream.getVideoTracks().length : 0
                });
                
                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={userId}>
                    <Card 
                      onClick={() => handleUserClick(userId)}
                      sx={{ 
                        backgroundColor: '#2f3136',
                        border: isSpeaking ? '3px solid #43b581' : '3px solid transparent',
                        borderRadius: 3,
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        height: 200, // Sabit yükseklik
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': { 
                          backgroundColor: '#36393f',
                          transform: 'translateY(-2px)'
                        }
                      }}>
                      {/* Tam kart boyutunda video/avatar */}
                      {hasVideo ? (
                        <Box sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#000'
                        }}>
                          <video
                            ref={isCurrentUser ? localVideoRef : (el) => {
                              if (el) {
                                videoRefs.current[userId] = el;
                                if (peerInfo?.stream && el.srcObject !== peerInfo.stream) {
                                  el.srcObject = peerInfo.stream;
                                }
                              }
                            }}
                            autoPlay
                            muted={isCurrentUser}
                            playsInline
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          {/* Separate audio element for remote audio */}
                          {!isCurrentUser && peerInfo?.stream && (
                            <audio
                              data-user-id={userId}
                              ref={(el) => {
                                if (el && peerInfo?.stream && el.srcObject !== peerInfo.stream) {
                                  el.srcObject = peerInfo.stream;
                                  el.play().catch(console.error);
                                }
                              }}
                              autoPlay
                              style={{ display: 'none' }}
                            />
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          background: participant.photoURL 
                            ? `url(${participant.photoURL})`
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {/* Eğer fotoğraf yoksa baş harfi göster */}
                          {!participant.photoURL && (
                            <Typography 
                              variant="h1" 
                              sx={{ 
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '4rem',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                              }}
                            >
                              {participant.displayName.charAt(0).toUpperCase()}
                            </Typography>
                          )}
                          {/* Audio element for remote audio when no video */}
                          {!isCurrentUser && peerInfo?.stream && (
                            <audio
                              data-user-id={userId}
                              ref={(el) => {
                                if (el && peerInfo?.stream && el.srcObject !== peerInfo.stream) {
                                  el.srcObject = peerInfo.stream;
                                  el.play().catch(console.error);
                                }
                              }}
                              autoPlay
                              style={{ display: 'none' }}
                            />
                          )}
                        </Box>
                      )}
                      
                      {/* Overlay - İsim ve durum bilgileri */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                      }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: 'white',
                            fontWeight: isCurrentUser ? 'bold' : 'normal',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                            mb: 0.5
                          }}
                        >
                          {participant.displayName}
                          {isCurrentUser && ' (Sen)'}
                        </Typography>
                        
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'rgba(255,255,255,0.9)',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                          }}
                        >
                          {isSpeaking ? 'Konuşuyor...' : 'Sessiz'}
                        </Typography>
                      </Box>

                      {/* Durum göstergeleri - sağ üst köşe */}
                      <Box sx={{ 
                        position: 'absolute', 
                        top: 8, 
                        right: 8,
                        display: 'flex',
                        gap: 0.5,
                        flexDirection: 'column'
                      }}>
                        {isMuted && userId === userProfile?.uid && (
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            backgroundColor: '#f04747',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            <MicOff sx={{ fontSize: 12, color: 'white' }} />
                          </Box>
                        )}
                        {isDeafened && userId === userProfile?.uid && (
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            backgroundColor: '#f04747',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            <VolumeOff sx={{ fontSize: 12, color: 'white' }} />
                          </Box>
                        )}
                        {isCurrentUser && (
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            backgroundColor: '#5865f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            <Typography sx={{ color: 'white', fontSize: '0.6rem', fontWeight: 'bold' }}>
                              SEN
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* Sağ Panel - Sohbet */}
          <Box sx={{ 
            width: 350, 
            backgroundColor: '#36393f',
            borderLeft: '1px solid #40444b',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Sohbet Başlığı */}
            <Box sx={{ 
              p: 2, 
              borderBottom: '1px solid #40444b',
              backgroundColor: '#2f3136'
            }}>
              <Typography variant="h6" color="white" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                💬 Sohbet
              </Typography>
            </Box>
            
            {/* Mesajlar */}
            <Box sx={{ 
              flexGrow: 1, 
              overflowY: 'auto',
              overflowX: 'hidden',
              p: 2,
              backgroundColor: '#2f3136',
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
                  <Typography variant="h6" color="white" gutterBottom>
                    {room.name} odasına hoş geldiniz!
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bu odada henüz mesaj yok. İlk mesajı göndermek için aşağıdaki kutucuğu kullanın.
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
                      <ListItem key={message.id} alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                        <Box sx={{ display: 'flex', width: '100%', gap: 2 }}>
                          <Avatar 
                            src={message.authorPhoto}
                            sx={{ width: 40, height: 40, flexShrink: 0 }}
                          >
                            {message.authorName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                              <Typography variant="subtitle2" color="white" fontWeight="bold">
                                {message.authorName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatTime(message.timestamp)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="white" sx={{ wordBreak: 'break-word' }}>
                              {message.content}
                            </Typography>
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
            <Box sx={{ p: 2, position: 'relative' }}>
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 80, right: 20, zIndex: 1000 }}>
                  <Picker
                    data={data}
                    onEmojiSelect={handleEmojiSelect}
                    theme="dark"
                    locale="tr"
                  />
                </Box>
              )}
              
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Mesaj gönder..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#40444b',
                    color: 'white',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: '#5865f2' },
                    '&.Mui-focused fieldset': { borderColor: '#5865f2' }
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton 
                        size="small" 
                        sx={{ color: 'rgba(255,255,255,0.6)' }} 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        <EmojiEmotions />
                      </IconButton>
                      <IconButton 
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        size="small" 
                        sx={{ 
                          color: (newMessage.trim() && !sendingMessage) ? '#5865f2' : 'rgba(255,255,255,0.6)',
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
        </Box>
      </DialogContent>

      {/* Tam Ekran Modal */}
      {fullscreenUserId && (
        <Dialog
          open={true}
          onClose={handleCloseFullscreen}
          maxWidth={false}
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: '#1e1f23',
              margin: 0,
              maxWidth: '100vw',
              maxHeight: '100vh',
              height: '100vh',
              borderRadius: 0
            }
          }}
        >
          <DialogContent sx={{ p: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Tam Ekran Header */}
            <Box sx={{ 
              p: 2, 
              backgroundColor: '#2f3136',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #40444b'
            }}>
              <Typography variant="h6" color="white">
                {participants[fullscreenUserId]?.displayName || 'Bilinmeyen Kullanıcı'}
                {fullscreenUserId === userProfile?.uid && ' (Sen)'}
              </Typography>
              <IconButton onClick={handleCloseFullscreen} sx={{ color: 'white' }}>
                <Close />
              </IconButton>
            </Box>

            {/* Tam Ekran Video */}
            <Box 
              sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#000',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()} // Boş alana tıklandığında kapanmasını engelle
            >
                                           {(() => {
                const isCurrentUser = fullscreenUserId === userProfile?.uid;
                const peerInfo = webrtcPeers.find(p => p.userId === fullscreenUserId);
                
                // hasVideo hesaplamasını düzelt - küçük kartlardaki mantığı kullan
                let hasVideo = false;
                if (isCurrentUser) {
                  hasVideo = !!(localStream && (isVideoEnabled || isScreenSharing));
                } else {
                  if (peerInfo?.stream) {
                    const videoTracks = peerInfo.stream.getVideoTracks();
                    hasVideo = videoTracks.length > 0 && videoTracks.some(track => track.enabled);
                  }
                }
                
                // Kendi kameranı tam ekrana aldığında kamera açık değilse avatar göster
                const shouldShowAvatar = !hasVideo;
                
                console.log(`🎬 Fullscreen render for ${fullscreenUserId}:`, {
                  isCurrentUser,
                  hasVideo,
                  shouldShowAvatar,
                  peerInfo: !!peerInfo,
                  peerStream: !!peerInfo?.stream,
                  localStream: !!localStream,
                  isVideoEnabled,
                  isScreenSharing,
                  videoTracks: peerInfo?.stream ? peerInfo.stream.getVideoTracks().length : 0,
                  localVideoTracks: localStream ? localStream.getVideoTracks().length : 0,
                  peerVideoTracksEnabled: peerInfo?.stream ? peerInfo.stream.getVideoTracks().map(t => t.enabled) : [],
                  localVideoTracksEnabled: localStream ? localStream.getVideoTracks().map(t => t.enabled) : [],
                  localStreamId: localStream ? localStream.id : null,
                  peerStreamId: peerInfo?.stream ? peerInfo.stream.id : null
                });
                
                if (hasVideo) {
                  return (
                    <>
                      <video
                        ref={(el) => {
                          if (el) {
                            if (isCurrentUser) {
                              // Kendi kameranı tam ekran yaptığında stream'i manuel olarak ata
                              videoRefs.current[fullscreenUserId] = el;
                              if (localStream && el.srcObject !== localStream) {
                                console.log(`🎬 Setting fullscreen LOCAL video stream for ${fullscreenUserId}`);
                                el.srcObject = localStream;
                                el.play().catch(console.error);
                              }
                            } else {
                              // Peer stream'i manuel olarak ata - sadece değiştiğinde
                              videoRefs.current[fullscreenUserId] = el;
                              if (peerInfo?.stream && el.srcObject !== peerInfo.stream) {
                                console.log(`🎬 Setting fullscreen video stream for ${fullscreenUserId}`);
                                el.srcObject = peerInfo.stream;
                                el.play().catch(console.error);
                              }
                            }
                          }
                        }}
                        autoPlay
                        muted={isCurrentUser}
                        playsInline
                        onLoadedMetadata={() => console.log(`🎬 Fullscreen video loaded for ${fullscreenUserId}`)}
                        onError={(e) => console.error(`🎬 Fullscreen video error for ${fullscreenUserId}:`, e)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                      {/* Audio element for fullscreen video */}
                      {!isCurrentUser && peerInfo?.stream && (
                        <audio
                          data-user-id={fullscreenUserId}
                          ref={(el) => {
                            if (el && peerInfo?.stream && el.srcObject !== peerInfo.stream) {
                              el.srcObject = peerInfo.stream;
                              el.play().catch(console.error);
                            }
                          }}
                          autoPlay
                          style={{ display: 'none' }}
                        />
                      )}
                    </>
                  );
                } else {
                  return (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      gap: 3
                    }}>
                      <Avatar 
                        src={participants[fullscreenUserId]?.photoURL}
                        sx={{ 
                          width: 200, 
                          height: 200,
                          fontSize: '4rem',
                          border: '4px solid #5865f2'
                        }}
                      >
                        {participants[fullscreenUserId]?.displayName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <Typography variant="h4" color="white">
                        {participants[fullscreenUserId]?.displayName || 'Bilinmeyen Kullanıcı'}
                      </Typography>
                      <Typography variant="body1" color="rgba(255,255,255,0.6)">
                        {speakingUsers.has(fullscreenUserId) ? 'Konuşuyor...' : 'Sessiz'}
                      </Typography>
                      
                      {/* Audio element for fullscreen modal */}
                      {!isCurrentUser && peerInfo?.stream && (
                        <audio
                          data-user-id={fullscreenUserId}
                          ref={(el) => {
                            if (el && peerInfo?.stream && el.srcObject !== peerInfo.stream) {
                              el.srcObject = peerInfo.stream;
                              el.play().catch(console.error);
                            }
                          }}
                          autoPlay
                          style={{ display: 'none' }}
                        />
                      )}
                    </Box>
                  );
                }
              })()}

              {/* Tam Ekran Kontroller */}
              <Box sx={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 2,
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 3,
                p: 2
              }}>
                <IconButton
                  onClick={handleToggleVideo}
                  sx={{ 
                    color: isVideoEnabled ? '#43b581' : 'rgba(255,255,255,0.6)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                  }}
                >
                  {isVideoEnabled ? <Videocam /> : <VideocamOff />}
                </IconButton>
                
                <IconButton
                  onClick={handleToggleScreenShare}
                  sx={{ 
                    color: isScreenSharing ? '#43b581' : 'rgba(255,255,255,0.6)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                  }}
                >
                  {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
                </IconButton>
                
                <IconButton
                  onClick={handleToggleMute}
                  sx={{ 
                    color: isMuted ? '#f04747' : 'rgba(255,255,255,0.6)',
                    backgroundColor: isMuted ? 'rgba(240, 71, 71, 0.2)' : 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: isMuted ? 'rgba(240, 71, 71, 0.3)' : 'rgba(255,255,255,0.2)' }
                  }}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </IconButton>
                
                <IconButton
                  onClick={handleToggleDeafen}
                  sx={{ 
                    color: isDeafened ? '#f04747' : 'rgba(255,255,255,0.6)',
                    backgroundColor: isDeafened ? 'rgba(240, 71, 71, 0.2)' : 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: isDeafened ? 'rgba(240, 71, 71, 0.3)' : 'rgba(255,255,255,0.2)' }
                  }}
                >
                  {isDeafened ? <VolumeOff /> : <Headphones />}
                </IconButton>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Sesli Kanal Davet Dialog */}
      <VoiceChannelInviteDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        room={room}
        serverId={server?.id || ''}
        serverName={server?.name || ''}
        serverMembers={serverMembers}
        currentParticipants={room.currentUsers || []}
      />
    </Dialog>
  );
}; 