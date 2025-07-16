import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile,
  sendEmailVerification,
  reload
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Kullanıcı tipi
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  lastSeen: Date;
  status: 'online' | 'idle' | 'dnd' | 'offline';
}

// Kullanıcı kayıt
export const registerUser = async (email: string, password: string, displayName: string) => {
  try {
    // Firebase Authentication'da kullanıcı oluştur
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Kullanıcı profilini güncelle
    await updateProfile(user, { displayName });
    
    // Email doğrulama gönder
    try {
      await sendEmailVerification(user);
    } catch (emailError: any) {
      // Email verification başarısız olsa bile kayıt devam etsin
    }
    
    // Firestore'da kullanıcı belgesi oluştur
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      createdAt: new Date(),
      lastSeen: new Date(),
      status: 'online'
    };

    // PhotoURL varsa ekle
    if (user.photoURL) {
      userProfile.photoURL = user.photoURL;
    }
    
    await setDoc(doc(db, 'users', user.uid), userProfile);
    
    return { 
      success: true, 
      user: userProfile, 
      message: 'Kayıt başarılı! Lütfen e-postanızı kontrol edin ve doğrulama linkine tıklayın.' 
    };
  } catch (error: any) {
    let errorMessage = error.message;
    
    // Firebase hata kodlarını Türkçe'ye çevir
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Bu email adresi zaten kullanımda. Farklı bir email deneyin veya giriş yapın.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Şifre çok zayıf. En az 6 karakter olmalı.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Geçersiz email adresi.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Kullanıcı giriş
export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Email doğrulamasını kontrol et
    if (!user.emailVerified) {
      // Email doğrulanmamış kullanıcıyı çıkış yap
      await signOut(auth);
      return { 
        success: false, 
        error: 'Email adresiniz henüz doğrulanmamış. Lütfen e-postanızı kontrol edin ve doğrulama linkine tıklayın.',
        emailNotVerified: true 
      };
    }
    
    // Kullanıcı verilerini Firestore'dan al
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserProfile;
      
      // Son görülme zamanını güncelle
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        lastSeen: new Date(),
        status: 'online'
      });
      
      return { success: true, user: userData };
    }
    
    return { success: false, error: 'Kullanıcı verisi bulunamadı' };
  } catch (error: any) {
    let errorMessage = error.message;
    
    // Firebase hata kodlarını Türkçe'ye çevir
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Bu email adresi ile kayıtlı kullanıcı bulunamadı.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Hatalı şifre.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Geçersiz email adresi.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Kullanıcı çıkış
export const logoutUser = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      // Kullanıcı durumunu offline yap
      await setDoc(doc(db, 'users', user.uid), {
        lastSeen: new Date(),
        status: 'offline'
      }, { merge: true });
    }
    
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Auth state değişikliklerini dinle
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Mevcut kullanıcı bilgilerini al
export const getCurrentUser = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  return userDoc.exists() ? userDoc.data() as UserProfile : null;
};

// Kullanıcı profilini güncelle
export const updateUserProfile = async (updates: Partial<UserProfile>) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Kullanıcı giriş yapmamış');

    // Firebase Auth profilini güncelle
    const authUpdates: any = {};
    if (updates.displayName) authUpdates.displayName = updates.displayName;
    if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;
    
    if (Object.keys(authUpdates).length > 0) {
      await updateProfile(user, authUpdates);
    }

    // Firestore'da kullanıcı belgesini güncelle
    const firestoreUpdates = {
      ...updates,
      updatedAt: new Date()
    };
    
    await updateDoc(doc(db, 'users', user.uid), firestoreUpdates);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return { success: false, error: error.message };
  }
}; 

// Email doğrulama gönder
export const sendEmailVerificationCode = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      return { success: true, message: 'Doğrulama e-postası gönderildi!' };
    }
    return { success: false, error: 'Kullanıcı bulunamadı' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Email doğrulama durumunu kontrol et
export const checkEmailVerification = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await reload(user);
      return { success: true, verified: user.emailVerified };
    }
    return { success: false, error: 'Kullanıcı bulunamadı' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}; 

// Status güncelleme fonksiyonu
export const updateUserStatus = async (status: 'online' | 'idle' | 'dnd' | 'offline') => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Kullanıcı giriş yapmamış');

    // Firestore'da kullanıcının status'unu güncelle
    await updateDoc(doc(db, 'users', user.uid), {
      status: status,
      lastSeen: new Date()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user status:', error);
    return { success: false, error: error.message };
  }
}; 