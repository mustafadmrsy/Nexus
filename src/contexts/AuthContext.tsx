import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile, onAuthStateChange, getCurrentUser, logoutUser } from '../services/authService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = async () => {
    if (currentUser && currentUser.emailVerified) {
      try {
        const profile = await getCurrentUser();
        setUserProfile(profile);
      } catch (error) {
        console.error('Error refreshing user profile:', error);
        setUserProfile(null);
      }
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const result = await logoutUser();
      if (result.success) {
      setCurrentUser(null);
      setUserProfile(null);
        // Sayfayı yenile veya login sayfasına yönlendir
        window.location.href = '/';
      } else {
        console.error('Logout failed:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setCurrentUser(user);
      
      // Kullanıcı yoksa veya email doğrulanmamışsa profil null yap
      if (!user || !user.emailVerified) {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Real-time profil dinleyicisi
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    if (currentUser && currentUser.emailVerified) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      
      unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUserProfile({
            uid: docSnap.id,
            ...userData,
            createdAt: userData.createdAt?.toDate() || new Date(),
            lastSeen: userData.lastSeen?.toDate() || new Date(),
          } as UserProfile);
        } else {
          setUserProfile(null);
        }
      }, (error) => {
        console.error('Error listening to user profile:', error);
        setUserProfile(null);
      });
    }

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [currentUser]);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    logout,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 