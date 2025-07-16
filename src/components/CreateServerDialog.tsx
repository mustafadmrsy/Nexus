import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Avatar,
  IconButton,
  Divider,
  LinearProgress,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel
} from '@mui/material';
import {
  Create,
  Close,
  Group,
  Public,
  Lock,
  PhotoCamera,
  Add,
  Security,
  Settings
} from '@mui/icons-material';
import { createServer } from '../services/userService';
import { uploadServerIcon } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';

interface CreateServerDialogProps {
  open: boolean;
  onClose: () => void;
  onServerCreated?: () => void;
}

export const CreateServerDialog: React.FC<CreateServerDialogProps> = ({
  open,
  onClose,
  onServerCreated
}) => {
  const { userProfile } = useAuth();
  const [serverName, setServerName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPrivate, setIsPrivate] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [serverType, setServerType] = useState<'community' | 'private' | 'gaming'>('private');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIconFile(file);
      
      // Önizleme oluştur
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateServer = async () => {
    if (!serverName.trim()) {
      setMessage({ type: 'error', text: 'Lütfen sunucu adını girin' });
      return;
    }

    if (!userProfile?.uid) {
      setMessage({ type: 'error', text: 'Kullanıcı oturumu bulunamadı' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Sunucu ayarları
      const serverSettings = {
        isPrivate,
        requireApproval,
        serverType,
        maxMembers: serverType === 'private' ? 100 : serverType === 'gaming' ? 500 : 5000
      };

      // Önce sunucuyu oluştur
      const result = await createServer(serverName.trim(), description.trim(), userProfile.uid, serverSettings);
      
      if (result.success && result.serverId) {
        // Server icon varsa yükle
        if (iconFile) {
          const iconResult = await uploadServerIcon(iconFile, result.serverId, setUploadProgress);
          if (!iconResult.success) {
            setMessage({ type: 'error', text: iconResult.error || 'Icon yükleme hatası' });
            return;
          }
        }
        
        setMessage({ type: 'success', text: 'Sunucu başarıyla oluşturuldu!' });
        onServerCreated?.();
        
        // Kısa bir süre sonra dialog'u kapat
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.error || 'Sunucu oluşturulurken hata oluştu' });
      }
    } catch (error) {
      console.error('Server creation error:', error);
      setMessage({ type: 'error', text: 'Sunucu oluşturulurken hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setServerName('');
    setDescription('');
    setIconFile(null);
    setIconPreview(null);
    setUploadProgress(0);
    setMessage(null);
    setIsPrivate(true);
    setRequireApproval(false);
    setServerType('private');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#36393f',
          color: 'white',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: '#2f3136', 
        color: 'white', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Create />
          <Typography variant="h6">Sunucu Oluştur</Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {message && (
          <Alert 
            severity={message.type} 
            sx={{ 
              mb: 2,
              backgroundColor: message.type === 'error' ? '#ed4245' : '#3ba55d',
              color: 'white',
              '& .MuiAlert-icon': {
                color: 'white'
              }
            }}
          >
            {message.text}
          </Alert>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Icon yükleniyor...
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={uploadProgress} 
              sx={{ 
                backgroundColor: '#40444b',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#5865f2'
                }
              }}
            />
          </Box>
        )}

        {/* Sunucu İkonu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80, 
              backgroundColor: '#5865f2',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8
              }
            }}
            onClick={() => document.getElementById('server-icon-input')?.click()}
          >
            {iconPreview ? (
              <img 
                src={iconPreview} 
                alt="Server icon" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <PhotoCamera />
            )}
          </Avatar>
          <Box>
            <Typography variant="h6" color="white">
              {serverName || 'Sunucu Adı'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sunucu ikonu seçmek için tıklayın
            </Typography>
          </Box>
          <input
            id="server-icon-input"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </Box>

        {/* Sunucu Türü */}
        <Card sx={{ mb: 3, backgroundColor: '#2f3136' }}>
          <CardContent>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ color: 'white', mb: 2 }}>
                <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
                Sunucu Türü
              </FormLabel>
              <RadioGroup
                value={serverType}
                onChange={(e) => setServerType(e.target.value as 'community' | 'private' | 'gaming')}
                sx={{ gap: 1 }}
              >
                <FormControlLabel
                  value="private"
                  control={<Radio sx={{ color: '#5865f2' }} />}
                  label={
                    <Box>
                      <Typography variant="body2" color="white">
                        <Lock sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                        Özel Sunucu
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Sadece davet edilen kişiler katılabilir (100 üye)
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="gaming"
                  control={<Radio sx={{ color: '#5865f2' }} />}
                  label={
                    <Box>
                      <Typography variant="body2" color="white">
                        <Group sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                        Oyun Sunucusu
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Oyun topluluğu için orta ölçekli sunucu (500 üye)
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="community"
                  control={<Radio sx={{ color: '#5865f2' }} />}
                  label={
                    <Box>
                      <Typography variant="body2" color="white">
                        <Public sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                        Topluluk Sunucusu
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Büyük topluluklar için genel sunucu (5000 üye)
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>

        <TextField
          fullWidth
          label="Sunucu Adı"
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          disabled={loading}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#40444b',
              color: 'white',
              '& fieldset': {
                borderColor: '#40444b',
              },
              '&:hover fieldset': {
                borderColor: '#5865f2',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#5865f2',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'text.secondary',
            },
          }}
          InputProps={{
            style: { color: 'white' }
          }}
        />

        <TextField
          fullWidth
          label="Açıklama (isteğe bağlı)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
          disabled={loading}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#40444b',
              color: 'white',
              '& fieldset': {
                borderColor: '#40444b',
              },
              '&:hover fieldset': {
                borderColor: '#5865f2',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#5865f2',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'text.secondary',
            },
          }}
          InputProps={{
            style: { color: 'white' }
          }}
        />

        {/* Ek Ayarlar */}
        <Card sx={{ mb: 3, backgroundColor: '#2f3136' }}>
          <CardContent>
            <Typography variant="subtitle2" color="white" gutterBottom>
              <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
              Güvenlik Ayarları
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  sx={{ color: '#5865f2' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" color="white">
                    Üyelik Onayı Gerekli
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Yeni üyeler sunucuya katılmadan önce yöneticiler tarafından onaylanmalı
                  </Typography>
                </Box>
              }
            />
          </CardContent>
        </Card>

        <Divider sx={{ my: 2, borderColor: '#40444b' }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Sunucu oluşturarak Nexus'un <strong>Kullanım Koşulları</strong> ve <strong>Topluluk Kuralları</strong>'nı kabul etmiş olursunuz.
          <br />
          <br />
          • Spam, nefret söylemi ve zararlı içerik paylaşımı yasaktır
          <br />
          • Telif hakkı ihlali yapan içerikler kaldırılır
          <br />
          • Güvenlik açıklarını kötüye kullanmak yasaktır
          <br />
          • Tüm üyeler saygılı davranışlar sergilemelidir
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #40444b' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          İptal
        </Button>
        <Button
          onClick={handleCreateServer}
          disabled={loading || !serverName.trim()}
          variant="contained"
          sx={{
            backgroundColor: '#5865f2',
            '&:hover': {
              backgroundColor: '#4752c4',
            },
            '&:disabled': {
              backgroundColor: '#40444b',
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Oluşturuluyor...
            </>
          ) : (
            'Sunucu Oluştur'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 