import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { VoiceState } from '../types';

// Kullanıcının sesli kanala katılması
export const joinVoiceChannel = async (
  userId: string,
  channelId: string,
  serverId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Önce kullanıcının mevcut sesli durumunu kontrol et
    await leaveVoiceChannel(userId);

    // Yeni sesli durumu oluştur
    const voiceState: Omit<VoiceState, 'id'> = {
      userId,
      channelId,
      serverId,
      isMuted: false,
      isDeafened: false,
      isSelfMuted: false,
      isSelfDeafened: false,
      isVideoEnabled: false,
      isScreenSharing: false,
      joinedAt: new Date(),
    };

    await addDoc(collection(db, 'voiceStates'), {
      ...voiceState,
      joinedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error) {
    console.error('Error joining voice channel:', error);
    return { success: false, error: 'Sesli kanala katılırken hata oluştu.' };
  }
};

// Kullanıcının sesli kanaldan ayrılması
export const leaveVoiceChannel = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Kullanıcının mevcut sesli durumunu bul ve sil
    const voiceQuery = query(
      collection(db, 'voiceStates'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(voiceQuery, (snapshot) => {
      snapshot.docs.forEach(async (docSnapshot) => {
        await deleteDoc(docSnapshot.ref);
      });
    });

    // Cleanup listener
    unsubscribe();

    return { success: true };
  } catch (error) {
    console.error('Error leaving voice channel:', error);
    return { success: false, error: 'Sesli kanaldan ayrılırken hata oluştu.' };
  }
};

// Sesli durum güncelleme (mute, deafen, etc.)
export const updateVoiceState = async (
  userId: string,
  updates: Partial<VoiceState>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const voiceQuery = query(
      collection(db, 'voiceStates'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(voiceQuery, (snapshot) => {
      snapshot.docs.forEach(async (docSnapshot) => {
        await updateDoc(docSnapshot.ref, updates);
      });
    });

    // Cleanup listener
    unsubscribe();

    return { success: true };
  } catch (error) {
    console.error('Error updating voice state:', error);
    return { success: false, error: 'Sesli durum güncellenirken hata oluştu.' };
  }
};

// Kanaldaki kullanıcıları dinleme
export const subscribeToVoiceChannel = (
  channelId: string,
  callback: (users: (VoiceState & { id: string })[]) => void
): (() => void) => {
  const voiceQuery = query(
    collection(db, 'voiceStates'),
    where('channelId', '==', channelId)
  );

  return onSnapshot(voiceQuery, (snapshot) => {
    const voiceUsers: (VoiceState & { id: string })[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      voiceUsers.push({
        id: doc.id,
        ...data,
        joinedAt: data.joinedAt?.toDate() || new Date(),
      } as VoiceState & { id: string });
    });

    callback(voiceUsers);
  });
};

// Tüm sunucudaki sesli kullanıcıları dinleme
export const subscribeToServerVoiceStates = (
  serverId: string,
  callback: (users: (VoiceState & { id: string })[]) => void
): (() => void) => {
  const voiceQuery = query(
    collection(db, 'voiceStates'),
    where('serverId', '==', serverId)
  );

  return onSnapshot(voiceQuery, (snapshot) => {
    const voiceUsers: (VoiceState & { id: string })[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      voiceUsers.push({
        id: doc.id,
        ...data,
        joinedAt: data.joinedAt?.toDate() || new Date(),
      } as VoiceState & { id: string });
    });

    callback(voiceUsers);
  });
};

// WebRTC Connection helper (gelecekte genişletilebilir)
export class VoiceConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();

  constructor() {
    this.initializePeerConnection();
  }

  private initializePeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // ICE candidate'i diğer kullanıcılara gönder
        console.log('ICE Candidate:', event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const userId = 'remote-user-id'; // Bu bilgiyi signaling'den alacağız
      this.remoteStreams.set(userId, remoteStream);
    };
  }

  async startVoice(): Promise<{ success: boolean; error?: string }> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return { success: false, error: 'Mikrofon erişimi reddedildi.' };
    }
  }

  async stopVoice(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.initializePeerConnection();
    }

    this.remoteStreams.clear();
  }

  muteMicrophone(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  setVolume(userId: string, volume: number): void {
    const remoteStream = this.remoteStreams.get(userId);
    if (remoteStream) {
      // Volume kontrolü için Audio Context kullanılabilir
      console.log(`Setting volume for ${userId}: ${volume}`);
    }
  }
}

export default VoiceConnection; 