import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { sendEmailVerificationCode, checkEmailVerification } from '../services/authService';

interface EmailVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userEmail: string;
}

export const EmailVerificationDialog: React.FC<EmailVerificationDialogProps> = ({
  open,
  onClose,
  onVerified,
  userEmail
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);

  const handleSendVerification = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const result = await sendEmailVerificationCode();
      if (result.success) {
        setMessage({ type: 'success', text: result.message! });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    setMessage(null);
    
    try {
      const result = await checkEmailVerification();
      if (result.success && result.verified) {
        setMessage({ type: 'success', text: 'Email doğrulaması başarılı!' });
        setTimeout(() => {
          onVerified();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: 'Email henüz doğrulanmamış. Lütfen e-postanızı kontrol edin.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setCheckingVerification(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" component="div">
          Email Doğrulaması Gerekli
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" paragraph>
            Nexus'a giriş yapabilmek için email adresinizi doğrulamanız gerekiyor.
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            Doğrulama linki: <strong>{userEmail}</strong>
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            E-postanızı kontrol edin ve doğrulama linkine tıklayın. Spam klasörünü de kontrol etmeyi unutmayın.
          </Typography>
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'space-between' }}>
          <Button onClick={onClose} variant="outlined">
            İptal
          </Button>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={handleSendVerification}
              disabled={loading}
              variant="outlined"
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Gönderiliyor...' : 'Tekrar Gönder'}
            </Button>
            
            <Button
              onClick={handleCheckVerification}
              disabled={checkingVerification}
              variant="contained"
              startIcon={checkingVerification ? <CircularProgress size={20} /> : null}
            >
              {checkingVerification ? 'Kontrol Ediliyor...' : 'Doğrulamayı Kontrol Et'}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}; 