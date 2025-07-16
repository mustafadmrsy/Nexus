import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  Notifications,
  Security,
  Language,
  Palette,
  VolumeUp,
  Mic,
  Videocam,
  Storage,
  Warning,
  BugReport,
  ExpandMore,
} from '@mui/icons-material';
import { useThemeContext } from '../contexts/ThemeContext';
import { webrtcService } from '../services/webrtcService';

const SettingsPage: React.FC = () => {
  const { isDarkMode, toggleTheme } = useThemeContext();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState('tr');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const handleDeleteAccount = () => {
    setDeleteAccountDialog(true);
  };

  const confirmDeleteAccount = () => {
    // TODO: Implement account deletion logic
    setDeleteAccountDialog(false);
  };

  const runScreenShareDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const diagnostics = await webrtcService.runScreenShareDiagnostics();
      setDiagnosticsData(diagnostics);
      console.log('Screen share diagnostics:', diagnostics);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDiagnosticsData({
        error: error instanceof Error ? error.message : 'Diagnostic test failed'
      });
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const copyDiagnosticsToClipboard = () => {
    if (diagnosticsData) {
      navigator.clipboard.writeText(JSON.stringify(diagnosticsData, null, 2));
      alert('Diagnostic bilgileri panoya kopyalandı');
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
        Ayarlar
      </Typography>

      {/* Görünüm Ayarları */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Palette sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Görünüm
            </Typography>
          </Box>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Koyu Tema"
                secondary="Uygulamanın görünümünü koyu tema ile değiştirin"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={isDarkMode}
                  onChange={toggleTheme}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Dil"
                secondary="Uygulama dilini seçin"
              />
              <ListItemSecondaryAction>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="tr">Türkçe</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Bildirim Ayarları */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Notifications sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Bildirimler
            </Typography>
          </Box>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Masaüstü Bildirimleri"
                secondary="Yeni mesajlar için masaüstü bildirimleri alın"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Bildirim Sesleri"
                secondary="Yeni mesajlar için ses bildirimleri"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Ses ve Video Ayarları */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <VolumeUp sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Ses & Video
            </Typography>
          </Box>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Mikrofon"
                secondary="Ses sohbetleri için mikrofon erişimi"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={microphoneEnabled}
                  onChange={(e) => setMicrophoneEnabled(e.target.checked)}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Kamera"
                secondary="Video sohbetleri için kamera erişimi"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={cameraEnabled}
                  onChange={(e) => setCameraEnabled(e.target.checked)}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Gizlilik ve Güvenlik */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Security sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Gizlilik & Güvenlik
            </Typography>
          </Box>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Arkadaş İstekleri"
                secondary="Arkadaş isteklerini kabul etme ayarları"
              />
              <ListItemSecondaryAction>
                <Select
                  value="everyone"
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="everyone">Herkesten</MenuItem>
                  <MenuItem value="friends">Arkadaşlardan</MenuItem>
                  <MenuItem value="none">Hiçkimse</MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Çevrimiçi Durum"
                secondary="Çevrimiçi durumunuzu diğer kullanıcılara gösterin"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={true}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Depolama */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Storage sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Depolama
            </Typography>
          </Box>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Önbellek Temizle"
                secondary="Geçici dosyaları ve önbellek verilerini temizle"
              />
              <ListItemSecondaryAction>
                <Button variant="outlined" size="small">
                  Temizle
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Kullanılan Alan"
                secondary="Yaklaşık 50 MB"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Debug ve Diagnostics */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <BugReport sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Debug & Diagnostics
            </Typography>
          </Box>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Ekran Paylaşımı Diagnostics"
                secondary="Ekran paylaşımı sorunlarını tespit etmek için kapsamlı test"
              />
              <ListItemSecondaryAction>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={runScreenShareDiagnostics}
                  disabled={runningDiagnostics}
                >
                  {runningDiagnostics ? 'Test Çalışıyor...' : 'Test Çalıştır'}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>

          {/* Diagnostics Results */}
          {diagnosticsData && (
            <Box sx={{ mt: 2 }}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Test Sonuçları
                    {diagnosticsData.error && (
                      <Chip label="Hata" color="error" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={copyDiagnosticsToClipboard}
                    >
                      Panoya Kopyala
                    </Button>
                  </Box>
                  
                  {diagnosticsData.error ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {diagnosticsData.error}
                    </Alert>
                  ) : (
                    <Box>
                      {/* Basic Info */}
                      <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                        Tarayıcı Bilgileri:
                      </Typography>
                      <Box sx={{ mb: 2, pl: 2 }}>
                        <Typography variant="body2">
                          <strong>Tarayıcı:</strong> {diagnosticsData.basicInfo?.browser?.userAgent}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Protokol:</strong> {diagnosticsData.basicInfo?.location?.protocol}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Güvenli Context:</strong> {diagnosticsData.basicInfo?.security?.isSecureContext ? 'Evet' : 'Hayır'}
                        </Typography>
                      </Box>

                      {/* API Support */}
                      <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                        API Desteği:
                      </Typography>
                      <Box sx={{ mb: 2, pl: 2 }}>
                        <Typography variant="body2">
                          <strong>MediaDevices:</strong> {diagnosticsData.basicInfo?.apiSupport?.hasMediaDevices ? '✅' : '❌'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>getDisplayMedia:</strong> {diagnosticsData.basicInfo?.apiSupport?.hasGetDisplayMedia ? '✅' : '❌'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>WebRTC:</strong> {diagnosticsData.basicInfo?.apiSupport?.hasWebRTC ? '✅' : '❌'}
                        </Typography>
                      </Box>

                      {/* Test Results */}
                      <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                        Test Sonuçları:
                      </Typography>
                      <Box sx={{ pl: 2 }}>
                        <Typography variant="body2">
                          <strong>Destek Kontrolü:</strong> {diagnosticsData.tests?.supportCheck?.supported ? '✅' : '❌'}
                          {!diagnosticsData.tests?.supportCheck?.supported && (
                            <span> - {diagnosticsData.tests?.supportCheck?.reason}</span>
                          )}
                        </Typography>
                        <Typography variant="body2">
                          <strong>İzin Kontrolü:</strong> {diagnosticsData.tests?.permissionCheck?.granted ? '✅' : '❌'}
                          {!diagnosticsData.tests?.permissionCheck?.granted && (
                            <span> - {diagnosticsData.tests?.permissionCheck?.reason}</span>
                          )}
                        </Typography>
                        <Typography variant="body2">
                          <strong>getDisplayMedia Test:</strong> {diagnosticsData.tests?.getDisplayMediaTest?.success ? '✅' : '❌'}
                          {!diagnosticsData.tests?.getDisplayMediaTest?.success && (
                            <span> - {diagnosticsData.tests?.getDisplayMediaTest?.error}</span>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tehlikeli Bölge */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: isDarkMode ? '#2f3136' : '#ffffff',
        borderRadius: 2,
        border: '1px solid #ff6b6b',
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Warning sx={{ mr: 1, color: '#ff6b6b' }} />
            <Typography variant="h6" fontWeight="bold" color="#ff6b6b">
              Tehlikeli Bölge
            </Typography>
          </Box>
          
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bu eylemler geri alınamaz! Dikkatli olun.
          </Alert>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Hesabı Sil"
                secondary="Hesabınızı ve tüm verilerinizi kalıcı olarak silin"
              />
              <ListItemSecondaryAction>
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  onClick={handleDeleteAccount}
                >
                  Hesabı Sil
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Hesap Silme Dialog */}
      <Dialog
        open={deleteAccountDialog}
        onClose={() => setDeleteAccountDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Hesabı Sil</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Bu eylem geri alınamaz! Hesabınız ve tüm verileriniz kalıcı olarak silinecek.
          </Alert>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Hesabınızı silmek istediğinizi onaylamak için aşağıya "HESABI SIL" yazın:
          </Typography>
          <TextField
            fullWidth
            placeholder="HESABI SIL"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAccountDialog(false)}>
            İptal
          </Button>
          <Button 
            onClick={confirmDeleteAccount}
            color="error" 
            variant="contained"
          >
            Hesabı Sil
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage; 