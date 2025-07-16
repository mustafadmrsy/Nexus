import { 
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { Room } from '../types';

// Oda oluşturma
export const createRoom = async (
  channelId: string,
  serverId: string,
  name: string,
  type: 'voice' | 'video' | 'screen',
  description: string = '',
  maxUsers: number = 10,
  isPrivate: boolean = false,
  password: string = '',
  createdBy: string
) => {
  try {
    const roomData = {
      channelId,
      serverId,
      name: name.trim(),
      type,
      description: description.trim(),
      maxUsers,
      currentUsers: [],
      isPrivate,
      password: password.trim(),
      createdBy,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'rooms'), roomData);
    
    return {
      success: true,
      roomId: docRef.id,
      data: { ...roomData, id: docRef.id }
    };
  } catch (error) {
    console.error('Oda oluşturulurken hata:', error);
    return {
      success: false,
      error: 'Oda oluşturulamadı'
    };
  }
};

// Kanal odalarını getirme
export const getChannelRooms = async (channelId: string) => {
  try {
    const q = query(
      collection(db, 'rooms'),
      where('channelId', '==', channelId),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const rooms: Room[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      rooms.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Room);
    });
    
    return {
      success: true,
      data: rooms
    };
  } catch (error) {
    console.error('Odalar getirilirken hata:', error);
    
    // Fallback: Sadece channelId ile filtreleme (orderBy olmadan)
    try {
      const fallbackQuery = query(
        collection(db, 'rooms'),
        where('channelId', '==', channelId)
      );
      
      const fallbackSnapshot = await getDocs(fallbackQuery);
      const rooms: Room[] = [];
      
      fallbackSnapshot.forEach((doc) => {
        const data = doc.data();
        rooms.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Room);
      });
      
      // Manuel olarak sırala
      rooms.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      return {
        success: true,
        data: rooms
      };
    } catch (fallbackError) {
      console.error('Fallback room query also failed:', fallbackError);
      return {
        success: false,
        error: 'Odalar getirilemedi'
      };
    }
  }
};

// Odaya kullanıcı katılma
export const joinRoom = async (roomId: string, userId: string, password?: string, bypassPermissions?: boolean) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      return {
        success: false,
        error: 'Oda bulunamadı'
      };
    }
    
    const roomData = roomDoc.data() as Room;
    
    // Davet kabul ederse bypass permissions log
    if (bypassPermissions) {
      console.log(`🎯 Davet kabul edildi - İzin kontrolü bypass edildi - User: ${userId}, Room: ${roomId}`);
    }
    
    // Özel oda şifre kontrolü
    if (roomData.isPrivate && roomData.password) {
      if (!password) {
        return {
          success: false,
          error: 'Bu özel oda için şifre gereklidir',
          requiresPassword: true
        };
      }
      
      if (password !== roomData.password) {
        return {
          success: false,
          error: 'Yanlış şifre',
          requiresPassword: true
        };
      }
    }
    
    // Maksimum kullanıcı kontrolü
    if (roomData.currentUsers.length >= roomData.maxUsers) {
      return {
        success: false,
        error: 'Oda dolu'
      };
    }
    
    // Kullanıcı zaten odada mı kontrolü
    if (roomData.currentUsers.includes(userId)) {
      return {
        success: false,
        error: 'Zaten odadasınız'
      };
    }
    
    await updateDoc(roomRef, {
      currentUsers: arrayUnion(userId)
    });
    
    return {
      success: true,
      data: { roomId, userId }
    };
  } catch (error) {
    console.error('Odaya katılırken hata:', error);
    return {
      success: false,
      error: 'Odaya katılınamadı'
    };
  }
};

// Odadan kullanıcı çıkma
export const leaveRoom = async (roomId: string, userId: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    
    await updateDoc(roomRef, {
      currentUsers: arrayRemove(userId)
    });
    
    return {
      success: true,
      data: { roomId, userId }
    };
  } catch (error) {
    console.error('Odadan çıkarken hata:', error);
    return {
      success: false,
      error: 'Odadan çıkılamadı'
    };
  }
};

// Oda silme
export const deleteRoom = async (roomId: string) => {
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
    
    return {
      success: true,
      data: { roomId }
    };
  } catch (error) {
    console.error('Oda silinirken hata:', error);
    return {
      success: false,
      error: 'Oda silinemedi'
    };
  }
};

// Oda güncelleme
export const updateRoom = async (
  roomId: string,
  updates: Partial<{
    name: string;
    description: string;
    maxUsers: number;
    isPrivate: boolean;
    password: string;
  }>
) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    
    await updateDoc(roomRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      data: { roomId, ...updates }
    };
  } catch (error) {
    console.error('Oda güncellenirken hata:', error);
    return {
      success: false,
      error: 'Oda güncellenemedi'
    };
  }
};

// Oda dinleme (real-time)
export const subscribeToChannelRooms = (
  channelId: string,
  callback: (rooms: Room[]) => void
) => {
  const q = query(
    collection(db, 'rooms'),
    where('channelId', '==', channelId),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const rooms: Room[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      rooms.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Room);
    });
    
    callback(rooms);
  }, (error) => {
    console.error('Error listening to channel rooms:', error);
    
    // Fallback: Sadece channelId ile filtreleme (orderBy olmadan)
    const fallbackQuery = query(
      collection(db, 'rooms'),
      where('channelId', '==', channelId)
    );
    
    return onSnapshot(fallbackQuery, (snapshot) => {
      const rooms: Room[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        rooms.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Room);
      });
      
      // Manuel olarak sırala
      rooms.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      callback(rooms);
    }, (fallbackError) => {
      console.error('Fallback room listener also failed:', fallbackError);
      callback([]);
    });
  });
};

// Oda dinleme (real-time)
export const subscribeToRoom = (
  roomId: string,
  callback: (room: Room | null) => void
) => {
  const roomRef = doc(db, 'rooms', roomId);
  
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback({
        id: snapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Room);
    } else {
      callback(null);
    }
  });
};

// Kullanıcının mevcut olduğu odayı getir
export const getUserCurrentRoom = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'rooms'),
      where('currentUsers', 'array-contains', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        success: true,
        data: {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Room
      };
    }
    
    return {
      success: true,
      data: null
    };
  } catch (error) {
    console.error('Kullanıcı odası getirilirken hata:', error);
    return {
      success: false,
      error: 'Kullanıcı odası getirilemedi'
    };
  }
};

// Kullanıcıyı tüm odalardan çıkar
export const leaveAllRooms = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'rooms'),
      where('currentUsers', 'array-contains', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    
    querySnapshot.forEach((doc) => {
      batch.update(doc.ref, {
        currentUsers: arrayRemove(userId)
      });
    });
    
    await batch.commit();
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Tüm odalardan çıkarken hata:', error);
    return {
      success: false,
      error: 'Tüm odalardan çıkılamadı'
    };
  }
}; 