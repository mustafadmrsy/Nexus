import React, { useState, useEffect } from 'react';
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
  InputAdornment,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Tab,
  Tabs
} from '@mui/material';
import {
  PersonAdd,
  Search,
  Close,
  Send,
  Check,
  PersonRemove,
  Block
} from '@mui/icons-material';
import { 
  sendFriendRequest, 
  getIncomingFriendRequests, 
  getOutgoingFriendRequests, 
  acceptFriendRequest, 
  declineFriendRequest 
} from '../services/userService';
import { useAuth } from '../contexts/AuthContext';

interface AddFriendDialogProps {
  open: boolean;
  onClose: () => void;
  onFriendAdded?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`friend-tabpanel-${index}`}
      aria-labelledby={`friend-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

export const AddFriendDialog: React.FC<AddFriendDialogProps> = ({
  open,
  onClose,
  onFriendAdded
}) => {
  const { userProfile } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setMessage(null);
  };

  // Verileri yükle
  const loadRequests = async () => {
    if (!userProfile?.uid) return;
    
    setRequestsLoading(true);
    try {
      const [incoming, outgoing] = await Promise.all([
        getIncomingFriendRequests(userProfile.uid),
        getOutgoingFriendRequests(userProfile.uid)
      ]);
      
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (open && userProfile?.uid) {
      loadRequests();
    }
  }, [open, userProfile?.uid]);

  const handleSendRequest = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Lütfen bir e-posta adresi girin' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: 'error', text: 'Geçerli bir e-posta adresi girin' });
      return;
    }

    if (!userProfile?.uid || !userProfile?.displayName) {
      setMessage({ type: 'error', text: 'Kullanıcı bilgileri yüklenemedi' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await sendFriendRequest(userProfile.uid, email, userProfile.displayName);
      if (result.success) {
        setMessage({ type: 'success', text: 'Arkadaş isteği gönderildi!' });
        setEmail('');
        loadRequests(); // Listeyi yenile
        onFriendAdded?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Bilinmeyen hata' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const result = await acceptFriendRequest(requestId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Arkadaş isteği kabul edildi!' });
        loadRequests(); // Listeyi yenile
        onFriendAdded?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Hata oluştu' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const result = await declineFriendRequest(requestId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Arkadaş isteği reddedildi' });
        loadRequests(); // Listeyi yenile
      } else {
        setMessage({ type: 'error', text: result.error || 'Hata oluştu' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    }
  };

  const handleClose = () => {
    setEmail('');
    setMessage(null);
    setTabValue(0);
    onClose();
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading) {
      handleSendRequest();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#2f3136',
          borderRadius: 3,
          minHeight: '600px'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: 'white', 
        fontSize: '1.5rem', 
        fontWeight: 'bold',
        borderBottom: '1px solid #40444b'
      }}>
        Arkadaş Ekle
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="friend tabs"
          sx={{
            '& .MuiTab-root': {
              color: '#b9bbbe',
              textTransform: 'none',
              fontWeight: 'medium',
            },
            '& .Mui-selected': {
              color: '#00b4d8 !important',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#00b4d8',
            },
          }}
        >
          <Tab label="Arkadaş Ekle" />
          <Tab label={`Gelen İstekler (${incomingRequests.length})`} />
          <Tab label={`Gönderilen İstekler (${outgoingRequests.length})`} />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, backgroundColor: '#36393f' }}>
        {/* Tab 1: Arkadaş Ekle */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
              E-posta ile arkadaş ekle
            </Typography>
            <Typography variant="body2" sx={{ color: '#b9bbbe', mb: 2 }}>
              Arkadaşının e-posta adresini girerek arkadaş isteği gönderebilirsin.
            </Typography>
            
            <TextField
              fullWidth
              label="E-posta adresi"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#b9bbbe' }} />
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: '#40444b',
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#40444b',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00b4d8',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00b4d8',
                  },
                }
              }}
              InputLabelProps={{
                sx: { color: '#b9bbbe' }
              }}
            />

            <Button
              variant="contained"
              onClick={handleSendRequest}
              disabled={loading || !email.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <Send />}
              sx={{
                backgroundColor: '#5865f2',
                color: 'white',
                textTransform: 'none',
                borderRadius: 2,
                py: 1.5,
                '&:hover': {
                  backgroundColor: '#4752c4',
                },
                '&:disabled': {
                  backgroundColor: '#40444b',
                  color: '#72767d',
                }
              }}
            >
              {loading ? 'Gönderiliyor...' : 'Arkadaş İsteği Gönder'}
            </Button>
          </Box>
        </TabPanel>

        {/* Tab 2: Gelen İstekler */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            Gelen Arkadaş İstekleri
          </Typography>
          
          {requestsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : incomingRequests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" sx={{ color: '#b9bbbe' }}>
                Henüz gelen arkadaş isteği yok
              </Typography>
            </Box>
          ) : (
            <List>
              {incomingRequests.map((request) => (
                <ListItem 
                  key={request.id}
                  sx={{ 
                    backgroundColor: '#40444b', 
                    borderRadius: 2, 
                    mb: 1,
                    border: '1px solid #202225'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#5865f2' }}>
                      {request.fromUserName?.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Typography sx={{ color: 'white', fontWeight: 'bold' }}>
                        {request.fromUserName}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ color: '#b9bbbe', fontSize: '0.9rem' }}>
                        {request.fromUserEmail}
                      </Typography>
                    }
                  />
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      onClick={() => handleAcceptRequest(request.id)}
                      sx={{ 
                        backgroundColor: '#57f287',
                        color: 'white',
                        '&:hover': { backgroundColor: '#3ba55c' }
                      }}
                      size="small"
                    >
                      <Check />
                    </IconButton>
                    
                    <IconButton
                      onClick={() => handleDeclineRequest(request.id)}
                      sx={{ 
                        backgroundColor: '#ed4245',
                        color: 'white',
                        '&:hover': { backgroundColor: '#c23616' }
                      }}
                      size="small"
                    >
                      <Close />
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Tab 3: Gönderilen İstekler */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            Gönderilen Arkadaş İstekleri
          </Typography>
          
          {requestsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : outgoingRequests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" sx={{ color: '#b9bbbe' }}>
                Henüz gönderilen arkadaş isteği yok
              </Typography>
            </Box>
          ) : (
            <List>
              {outgoingRequests.map((request) => (
                <ListItem 
                  key={request.id}
                  sx={{ 
                    backgroundColor: '#40444b', 
                    borderRadius: 2, 
                    mb: 1,
                    border: '1px solid #202225'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#5865f2' }}>
                      {request.toUserName?.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Typography sx={{ color: 'white', fontWeight: 'bold' }}>
                        {request.toUserName}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ color: '#b9bbbe', fontSize: '0.9rem' }}>
                        {request.toUserEmail}
                      </Typography>
                    }
                  />
                  
                  <Chip
                    label="Bekliyor"
                    size="small"
                    sx={{
                      backgroundColor: '#faa61a',
                      color: 'white',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {message && (
          <Box sx={{ p: 2 }}>
            <Alert severity={message.type} sx={{ borderRadius: 2 }}>
              {message.text}
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        backgroundColor: '#2f3136', 
        borderTop: '1px solid #40444b',
        p: 2
      }}>
        <Button 
          onClick={handleClose}
          sx={{ 
            color: '#b9bbbe',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: '#40444b'
            }
          }}
        >
          Kapat
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 