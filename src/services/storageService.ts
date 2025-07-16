import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  uploadBytesResumable,
  UploadTask 
} from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { storage, db, auth } from './firebase';

// Desteklenen dosya türleri
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Maksimum dosya boyutu (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Dosya doğrulama
const validateFile = (file: File): { isValid: boolean; error?: string } => {
  if (!file) {
    return { isValid: false, error: 'Dosya seçilmedi' };
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return { isValid: false, error: 'Desteklenmeyen dosya türü. Lütfen JPEG, PNG, GIF veya WebP formatında bir resim seçin.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: 'Dosya boyutu çok büyük. Maksimum 5MB olmalıdır.' };
  }

  return { isValid: true };
};

// Profil fotoğrafı yükle
export const uploadProfilePhoto = async (
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; photoURL?: string; error?: string }> => {
  try {
    console.log('uploadProfilePhoto called with:', { fileName: file.name, userId });
    
    // Dosya doğrulama
    const validation = validateFile(file);
    if (!validation.isValid) {
      console.error('File validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    console.log('File validation passed');

    // Eski profil fotoğrafını sil
    await deleteOldProfilePhoto(userId);

    // Dosya yolu
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `profile-photos/${userId}/${fileName}`;
    const fileRef = ref(storage, filePath);

    console.log('Uploading to path:', filePath);

    // Dosya yükleme
    const uploadTask = uploadBytesResumable(fileRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload progress:', progress + '%');
          onProgress?.(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject({ success: false, error: error.message });
        },
        async () => {
          try {
            console.log('Upload completed, getting download URL');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Download URL obtained:', downloadURL);

            // Kullanıcı profili güncelle
            if (auth.currentUser) {
              await updateProfile(auth.currentUser, {
                photoURL: downloadURL
              });
              console.log('Firebase Auth profile updated');
            }

            // Firestore'da kullanıcı belgesi güncelle
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, {
              photoURL: downloadURL
            });
            console.log('Firestore user document updated');

            resolve({ success: true, photoURL: downloadURL });
          } catch (error) {
            console.error('Error updating profile:', error);
            reject({ success: false, error: 'Profil güncellenirken hata oluştu' });
          }
        }
      );
    });
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Dosya yüklenirken hata oluştu' };
  }
};

// Sunucu icon yükle
export const uploadServerIcon = async (
  file: File,
  serverId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; iconURL?: string; error?: string }> => {
  try {
    console.log('uploadServerIcon called with:', { fileName: file.name, serverId });
    
    // Dosya doğrulama
    const validation = validateFile(file);
    if (!validation.isValid) {
      console.error('File validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    console.log('File validation passed');

    // Dosya yolu
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `server-icons/${serverId}/${fileName}`;
    const fileRef = ref(storage, filePath);

    console.log('Uploading to path:', filePath);

    // Dosya yükleme
    const uploadTask = uploadBytesResumable(fileRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload progress:', progress + '%');
          onProgress?.(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject({ success: false, error: error.message });
        },
        async () => {
          try {
            console.log('Upload completed, getting download URL');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Download URL obtained:', downloadURL);

            // Firestore'da server belgesi güncelle
            const serverDocRef = doc(db, 'servers', serverId);
            await updateDoc(serverDocRef, {
              iconURL: downloadURL
            });
            console.log('Firestore server document updated');

            resolve({ success: true, iconURL: downloadURL });
          } catch (error) {
            console.error('Error updating server:', error);
            reject({ success: false, error: 'Sunucu güncellenirken hata oluştu' });
          }
        }
      );
    });
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Dosya yüklenirken hata oluştu' };
  }
};

// Eski profil fotoğrafını sil
const deleteOldProfilePhoto = async (userId: string): Promise<void> => {
  try {
    // Kullanıcının mevcut profil fotoğrafını bul
    const userDoc = await import('firebase/firestore').then(({ doc, getDoc }) => 
      getDoc(doc(db, 'users', userId))
    );
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentPhotoURL = userData.photoURL;
      
      if (currentPhotoURL && currentPhotoURL.includes('profile-photos/')) {
        // URL'den dosya yolunu çıkar
        const urlParts = currentPhotoURL.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        
        // Eski dosyayı sil
        const oldPhotoRef = ref(storage, `profile-photos/${fileName}`);
        await deleteObject(oldPhotoRef);
      }
    }
  } catch (error) {
    // Eski dosya silme hatası önemli değil, yeni fotoğraf yüklendi
    console.warn('Could not delete old profile photo:', error);
  }
};

// Profil fotoğrafını sil
export const deleteProfilePhoto = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Mevcut profil fotoğrafını sil
    await deleteOldProfilePhoto(userId);
    
    // Profil bilgilerini güncelle (hem Auth hem Firestore)
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        photoURL: null
      });
    }
    
    // Firestore'daki user profilini güncelle
    await updateDoc(doc(db, 'users', userId), {
      photoURL: null
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting profile photo:', error);
    return { success: false, error: error.message };
  }
};

// Genel dosya yükleme (mesaj ekleri için)
export const uploadFile = async (
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; downloadURL?: string; error?: string }> => {
  try {
    // Dosya boyutu kontrolü (genel dosyalar için 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'Dosya boyutu çok büyük. Maksimum 10MB olmalıdır.' };
    }

    // Dosya adı oluştur
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `${path}/${fileName}`);

    // Dosya yükleme
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (onProgress) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          }
        },
        (error) => {
          console.error('Upload error:', error);
          resolve({ success: false, error: 'Dosya yükleme hatası' });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ success: true, downloadURL });
          } catch (error: any) {
            resolve({ success: false, error: error.message });
          }
        }
      );
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return { success: false, error: error.message };
  }
};

// Dosya sil
export const deleteFile = async (downloadURL: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // URL'den dosya yolunu çıkar
    const urlParts = downloadURL.split('/');
    const filePathWithQuery = urlParts[urlParts.length - 1];
    const filePath = filePathWithQuery.split('?')[0];
    
    // Storage referansı oluştur
    const fileRef = ref(storage, filePath);
    
    // Dosyayı sil
    await deleteObject(fileRef);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
};

// Resim boyutlarını kontrol et
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Resmi yeniden boyutlandır
export const resizeImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Orijinal boyutları hesapla
      let { width, height } = img;
      
      // Yeni boyutları hesapla
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Resmi çiz ve blob olarak döndür
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}; 