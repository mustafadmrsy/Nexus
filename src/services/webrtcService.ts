import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';

export interface WebRTCSignal {
  id?: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  timestamp: Date;
}

export interface MediaSettings {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

export interface PeerInfo {
  userId: string;
  displayName: string;
  photoURL: string;
  mediaSettings: MediaSettings;
  isSpeaking: boolean;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  pendingIceCandidates: RTCIceCandidate[];
}

export class WebRTCService {
  private roomId: string = '';
  private userId: string = '';
  private displayName: string = '';
  private photoURL: string = '';
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, PeerInfo> = new Map();
  private signalingUnsubscribe: (() => void) | null = null;
  private participantUnsubscribe: (() => void) | null = null;
  private mediaSettings: MediaSettings = { audio: true, video: false, screen: false };
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingThreshold = 50;
  private isSpeaking = false;
  private voiceActivityRunning = false;
  
  // Event callbacks
  private onPeerJoined: ((peer: PeerInfo) => void) | null = null;
  private onPeerLeft: ((userId: string) => void) | null = null;
  private onPeerStreamChanged: ((userId: string, stream: MediaStream | null) => void) | null = null;
  private onPeerSpeakingChanged: ((userId: string, isSpeaking: boolean) => void) | null = null;
  private onLocalStreamChanged: ((stream: MediaStream | null) => void) | null = null;

  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];

  constructor() {
    this.setupAudioContext();
  }

  // Event listeners
  public onPeerJoinedListener(callback: (peer: PeerInfo) => void) {
    this.onPeerJoined = callback;
  }

  public onPeerLeftListener(callback: (userId: string) => void) {
    this.onPeerLeft = callback;
  }

  public onPeerStreamChangedListener(callback: (userId: string, stream: MediaStream | null) => void) {
    this.onPeerStreamChanged = callback;
  }

  public onPeerSpeakingChangedListener(callback: (userId: string, isSpeaking: boolean) => void) {
    this.onPeerSpeakingChanged = callback;
  }

  public onLocalStreamChangedListener(callback: (stream: MediaStream | null) => void) {
    this.onLocalStreamChanged = callback;
  }

