import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  TextField,
  Button,
  Paper,
  Grid,
  Divider,
  IconButton,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  PhotoCamera,
  Person,
  Email,
  CalendarToday,
  Tag,
  Delete,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { uploadProfilePhoto, deleteProfilePhoto } from '../services/storageService';

const ProfilePage: React.FC = () => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useThemeContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    displayName: userProfile?.displayName || '',
    bio: (userProfile as any)?.bio || '',
    status: userProfile?.status || 'online',
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    // TODO: Implement profile update logic
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedProfile({
      displayName: userProfile?.displayName || '',
      bio: (userProfile as any)?.bio || '',
      status: userProfile?.status || 'online',
    });
    setIsEditing(false);
    setUploadMessage(null);
  };

  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userProfile?.uid) {
      console.log('No file selected or user profile not available');
      return;
    }

    console.log('Starting photo upload:', { fileName: file.name, fileSize: file.size, fileType: file.type });

    setPhotoUploading(true);
    setUploadProgress(0);
    setUploadMessage(null);

    try {
      const result = await uploadProfilePhoto(file, userProfile.uid, (progress) => {
        console.log('Upload progress:', progress);
        setUploadProgress(progress);
      });

      console.log('Upload result:', result);

      if (result.success) {
        setUploadMessage({ type: 'success', text: 'Profil fotoğrafı başarıyla güncellendi!' });
        // Sayfa otomatik olarak güncellenecek çünkü AuthContext userProfile'ı güncelleyecek
      } else {
        console.error('Upload failed:', result.error);
        setUploadMessage({ type: 'error', text: result.error || 'Fotoğraf yüklenemedi' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage({ type: 'error', text: 'Bir hata oluştu: ' + (error as Error).message });
    } finally {
      setPhotoUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async () => {
    if (!userProfile?.uid) return;

    setPhotoUploading(true);
    setUploadMessage(null);

    try {
      const result = await deleteProfilePhoto(userProfile.uid);
      if (result.success) {
        setUploadMessage({ type: 'success', text: 'Profil fotoğrafı silindi!' });
      } else {
        setUploadMessage({ type: 'error', text: result.error || 'Fotoğraf silinemedi' });
      }
    } catch (error) {
      setUploadMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'offline': return '#747f8d';
      default: return '#43b581';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Çevrimiçi';
      case 'idle': return 'Boşta';
      case 'offline': return 'Çevrimdışı';
      default: return 'Çevrimiçi';
    }
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      p: 3,
      backgroundColor: isDarkMode ? '#36393f' : '#f5f5f5',
      overflow: 'auto'
    }}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Profil Ayarları
      </Typography>

      {uploadMessage && (
        <Alert severity={uploadMessage.type} sx={{ mb: 3, borderRadius: 2 }}>
          {uploadMessage.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Sol Panel - Profil Bilgileri */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
            borderRadius: 2,
            p: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <Avatar 
                    src={userProfile?.photoURL} 
                    sx={{ width: 120, height: 120, fontSize: '2rem' }}
                  >
                    {userProfile?.displayName?.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  {/* Fotoğraf yükleme progress */}
                  {photoUploading && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      bottom: 0, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      borderRadius: '50%'
                    }}>
                      <Box sx={{ textAlign: 'center', color: 'white' }}>
                        <CircularProgress size={40} color="inherit" />
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          {uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : 'Yükleniyor...'}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  
                  {/* Fotoğraf yükleme butonu */}
                  <IconButton
                    onClick={handlePhotoClick}
                    disabled={photoUploading}
                    sx={{
                      position: 'absolute',
                      bottom: -5,
                      right: -5,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '&:disabled': {
                        backgroundColor: 'grey.500',
                      },
                    }}
                    size="small"
                  >
                    <PhotoCamera fontSize="small" />
                  </IconButton>
                  
                  {/* Fotoğraf silme butonu */}
                  {userProfile?.photoURL && (
                    <IconButton
                      onClick={handleDeletePhoto}
                      disabled={photoUploading}
                      sx={{
                        position: 'absolute',
                        bottom: -5,
                        left: -5,
                        backgroundColor: 'error.main',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'error.dark',
                        },
                        '&:disabled': {
                          backgroundColor: 'grey.500',
                        },
                      }}
                      size="small"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}

                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </Box>

                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {userProfile?.displayName}
                </Typography>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  #{userProfile?.uid?.slice(-4)}
                </Typography>

                <Chip
                  label={getStatusText(userProfile?.status || 'online')}
                  size="small"
                  sx={{
                    backgroundColor: getStatusColor(userProfile?.status || 'online'),
                    color: 'white',
                    mb: 2,
                  }}
                />

                <Box sx={{ width: '100%', textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {(userProfile as any)?.bio || 'Henüz bir biyografi eklenmemiş.'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sağ Panel - Düzenlenebilir Bilgiler */}
        <Grid item xs={12} md={8}>
          <Card sx={{ 
            backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
            borderRadius: 2,
            p: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">
                  Profil Bilgileri
                </Typography>
                
                {!isEditing ? (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={handleEdit}
                  >
                    Düzenle
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      size="small"
                    >
                      Kaydet
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Cancel />}
                      onClick={handleCancel}
                      size="small"
                    >
                      İptal
                    </Button>
                  </Box>
                )}
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Person color="action" />
                  <TextField
                    label="Görünen Ad"
                    value={isEditing ? editedProfile.displayName : userProfile?.displayName}
                    onChange={(e) => setEditedProfile({ ...editedProfile, displayName: e.target.value })}
                    disabled={!isEditing}
                    fullWidth
                    variant="outlined"
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Email color="action" />
                  <TextField
                    label="E-posta"
                    value={userProfile?.email}
                    disabled
                    fullWidth
                    variant="outlined"
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Tag color="action" />
                  <TextField
                    label="Kullanıcı Etiketi"
                    value={`#${userProfile?.uid?.slice(-4)}`}
                    disabled
                    fullWidth
                    variant="outlined"
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CalendarToday color="action" />
                  <TextField
                    label="Üyelik Tarihi"
                    value={userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('tr-TR') : ''}
                    disabled
                    fullWidth
                    variant="outlined"
                  />
                </Box>

                <TextField
                  label="Biyografi"
                  multiline
                  rows={4}
                  value={isEditing ? editedProfile.bio : (userProfile as any)?.bio || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  disabled={!isEditing}
                  fullWidth
                  variant="outlined"
                  placeholder="Kendinizi tanıtın..."
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage; 