  // Initialize WebRTC for a room
  public async joinRoom(
    roomId: string, 
    userId: string, 
    displayName: string, 
    photoURL: string,
    initialMediaSettings: MediaSettings = { audio: true, video: false, screen: false }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Eğer zaten bir odadaysak, mevcut ses durumunu koru
      const wasInRoom = this.roomId !== '';
      const previousAudioState = this.mediaSettings.audio;
      
      this.roomId = roomId;
      this.userId = userId;
      this.displayName = displayName;
      this.photoURL = photoURL;
      
      // Odalar arası geçişte ses durumunu koru
      if (wasInRoom) {
        this.mediaSettings = {
          ...initialMediaSettings,
          audio: previousAudioState // Önceki ses durumunu koru
        };
        console.log('🎤 Preserving audio state across rooms:', previousAudioState);
      } else {
        this.mediaSettings = initialMediaSettings;
        console.log('🎤 Using initial media settings:', initialMediaSettings);
      }

      // Mikrofon izni kontrolü
      if (this.mediaSettings.audio) {
        console.log('🎤 Checking microphone permission...');
        try {
          // Permissions API ile izin durumunu kontrol et
          if (navigator.permissions) {
            const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            console.log('🎤 Microphone permission status:', permission.state);
            
            if (permission.state === 'denied') {
              console.warn('⚠️ Mikrofon izni reddedilmiş, ses olmadan devam ediliyor');
              this.mediaSettings.audio = false;
            } else if (permission.state === 'prompt') {
              console.log('🎤 Mikrofon izni istenecek...');
            }
          }
        } catch (permError) {
          console.log('🎤 Permission API kullanılamıyor, getUserMedia ile deneyeceğiz');
        }
      }

      // Get local media stream
      await this.updateLocalMedia();

      // Start listening for signaling messages
      this.startSignalingListener();

      // Send join signal to existing peers
      await this.sendJoinSignal();

      return { success: true };
    } catch (error) {
      console.error('Error joining WebRTC room:', error);
      return { success: false, error: 'Odaya katılırken hata oluştu' };
    }
  }

  // Leave room and cleanup
  public async leaveRoom(): Promise<void> {
    // Close all peer connections
    this.peers.forEach(peer => {
      peer.connection.close();
    });
    this.peers.clear();

    // Stop local streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Stop signaling listener
    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
      this.signalingUnsubscribe = null;
    }

    // Stop participant listener
    if (this.participantUnsubscribe) {
      this.participantUnsubscribe();
      this.participantUnsubscribe = null;
    }

    // Send leave signal
    await this.sendLeaveSignal();

    // Reset state
    this.roomId = '';
    this.userId = '';
    this.displayName = '';
    this.photoURL = '';
  }

  // Media controls
  public async toggleAudio(): Promise<boolean> {
    const newEnabled = !this.mediaSettings.audio;
    
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      
      // Eğer ses açılmaya çalışılıyor ama stream'de ses track'i yoksa, yeniden oluştur
      if (newEnabled && audioTracks.length === 0) {
        console.log('🎤 No audio tracks in stream, recreating...');
        this.mediaSettings.audio = newEnabled;
        await this.updateLocalMedia();
        await this.broadcastMediaSettings();
        return this.mediaSettings.audio;
      }
      
      // Mevcut track'leri enable/disable et
      audioTracks.forEach(track => {
        track.enabled = newEnabled;
      });
      
      this.mediaSettings.audio = newEnabled;
      console.log('🎤 Toggle audio:', this.mediaSettings.audio);
      
      // Voice activity detection'ı durdurup yeniden başlat
      if (newEnabled && !this.voiceActivityRunning) {
        this.setupVoiceActivityDetection(this.localStream);
      } else if (!newEnabled) {
        this.voiceActivityRunning = false;
        this.isSpeaking = false;
        // Speaking durumunu güncelle
        if (this.onPeerSpeakingChanged) {
          this.onPeerSpeakingChanged(this.userId, false);
        }
      }
      
      await this.broadcastMediaSettings();
      return this.mediaSettings.audio;
    } else {
      // Stream yoksa yeniden oluştur
      this.mediaSettings.audio = newEnabled;
      console.log('🎤 Toggle audio (no stream):', this.mediaSettings.audio);
      await this.updateLocalMedia();
      await this.broadcastMediaSettings();
      return this.mediaSettings.audio;
    }
  }

  public async toggleVideo(): Promise<boolean> {
    this.mediaSettings.video = !this.mediaSettings.video;
    console.log('Toggle video:', this.mediaSettings.video);
    await this.updateLocalMedia();
    await this.broadcastMediaSettings();
    return this.mediaSettings.video;
  }

  // Toggle screen sharing
  public async toggleScreenShare(): Promise<boolean> {
    console.log('Toggle screen share called, current state:', this.mediaSettings.screen);
    
    if (this.mediaSettings.screen) {
      // Stop screen sharing
      this.mediaSettings.screen = false;
      this.mediaSettings.video = false;
    } else {
      // Start screen sharing - basit kontrol
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Ekran paylaşımı bu tarayıcıda desteklenmiyor. Lütfen güncel bir tarayıcı kullanın.');
      }

      // HTTPS kontrolü
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw new Error('Ekran paylaşımı için HTTPS bağlantısı gereklidir.');
      }

      // Detaylı environment bilgisi
      console.log('Screen share environment:', {
        protocol: location.protocol,
        hostname: location.hostname,
        userAgent: navigator.userAgent,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
        isElectron: window.electronAPI || navigator.userAgent.includes('Electron')
      });

      // Kullanıcıdan izin istemeye çalış
      try {
        console.log('Requesting screen share permission...');
        
        // Electron ortamı kontrolü
        const isElectron = window.electronAPI || navigator.userAgent.includes('Electron');
        
        if (isElectron) {
          console.log('Electron ortamında screen share deneniyor...');
          
          // Electron için özel yaklaşım
          try {
            // Electron'da getUserMedia ile screen capture
            const testStream = await navigator.mediaDevices.getUserMedia({
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: 'screen:0:0'
                }
              } as any,
              audio: false
            });
            
            // Test stream'i hemen durdur
            testStream.getTracks().forEach(track => track.stop());
            console.log('Electron screen share permission granted');
            
            this.mediaSettings.screen = true;
            this.mediaSettings.video = false;
          } catch (electronError) {
            console.log('Electron screen share failed, trying getDisplayMedia...', electronError);
            
            // Electron'da getDisplayMedia deneme
            const testStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false
            });
            
            testStream.getTracks().forEach(track => track.stop());
            console.log('Electron getDisplayMedia succeeded');
            
            this.mediaSettings.screen = true;
            this.mediaSettings.video = false;
          }
        } else {
          // Normal tarayıcıda getDisplayMedia
          const testStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });
          
          // Test stream'i hemen durdur
          testStream.getTracks().forEach(track => track.stop());
          
          console.log('Screen share permission granted successfully');
          
          this.mediaSettings.screen = true;
          this.mediaSettings.video = false;
        }
      } catch (error) {
        console.error('Screen share permission denied:', error);
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            throw new Error('Ekran paylaşımı izni reddedildi. Lütfen "Paylaş" butonuna tıklayın ve bir ekran seçin.');
          } else if (error.name === 'NotFoundError') {
            throw new Error('Paylaşılacak ekran bulunamadı. Lütfen bir ekran seçin.');
          } else if (error.name === 'NotSupportedError') {
            throw new Error('Ekran paylaşımı bu tarayıcıda desteklenmiyor. Lütfen Chrome, Firefox veya Edge kullanın.');
          } else if (error.name === 'AbortError') {
            throw new Error('Ekran paylaşımı iptal edildi.');
          } else {
            throw new Error(`Ekran paylaşımı başlatılamadı: ${error.message}`);
          }
        }
        
        throw new Error('Ekran paylaşımı başlatılamadı. Lütfen tekrar deneyin.');
      }
    }
    
    console.log('Toggle screen share:', this.mediaSettings.screen);
    await this.updateLocalMedia();
    await this.broadcastMediaSettings();
    return this.mediaSettings.screen;
  }

  // Get current media settings
  public getMediaSettings(): MediaSettings {
    return { ...this.mediaSettings };
  }

  // Get local stream
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get peer stream
  public getPeerStream(userId: string): MediaStream | null {
    return this.peers.get(userId)?.stream || null;
  }

  // Get all peers
  public getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  // Check if user is speaking
  public isUserSpeaking(userId: string): boolean {
    if (userId === this.userId) return this.isSpeaking;
    return this.peers.get(userId)?.isSpeaking || false;
  }

  // Check browser support for screen sharing
  public checkScreenShareSupport(): { supported: boolean; reason?: string } {
    if (!navigator.mediaDevices) {
      return { supported: false, reason: 'MediaDevices API desteklenmiyor' };
    }

    if (!navigator.mediaDevices.getDisplayMedia) {
      return { supported: false, reason: 'getDisplayMedia API desteklenmiyor' };
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      return { supported: false, reason: 'HTTPS bağlantısı gerekli' };
    }

    // Electron ortamında çalışıyor muyuz?
    const isElectron = window.electronAPI || navigator.userAgent.includes('Electron');
    if (isElectron) {
      console.log('Electron ortamı algılandı');
      // Electron'da screen sharing farklı şekilde çalışabilir
      return { supported: true, reason: 'Electron ortamında çalışıyor' };
    }

    // Tarayıcı sürüm kontrolü
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    const isEdge = userAgent.includes('Edg');
    const isSafari = userAgent.includes('Safari') && !isChrome;

    if (isChrome) {
      const chromeVersion = parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] || '0');
      if (chromeVersion < 72) {
        return { supported: false, reason: 'Chrome 72+ gerekli' };
      }
    } else if (isFirefox) {
      const firefoxVersion = parseInt(userAgent.match(/Firefox\/(\d+)/)?.[1] || '0');
      if (firefoxVersion < 66) {
        return { supported: false, reason: 'Firefox 66+ gerekli' };
      }
    } else if (isEdge) {
      const edgeVersion = parseInt(userAgent.match(/Edg\/(\d+)/)?.[1] || '0');
      if (edgeVersion < 79) {
        return { supported: false, reason: 'Edge 79+ gerekli' };
      }
    } else if (isSafari) {
      return { supported: false, reason: 'Safari ekran paylaşımını desteklemiyor' };
    }

    // Fonksiyon çağrılabilir mi test et
    try {
      const isCallable = typeof navigator.mediaDevices.getDisplayMedia === 'function';
      if (!isCallable) {
        return { supported: false, reason: 'getDisplayMedia fonksiyon değil' };
      }
    } catch (error) {
      return { supported: false, reason: 'getDisplayMedia test hatası' };
    }

    return { supported: true };
  }

  // Test screen sharing without actually starting it
  public async testScreenShare(): Promise<{ success: boolean; error?: string }> {
    try {
      // Sadece izin kontrolü yap, gerçek stream başlatma
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1, height: 1 }, // Minimal boyut
        audio: false
      });
      
      // Hemen kapat
      stream.getTracks().forEach(track => track.stop());
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
      };
    }
  }

  // Get debugging information
  public getDebugInfo(): any {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    const isEdge = userAgent.includes('Edg');
    const isSafari = userAgent.includes('Safari') && !isChrome;
    
    let browserVersion = 'Unknown';
    if (isChrome) {
      browserVersion = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (isFirefox) {
      browserVersion = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
    } else if (isEdge) {
      browserVersion = userAgent.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
    } else if (isSafari) {
      browserVersion = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
    }

    return {
      // Temel bilgiler
      location: {
        protocol: location.protocol,
        hostname: location.hostname,
        port: location.port,
        href: location.href
      },
      
      // Tarayıcı bilgileri
      browser: {
        userAgent: userAgent,
        isChrome,
        isFirefox,
        isEdge,
        isSafari,
        version: browserVersion,
        isElectron: window.electronAPI || userAgent.includes('Electron')
      },
      
      // API desteği
      apiSupport: {
        hasNavigator: !!navigator,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        hasGetDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
        hasPermissions: !!navigator.permissions,
        hasWebRTC: !!(window.RTCPeerConnection || (window as any).webkitRTCPeerConnection)
      },
      
      // Güvenlik bilgileri
      security: {
        isSecureContext: window.isSecureContext,
        isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
        isHTTPS: location.protocol === 'https:'
      },
      
      // WebRTC durumu
      webrtc: {
        isInitialized: !!this.roomId,
        roomId: this.roomId,
        userId: this.userId,
        peersCount: this.peers.size,
        hasLocalStream: !!this.localStream,
        mediaSettings: this.mediaSettings
      }
    };
  }

  // Test all screen sharing capabilities
  public async runScreenShareDiagnostics(): Promise<any> {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      basicInfo: this.getDebugInfo(),
      tests: {}
    };

    // Test 1: Support check
    diagnostics.tests.supportCheck = this.checkScreenShareSupport();

    // Test 2: Permission check
    try {
      diagnostics.tests.permissionCheck = await this.checkScreenSharePermission();
    } catch (error) {
      diagnostics.tests.permissionCheck = { 
        granted: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Test 3: Actual getDisplayMedia test
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1, height: 1 },
        audio: false
      });
      stream.getTracks().forEach(track => track.stop());
      diagnostics.tests.getDisplayMediaTest = { success: true };
    } catch (error) {
      diagnostics.tests.getDisplayMediaTest = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack'
      };
    }

    return diagnostics;
  }

  // Private methods
  private async setupAudioContext() {
    try {
      // Audio context'i hemen başlatma, user interaction sonrası başlat
      console.log('Audio context setup deferred until user interaction');
    } catch (error) {
      console.error('Error setting up audio context:', error);
    }
  }

  private async ensureAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        
        // Audio context'i resume et (tarayıcı güvenlik politikası için)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        console.log('Audio context initialized successfully');
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }
    }
  }

  private async updateLocalMedia() {
    try {
      console.log('🔄 Updating local media with settings:', this.mediaSettings);
      console.log('🔄 Current localStream:', this.localStream);
      console.log('🔄 Current peers count:', this.peers.size);
      
      // Stop voice activity detection before updating stream
      this.voiceActivityRunning = false;
      
      // Stop existing streams
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }

      let stream: MediaStream | null = null;

      if (this.mediaSettings.screen) {
        // Screen sharing - Electron ve normal tarayıcı desteği
        try {
          console.log('Starting screen share...');
          
          // Electron ortamı kontrolü
          const isElectron = window.electronAPI || navigator.userAgent.includes('Electron');
          
          if (isElectron) {
            console.log('Starting Electron screen share...');
            
            // Electron için farklı screen source'ları dene
            const electronMethods = [
              // Method 1: Default screen
              {
                name: 'Default screen',
                config: {
                  video: {
                    mandatory: {
                      chromeMediaSource: 'desktop',
                      chromeMediaSourceId: 'screen:0:0'
                    }
                  } as any,
                  audio: false
                }
              },
              // Method 2: Screen without ID
              {
                name: 'Screen without ID',
                config: {
                  video: {
                    mandatory: {
                      chromeMediaSource: 'desktop'
                    }
                  } as any,
                  audio: false
                }
              },
              // Method 3: Screen source
              {
                name: 'Screen source',
                config: {
                  video: {
                    mandatory: {
                      chromeMediaSource: 'screen'
                    }
                  } as any,
                  audio: false
                }
              },
              // Method 4: Window source
              {
                name: 'Window source',
                config: {
                  video: {
                    mandatory: {
                      chromeMediaSource: 'window'
                    }
                  } as any,
                  audio: false
                }
              },
              // Method 5: getDisplayMedia fallback
              {
                name: 'getDisplayMedia fallback',
                config: null
              }
            ];
            
            let electronSuccess = false;
            
            for (const method of electronMethods) {
              try {
                console.log(`Trying Electron method: ${method.name}`);
                
                if (method.config) {
                  stream = await navigator.mediaDevices.getUserMedia(method.config);
                } else {
                  // getDisplayMedia fallback
                  stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                  });
                }
                
                console.log(`Electron ${method.name} successful:`, stream);
                electronSuccess = true;
                break;
              } catch (methodError) {
                console.log(`Electron ${method.name} failed:`, methodError);
                continue;
              }
            }
            
            if (!electronSuccess || !stream) {
              throw new Error('Tüm Electron screen share metodları başarısız oldu');
            }
          } else {
            // Normal tarayıcıda getDisplayMedia
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false
            });
            console.log('Normal browser screen share successful:', stream);
          }
          
          console.log('Screen share successful:', stream);

          // Listen for screen share end
          stream.getVideoTracks().forEach(track => {
            track.onended = () => {
              console.log('Screen share ended by user');
              this.mediaSettings.screen = false;
              this.updateLocalMedia();
            };
          });

          // Add audio from microphone if needed
          if (this.mediaSettings.audio) {
            try {
              const audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
                }
              });
              audioStream.getAudioTracks().forEach(track => {
                stream?.addTrack(track);
              });
            } catch (error) {
              console.warn('Could not get microphone for screen sharing:', error);
            }
          }

          this.screenStream = stream;
        } catch (error) {
          console.error('Screen sharing error:', error);
          this.mediaSettings.screen = false;
          
          // Daha anlaşılır hata mesajları
          if (error instanceof Error) {
            console.log('Screen sharing error details:', {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
            
            if (error.name === 'NotAllowedError') {
              throw new Error('Ekran paylaşımı izni reddedildi. Lütfen "Paylaş" butonuna tıklayın ve bir ekran seçin.');
            } else if (error.name === 'NotFoundError') {
              throw new Error('Paylaşılacak ekran bulunamadı. Lütfen bir ekran seçin.');
            } else if (error.name === 'NotSupportedError') {
              throw new Error('Ekran paylaşımı bu tarayıcıda desteklenmiyor. Lütfen Chrome, Firefox veya Edge kullanın.');
            } else if (error.name === 'AbortError') {
              throw new Error('Ekran paylaşımı iptal edildi.');
            } else if (error.name === 'NotReadableError') {
              throw new Error('Ekran paylaşımı başlatılamadı. Başka bir uygulama ekranı kullanıyor olabilir.');
            }
          }
          throw error;
        }
      } else {
        // Regular camera/microphone
        if (this.mediaSettings.audio || this.mediaSettings.video) {
          try {
            const constraints: MediaStreamConstraints = {};
            
            if (this.mediaSettings.audio) {
              constraints.audio = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              };
              console.log('🎤 Requesting audio stream...');
            }
            
            if (this.mediaSettings.video) {
              constraints.video = {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                facingMode: 'user'
              };
              console.log('📹 Requesting video stream...');
            }
            
            console.log('🎵 getUserMedia constraints:', constraints);
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('🎵 getUserMedia success:', stream);
          } catch (error) {
            console.error('Camera/microphone error:', error);
            
            // Daha anlaşılır hata mesajları
            if (error instanceof Error) {
              if (error.name === 'NotAllowedError') {
                // Mikrofon izni reddedildi - kullanıcıya bilgi ver
                console.error('🚫 Mikrofon/kamera izni reddedildi');
                
                // Eğer sadece audio istiyorsak ve reddedildiyse, kullanıcıya açıkla
                if (this.mediaSettings.audio && !this.mediaSettings.video) {
                  console.warn('⚠️ Mikrofon izni reddedildi, sesli sohbet devre dışı');
                  // İzin reddedildiğinde hata fırlatmak yerine, ses olmadan devam et
                  this.mediaSettings.audio = false;
                  stream = null; // Ses olmadan devam et
                } else {
                  throw new Error('Mikrofon/kamera izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.');
                }
              } else if (error.name === 'NotFoundError') {
                console.warn('⚠️ Mikrofon/kamera bulunamadı, ses olmadan devam ediliyor');
                this.mediaSettings.audio = false;
                this.mediaSettings.video = false;
                stream = null;
              } else if (error.name === 'NotSupportedError') {
                console.warn('⚠️ Tarayıcı mikrofon/kamera erişimini desteklemiyor');
                this.mediaSettings.audio = false;
                this.mediaSettings.video = false;
                stream = null;
              } else {
                // Diğer hatalar için fallback dene
                console.warn('⚠️ Mikrofon/kamera hatası, fallback deneniyor:', error);
                
                // Fallback: sadece ses deneyin
                if (this.mediaSettings.video && this.mediaSettings.audio) {
                  console.log('Video failed, trying audio only...');
                  this.mediaSettings.video = false;
                  try {
                    stream = await navigator.mediaDevices.getUserMedia({
                      audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                      }
                    });
                  } catch (audioError) {
                    console.warn('⚠️ Audio fallback da başarısız, ses olmadan devam ediliyor');
                    this.mediaSettings.audio = false;
                    stream = null;
                  }
                } else {
                  // Ses ve video her ikisi de başarısız, ses olmadan devam et
                  console.warn('⚠️ Tüm medya erişimi başarısız, ses olmadan devam ediliyor');
                  this.mediaSettings.video = false;
                  this.mediaSettings.audio = false;
                  stream = null;
                }
              }
            } else {
              // Bilinmeyen hata
              console.warn('⚠️ Bilinmeyen medya hatası, ses olmadan devam ediliyor:', error);
              this.mediaSettings.audio = false;
              this.mediaSettings.video = false;
              stream = null;
            }
          }
        }
      }

      // Eğer hiç stream oluşturulamadıysa, boş bir MediaStream oluştur
      // Bu sayede peer connection'lar kurulabilir ve sonra track'ler eklenebilir
      if (!stream && (this.mediaSettings.audio || this.mediaSettings.video)) {
        console.log('🔄 Creating empty MediaStream for peer connections...');
        try {
          // Boş bir MediaStream oluştur
          stream = new MediaStream();
          console.log('✅ Empty MediaStream created');
        } catch (error) {
          console.error('❌ Could not create empty MediaStream:', error);
        }
      }

      this.localStream = stream;

      // Audio track'lerini media settings'e göre ayarla
      if (stream) {
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = this.mediaSettings.audio;
        });
        
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = this.mediaSettings.video || this.mediaSettings.screen;
        });
        
        console.log('🎵 Stream tracks configured:', {
          audio: audioTracks.length,
          video: videoTracks.length,
          audioEnabled: this.mediaSettings.audio,
          videoEnabled: this.mediaSettings.video || this.mediaSettings.screen
        });
      } else {
        console.log('⚠️ No stream created - media settings:', this.mediaSettings);
      }

      // Setup voice activity detection
      if (stream && this.mediaSettings.audio) {
        this.setupVoiceActivityDetection(stream);
      }

      console.log('🔄 Updating peer connections with new stream...');
      // Update all peer connections with new stream
      this.peers.forEach(peer => {
        console.log(`🔄 Updating peer ${peer.userId} with stream:`, !!stream);
        this.updatePeerConnection(peer, stream);
      });

      // Notify listeners
      if (this.onLocalStreamChanged) {
        this.onLocalStreamChanged(stream);
      }
      
      console.log('✅ updateLocalMedia completed. Final localStream:', !!this.localStream);

    } catch (error) {
      console.error('Error updating local media:', error);
      throw error;
    }
  }

  private setupVoiceActivityDetection(stream: MediaStream) {
    // Eğer zaten voice activity detection çalışıyorsa, yeniden başlatma
    if (this.voiceActivityRunning) {
      console.log('Voice activity detection already running, skipping setup');
      return;
    }

    this.ensureAudioContext().then(() => {
      if (!this.analyser || !this.audioContext) {
        console.error('Audio context or analyser not available');
        return;
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error('No audio tracks found in stream');
        return;
      }

      try {
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.voiceActivityRunning = true;
        
        const checkSpeaking = () => {
          if (!this.voiceActivityRunning || !this.analyser) return;
          
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          
          const wasSpeaking = this.isSpeaking;
          this.isSpeaking = average > this.speakingThreshold;
          
          // Debug log - sadece değişiklik olduğunda
          if (this.isSpeaking !== wasSpeaking) {
            console.log(`🗣️ Speaking changed: ${this.isSpeaking} (level: ${average})`);
          }
          
          if (wasSpeaking !== this.isSpeaking && this.onPeerSpeakingChanged) {
            this.onPeerSpeakingChanged(this.userId, this.isSpeaking);
          }
          
          requestAnimationFrame(checkSpeaking);
        };
        
        checkSpeaking();
        console.log('Voice activity detection started');
        
        // Cleanup function
        stream.getAudioTracks()[0].onended = () => {
          this.voiceActivityRunning = false;
          console.log('Voice activity detection stopped');
        };
      } catch (error) {
        console.error('Error setting up voice activity detection:', error);
      }
    }).catch(error => {
      console.error('Error ensuring audio context:', error);
    });
  }

  private async updatePeerConnection(peer: PeerInfo, stream: MediaStream | null) {
    console.log(`Updating peer connection for ${peer.userId} with stream:`, stream);
    
    // Remove old tracks
    const senders = peer.connection.getSenders();
    console.log(`Removing ${senders.length} existing tracks for ${peer.userId}`);
    
    for (const sender of senders) {
      try {
        peer.connection.removeTrack(sender);
      } catch (error) {
        console.error(`Error removing track for ${peer.userId}:`, error);
      }
    }

    // Add new tracks
    if (stream) {
      console.log(`Adding ${stream.getTracks().length} new tracks for ${peer.userId}`);
      stream.getTracks().forEach(track => {
        try {
          peer.connection.addTrack(track, stream);
          console.log(`Added ${track.kind} track to ${peer.userId}`);
        } catch (error) {
          console.error(`Error adding ${track.kind} track to ${peer.userId}:`, error);
        }
      });
    } else {
      console.log(`No stream to add for ${peer.userId}`);
    }

    // Renegotiate the connection to reflect the changes
    try {
      console.log(`Starting renegotiation for ${peer.userId}`);
      
      // Check if we're the initiator (we have a local offer)
      if (peer.connection.signalingState === 'stable') {
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        console.log(`Created and set local offer for renegotiation with ${peer.userId}`);
        
        await this.sendSignal(peer.userId, 'offer', offer);
        console.log(`Sent renegotiation offer to ${peer.userId}`);
      } else {
        console.log(`Peer ${peer.userId} not in stable state for renegotiation: ${peer.connection.signalingState}`);
      }
    } catch (error) {
      console.error(`Error during renegotiation for ${peer.userId}:`, error);
    }
  }

  private async recreatePeerConnection(userId: string): Promise<void> {
    console.log(`Recreating peer connection for user: ${userId}`);
    
    // Get existing peer info
    const existingPeer = this.peers.get(userId);
    if (!existingPeer) {
      console.error(`Cannot recreate peer connection for ${userId}: peer not found`);
      return;
    }
    
    // Close existing connection
    existingPeer.connection.close();
    
    // Remove from peers map
    this.peers.delete(userId);
    
    // Get participant info and recreate
    const participantInfo = await this.getParticipantInfo(userId);
    await this.createPeerConnection(
      userId,
      participantInfo.displayName || existingPeer.displayName,
      participantInfo.photoURL || existingPeer.photoURL
    );
    
    console.log(`Successfully recreated peer connection for ${userId}`);
  }

  private async createPeerConnection(userId: string, displayName: string, photoURL: string): Promise<PeerInfo> {
    console.log(`Creating peer connection for user: ${userId}`);
    
    const connection = new RTCPeerConnection({ iceServers: this.iceServers });
    
    const peer: PeerInfo = {
      userId,
      displayName,
      photoURL,
      mediaSettings: { audio: false, video: false, screen: false },
      isSpeaking: false,
      connection,
      pendingIceCandidates: []
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${userId}`);
        // Serialize ICE candidate for Firebase
        const candidateData = {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          usernameFragment: event.candidate.usernameFragment
        };
        this.sendSignal(userId, 'ice-candidate', candidateData);
      } else {
        console.log(`ICE gathering complete for ${userId}`);
      }
    };

    // Handle remote stream
    connection.ontrack = (event) => {
      console.log(`🎥 ontrack event fired for ${userId}:`, event);
      const [remoteStream] = event.streams;
      console.log(`📺 Received remote stream from ${userId}:`, remoteStream);
      console.log(`📊 Remote stream tracks:`, remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
      
      peer.stream = remoteStream;
      
      if (this.onPeerStreamChanged) {
        console.log(`🔔 Calling onPeerStreamChanged for ${userId}`);
        this.onPeerStreamChanged(userId, remoteStream);
      } else {
        console.log(`⚠️ No onPeerStreamChanged callback set for ${userId}`);
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      console.log(`Peer ${userId} connection state:`, connection.connectionState);
      if (connection.connectionState === 'connected') {
        console.log(`✅ Successfully connected to peer ${userId}`);
        
        // Notify UI about peer connection
        if (this.onPeerJoined) {
          this.onPeerJoined(peer);
        }
      } else if (connection.connectionState === 'failed') {
        console.log(`❌ Connection failed for peer ${userId}`);
        setTimeout(() => {
          // Retry connection after a delay
          this.connectToPeer(userId, displayName, photoURL);
        }, 2000);
      } else if (connection.connectionState === 'disconnected') {
        console.log(`⚠️ Connection disconnected for peer ${userId}`);
        // Don't remove immediately, might reconnect
      } else if (connection.connectionState === 'closed') {
        console.log(`🔒 Connection closed for peer ${userId}`);
        this.removePeer(userId);
      }
    };

    // Handle ICE connection state changes
    connection.oniceconnectionstatechange = () => {
      console.log(`Peer ${userId} ICE connection state:`, connection.iceConnectionState);
    };

    // Add local stream to connection
    if (this.localStream) {
      console.log(`📤 Adding local stream to peer connection for ${userId}`);
      console.log(`📊 Local stream tracks:`, this.localStream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
      this.localStream.getTracks().forEach(track => {
        connection.addTrack(track, this.localStream!);
        console.log(`✅ Added ${track.kind} track to peer ${userId}`);
      });
    } else {
      console.log(`⚠️ No local stream available for peer ${userId}`);
    }

    this.peers.set(userId, peer);
    console.log(`Peer connection created for ${userId}`);
    return peer;
  }

  private async removePeer(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(userId);
      
      if (this.onPeerLeft) {
        this.onPeerLeft(userId);
      }
    }
  }

  private startSignalingListener() {
    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
    }

    const q = query(
      collection(db, 'webrtcSignals'),
      where('roomId', '==', this.roomId),
      where('toUserId', '==', this.userId),
      orderBy('timestamp', 'desc')
    );

    this.signalingUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const signal = { id: change.doc.id, ...change.doc.data() } as WebRTCSignal;
          this.handleSignal(signal);
        }
      });
    });
  }

  private async handleSignal(signal: WebRTCSignal) {
    try {
      const { fromUserId, type, data } = signal;

      switch (type) {
        case 'offer':
          await this.handleOffer(fromUserId, data);
          break;
        case 'answer':
          await this.handleAnswer(fromUserId, data);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(fromUserId, data);
          break;
      }

      // Delete processed signal
      if (signal.id) {
        await deleteDoc(doc(db, 'webrtcSignals', signal.id));
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }

  private async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit) {
    console.log(`Received offer from ${fromUserId}`);
    
    let peer = this.peers.get(fromUserId);
    if (!peer) {
      // Try to get participant info from roomParticipants
      const participantInfo = await this.getParticipantInfo(fromUserId);
      peer = await this.createPeerConnection(
        fromUserId, 
        participantInfo.displayName || 'Unknown User', 
        participantInfo.photoURL || ''
      );
    }
    
    // Check peer connection state before setting remote description
    const currentState = peer.connection.signalingState;
    console.log(`Peer ${fromUserId} signaling state before offer: ${currentState}`);
    
    // Only process offer if we're in the right state
    if (currentState === 'stable' || currentState === 'have-remote-offer') {
      try {
        await peer.connection.setRemoteDescription(offer);
        console.log(`Set remote description for ${fromUserId}`);
        
        // Process pending ICE candidates now that remote description is set
        await this.processPendingIceCandidates(peer);
        
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        console.log(`Created and set local answer for ${fromUserId}`);
        
        await this.sendSignal(fromUserId, 'answer', answer);
        console.log(`Sent answer to ${fromUserId}`);
      } catch (error) {
        console.error(`Error handling offer from ${fromUserId}:`, error);
        
        // Try to recover by recreating the peer connection
        if (error instanceof Error && error.name === 'InvalidStateError') {
          console.log(`Attempting to recover peer connection for ${fromUserId}`);
          await this.recreatePeerConnection(fromUserId);
          
          // Retry the offer handling
          const newPeer = this.peers.get(fromUserId);
          if (newPeer) {
            await newPeer.connection.setRemoteDescription(offer);
            await this.processPendingIceCandidates(newPeer);
            const answer = await newPeer.connection.createAnswer();
            await newPeer.connection.setLocalDescription(answer);
            await this.sendSignal(fromUserId, 'answer', answer);
            console.log(`Successfully recovered and sent answer to ${fromUserId}`);
          }
        }
      }
    } else {
      console.warn(`Cannot process offer from ${fromUserId}, wrong state: ${currentState}`);
      
      // Try to recover by recreating the peer connection
      console.log(`Attempting to recover peer connection for ${fromUserId} from state ${currentState}`);
      await this.recreatePeerConnection(fromUserId);
    }
  }

  private async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit) {
    console.log(`Received answer from ${fromUserId}`);
    
    let peer = this.peers.get(fromUserId);
    if (!peer) {
      console.log(`Peer ${fromUserId} not found, waiting for peer creation...`);
      
      // Wait for peer to be created (max 5 seconds)
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        peer = this.peers.get(fromUserId);
        if (peer) break;
      }
      
      if (!peer) {
        console.error(`Peer ${fromUserId} still not found after waiting`);
        return;
      }
    }
    
    // Check peer connection state before setting remote description
    const currentState = peer.connection.signalingState;
    console.log(`Peer ${fromUserId} signaling state: ${currentState}`);
    
    // Only set remote description if we're in the right state
    if (currentState === 'have-local-offer') {
      try {
        await peer.connection.setRemoteDescription(answer);
        console.log(`Set remote description (answer) for ${fromUserId}`);
        
        // Process pending ICE candidates now that remote description is set
        await this.processPendingIceCandidates(peer);
      } catch (error) {
        console.error(`Error setting remote description for ${fromUserId}:`, error);
        
        // Try to recover by recreating the peer connection
        if (error instanceof Error && error.name === 'InvalidStateError') {
          console.log(`Attempting to recover peer connection for ${fromUserId}`);
          await this.recreatePeerConnection(fromUserId);
        }
      }
    } else {
      console.warn(`Cannot set remote description for ${fromUserId}, wrong state: ${currentState}`);
      
      // If we're in stable state, this might be a duplicate answer - ignore it
      if (currentState === 'stable') {
        console.log(`Ignoring duplicate answer from ${fromUserId}`);
        return;
      }
      
      // For other states, try to recover
      console.log(`Attempting to recover peer connection for ${fromUserId} from state ${currentState}`);
      await this.recreatePeerConnection(fromUserId);
    }
  }

  private async handleIceCandidate(fromUserId: string, candidateData: any) {
    console.log(`🧊 Received ICE candidate from ${fromUserId}`);
    
    let peer = this.peers.get(fromUserId);
    if (!peer) {
      console.log(`⏳ Peer ${fromUserId} not found for ICE candidate, waiting...`);
      
      // Wait for peer to be created (max 3 seconds)
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        peer = this.peers.get(fromUserId);
        if (peer) break;
      }
      
      if (!peer) {
        console.error(`❌ Peer ${fromUserId} still not found for ICE candidate`);
        return;
      }
    }
    
    try {
      // Reconstruct ICE candidate from serialized data
      const candidate = new RTCIceCandidate({
        candidate: candidateData.candidate,
        sdpMLineIndex: candidateData.sdpMLineIndex,
        sdpMid: candidateData.sdpMid,
        usernameFragment: candidateData.usernameFragment
      });
      
      // Check if remote description is set
      if (peer.connection.remoteDescription) {
        console.log(`✅ Adding ICE candidate immediately for ${fromUserId}`);
        await peer.connection.addIceCandidate(candidate);
        console.log(`🎉 Added ICE candidate for ${fromUserId}`);
      } else {
        console.log(`⏰ Remote description not set, queuing ICE candidate for ${fromUserId}`);
        peer.pendingIceCandidates.push(candidate);
        console.log(`📦 Queued ICE candidate for ${fromUserId} (${peer.pendingIceCandidates.length} pending)`);
      }
    } catch (error) {
      console.error(`❌ Error adding ICE candidate for ${fromUserId}:`, error);
    }
  }

  private async processPendingIceCandidates(peer: PeerInfo) {
    if (peer.pendingIceCandidates.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing ${peer.pendingIceCandidates.length} pending ICE candidates for ${peer.userId}`);
    
    for (const candidate of peer.pendingIceCandidates) {
      try {
        await peer.connection.addIceCandidate(candidate);
        console.log(`✅ Added pending ICE candidate for ${peer.userId}`);
      } catch (error) {
        console.error(`❌ Error adding pending ICE candidate for ${peer.userId}:`, error);
      }
    }
    
    // Clear pending candidates
    peer.pendingIceCandidates = [];
    console.log(`🧹 Cleared pending ICE candidates for ${peer.userId}`);
  }

  private async sendSignal(toUserId: string, type: WebRTCSignal['type'], data: any) {
    try {
      await addDoc(collection(db, 'webrtcSignals'), {
        roomId: this.roomId,
        fromUserId: this.userId,
        toUserId,
        type,
        data,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }

  private async sendJoinSignal() {
    try {
      console.log(`🚀 Sending join signal for room: ${this.roomId}, user: ${this.userId}`);
      
      // Add user to room participants
      await addDoc(collection(db, 'roomParticipants'), {
        roomId: this.roomId,
        userId: this.userId,
        displayName: this.displayName,
        photoURL: this.photoURL,
        joinedAt: Timestamp.now(),
        mediaSettings: this.mediaSettings
      });

      console.log(`✅ Successfully added user to room participants`);

      // Listen for other participants
      this.startParticipantListener();
      console.log(`👂 Started participant listener`);
    } catch (error) {
      console.error('❌ Error sending join signal:', error);
    }
  }

  private async sendLeaveSignal() {
    try {
      // Remove user from room participants
      const q = query(
        collection(db, 'roomParticipants'),
        where('roomId', '==', this.roomId),
        where('userId', '==', this.userId)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    } catch (error) {
      console.error('Error sending leave signal:', error);
    }
  }

  private startParticipantListener() {
    console.log(`🔍 Starting participant listener for room: ${this.roomId}`);
    
    if (this.participantUnsubscribe) {
      this.participantUnsubscribe();
    }

    const q = query(
      collection(db, 'roomParticipants'),
      where('roomId', '==', this.roomId)
    );

    this.participantUnsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📊 Participant snapshot received, ${snapshot.size} total participants`);
      
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        const participantId = data.userId;

        console.log(`👤 Participant change: ${change.type} - ${participantId} (${data.displayName})`);

        if (participantId === this.userId) {
          console.log(`⏭️ Skipping self: ${participantId}`);
          return; // Skip self
        }

        if (change.type === 'added') {
          console.log(`🆕 New participant joined: ${participantId}`);
          
          // Check if peer already exists
          if (!this.peers.has(participantId)) {
            console.log(`🔗 Connecting to new participant: ${participantId}`);
            // Connect to new participant
            this.connectToPeer(participantId, data.displayName, data.photoURL);
          } else {
            console.log(`⚠️ Peer ${participantId} already exists, skipping connection`);
          }
        } else if (change.type === 'removed') {
          console.log(`👋 Participant left: ${participantId}`);
          // Remove peer connection
          this.removePeer(participantId);
        }
      });
    });
  }

  private async broadcastMediaSettings() {
    // Broadcast media settings to all peers
    this.peers.forEach(async (peer) => {
      await this.sendSignal(peer.userId, 'media-settings' as any, this.mediaSettings);
    });
  }

  // Public method to initiate connection with a peer
  public async connectToPeer(userId: string, displayName: string, photoURL: string): Promise<void> {
    try {
      console.log(`🔗 Attempting to connect to peer: ${userId} (${displayName})`);
      
      // Check if peer already exists
      if (this.peers.has(userId)) {
        console.log(`⚠️ Peer ${userId} already exists, skipping connection`);
        return;
      }
      
      console.log(`🏗️ Creating peer connection for: ${userId}`);
      const peer = await this.createPeerConnection(userId, displayName, photoURL);
      
      console.log(`📝 Creating offer for peer: ${userId}`);
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      console.log(`✅ Set local description (offer) for peer: ${userId}`);
      
      console.log(`📤 Sending offer to peer: ${userId}`);
      await this.sendSignal(userId, 'offer', offer);
      console.log(`📨 Sent offer to peer: ${userId}`);
      
      console.log(`🎉 Successfully initiated connection to peer: ${userId}`);
    } catch (error) {
      console.error(`❌ Error connecting to peer ${userId}:`, error);
    }
  }

  // Ekran paylaşımı izinlerini kontrol et
  private async checkScreenSharePermission(): Promise<{ granted: boolean; reason?: string }> {
    try {
      // Permissions API kullanarak kontrol et (varsa)
      if ('permissions' in navigator) {
        try {
          // @ts-ignore - Permissions API henüz tam desteklenmiyor
          const permission = await navigator.permissions.query({ name: 'display-capture' });
          if (permission.state === 'denied') {
            return { granted: false, reason: 'Ekran paylaşımı izni reddedildi' };
          }
        } catch (permError) {
          console.log('Permissions API not available or failed:', permError);
        }
      }

      // Basit bir test ile kontrol et
      try {
        const testStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1 },
          audio: false
        });
        testStream.getTracks().forEach(track => track.stop());
        return { granted: true };
      } catch (testError) {
        return { 
          granted: false, 
          reason: testError instanceof Error ? testError.message : 'Test başarısız' 
        };
      }
    } catch (error) {
      return { 
        granted: false, 
        reason: error instanceof Error ? error.message : 'Bilinmeyen hata' 
      };
    }
  }



  private async getParticipantInfo(userId: string): Promise<{ displayName: string; photoURL: string }> {
    try {
      const q = query(
        collection(db, 'roomParticipants'),
        where('roomId', '==', this.roomId),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return {
          displayName: data.displayName || 'Unknown User',
          photoURL: data.photoURL || ''
        };
      }
    } catch (error) {
      console.error('Error getting participant info:', error);
    }
    
    return { displayName: 'Unknown User', photoURL: '' };
  }
}

// Singleton instance
export const webrtcService = new WebRTCService(); 