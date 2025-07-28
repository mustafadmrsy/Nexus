import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
  Alert,
  InputAdornment,
  IconButton,
  Grid,
  Card,
  CardContent,
  styled,
  keyframes
} from '@mui/material';
import { Visibility, VisibilityOff, Chat, VolumeUp, SportsEsports } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../services/authService';
import { useThemeContext } from '../contexts/ThemeContext';
import { EmailVerificationDialog } from '../components/EmailVerificationDialog';
import { NexusLogo } from '../components/NexusLogo';

// Animasyonlar
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(88, 101, 242, 0); }
  100% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0); }
`;

// Styled Components
const StyledContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: theme.palette.mode === 'dark' 
    ? 'linear-gradient(-45deg, #23272a, #2f3136, #36393f, #23272a)'
    : 'linear-gradient(-45deg, #f5f5f5, #ffffff, #f0f0f0, #ffffff)',
  backgroundSize: '400% 400%',
  animation: `${gradientShift} 8s ease infinite`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.palette.mode === 'dark'
      ? 'radial-gradient(circle at 20% 80%, rgba(88, 101, 242, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(114, 137, 218, 0.1) 0%, transparent 50%)'
      : 'radial-gradient(circle at 20% 80%, rgba(88, 101, 242, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(114, 137, 218, 0.05) 0%, transparent 50%)',
    pointerEvents: 'none',
  }
}));

const GlassCard = styled(Card)(({ theme }) => ({
  background: theme.palette.mode === 'dark' 
    ? 'rgba(47, 49, 54, 0.3)'
    : 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(20px)',
  border: theme.palette.mode === 'dark' 
    ? '1px solid rgba(255, 255, 255, 0.1)'
    : '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '20px',
  boxShadow: theme.palette.mode === 'dark' 
    ? '0 25px 45px rgba(0, 0, 0, 0.3)'
    : '0 25px 45px rgba(0, 0, 0, 0.1)',
  animation: `${float} 3s ease-in-out infinite`,
  color: theme.palette.text.primary,
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 30px 60px rgba(0, 0, 0, 0.4)'
      : '0 30px 60px rgba(0, 0, 0, 0.2)',
  },
  transition: 'all 0.3s ease'
}));

const LoginCard = styled(Paper)(({ theme }) => ({
  background: theme.palette.mode === 'dark' 
    ? 'rgba(47, 49, 54, 0.4)'
    : 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(25px)',
  border: theme.palette.mode === 'dark' 
    ? '1px solid rgba(255, 255, 255, 0.15)'
    : '1px solid rgba(0, 0, 0, 0.15)',
  borderRadius: '24px',
  padding: '40px',
  boxShadow: theme.palette.mode === 'dark' 
    ? '0 30px 60px rgba(0, 0, 0, 0.4)'
    : '0 30px 60px rgba(0, 0, 0, 0.2)',
  color: theme.palette.text.primary,
  minWidth: '400px',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(45deg, rgba(88, 101, 242, 0.05), rgba(114, 137, 218, 0.05))',
    pointerEvents: 'none',
  }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(47, 49, 54, 0.6)'
      : 'rgba(255, 255, 255, 0.8)',
    borderRadius: '8px',
    color: theme.palette.text.primary,
    '& fieldset': {
      borderColor: theme.palette.mode === 'dark' 
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.2)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(88, 101, 242, 0.8)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#5865f2',
    },
    '& input': {
      color: theme.palette.text.primary,
      '&::placeholder': {
        color: theme.palette.text.secondary,
        opacity: 1,
      }
    }
  },
  '& .MuiInputLabel-root': {
    color: theme.palette.text.secondary,
    '&.Mui-focused': {
      color: '#5865f2',
    }
  }
}));

const PulseButton = styled(Button)({
  background: 'linear-gradient(45deg, #5865f2, #7289da)',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 24px',
  fontSize: '16px',
  fontWeight: 600,
  textTransform: 'none',
  animation: `${pulse} 2s infinite`,
  '&:hover': {
    background: 'linear-gradient(45deg, #4752c4, #5b6ecd)',
    transform: 'translateY(-2px)',
  },
  transition: 'all 0.3s ease'
});

const FeatureCard = styled(Card)(({ theme }) => ({
  background: theme.palette.mode === 'dark' 
    ? 'rgba(47, 49, 54, 0.25)'
    : 'rgba(255, 255, 255, 0.5)',
  backdropFilter: 'blur(15px)',
  border: theme.palette.mode === 'dark' 
    ? '1px solid rgba(255, 255, 255, 0.1)'
    : '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '16px',
  padding: '24px',
  color: theme.palette.text.primary,
  height: '100%',
  animation: `${float} 4s ease-in-out infinite`,
  '&:hover': {
    transform: 'translateY(-5px)',
    border: '1px solid rgba(88, 101, 242, 0.3)',
  },
  transition: 'all 0.3s ease'
}));

const LoginPage: React.FC = () => {
  const { refreshUserProfile } = useAuth();
  const { isDarkMode } = useThemeContext();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        const result = await loginUser(email, password);
        if (result.success) {
          await refreshUserProfile();
          navigate('/');
        } else {
          setError(result.error || 'Giriş yapılamadı');
        }
      } else {
        if (password !== confirmPassword) {
          setError('Şifreler eşleşmiyor');
          return;
        }
        const result = await registerUser(email, password, displayName);
        if (result.success) {
          setSuccessMessage('Kayıt başarılı! E-posta doğrulama linki gönderildi.');
          setShowEmailVerification(true);
        } else {
          setError(result.error || 'Kayıt oluşturulamadı');
        }
      }
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerified = async () => {
    setShowEmailVerification(false);
    setSuccessMessage('Email doğrulaması başarılı! Giriş yapılıyor...');
    
    // Email doğrulandıktan sonra otomatik giriş yap
    try {
      const result = await loginUser(email, password);
      if (result.success) {
        await refreshUserProfile();
        navigate('/');
      } else {
        setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
      }
    } catch (error: any) {
      setError('Giriş yapılamadı: ' + error.message);
    }
  };

  const handleCloseEmailVerification = () => {
    setShowEmailVerification(false);
    setIsLogin(true); // Giriş formuna geç
  };

  const features = [
    {
      icon: <Chat sx={{ fontSize: 40, color: '#5865f2' }} />,
      title: 'Anlık Mesajlaşma',
      description: 'Arkadaşlarınızla gerçek zamanlı sohbet edin'
    },
    {
      icon: <VolumeUp sx={{ fontSize: 40, color: '#5865f2' }} />,
      title: 'Sesli Sohbet',
      description: 'Kristal netliğinde ses kalitesi'
    },
    {
      icon: <SportsEsports sx={{ fontSize: 40, color: '#5865f2' }} />,
      title: 'Oyun Odaları',
      description: 'Oyunculara özel kanallar oluşturun'
    }
  ];

  return (
    <StyledContainer>
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          {/* Sol taraf - Özellikler */}
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <NexusLogo size="large" />
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'text.secondary', 
                  mb: 4,
                  fontWeight: 300
                }}
              >
                Arkadaşlarınızla bağlantı kurun, oyunlar oynayın ve birlikte vakit geçirin
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {features.map((feature, index) => (
                <Grid item xs={12} key={index}>
                  <FeatureCard 
                    sx={{ 
                      animationDelay: `${index * 0.5}s`
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {feature.icon}
                      <Box>
                        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, mb: 1 }}>
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {feature.description}
                        </Typography>
                      </Box>
                    </CardContent>
                  </FeatureCard>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Sağ taraf - Login Form */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <LoginCard elevation={0}>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Typography 
                    variant="h4" 
                    component="h2" 
                    sx={{ 
                      fontWeight: 700, 
                      color: 'text.primary',
                      mb: 1,
                      textAlign: 'center'
                    }}
                  >
                    {isLogin ? 'Tekrar Hoş Geldin!' : 'Hesap Oluştur'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary', 
                      mb: 4,
                      textAlign: 'center'
                    }}
                  >
                    {isLogin ? 'Hesabına giriş yaparak devam et' : 'Nexus topluluğuna katılın'}
                  </Typography>

                  {error && (
                    <Alert 
                      severity="error" 
                      sx={{ 
                        mb: 3,
                        backgroundColor: 'rgba(240, 71, 71, 0.1)',
                        color: '#f04747',
                        '& .MuiAlert-icon': {
                          color: '#f04747'
                        }
                      }}
                    >
                      {error}
                    </Alert>
                  )}

                  {successMessage && (
                    <Alert 
                      severity="success" 
                      sx={{ 
                        mb: 3,
                        backgroundColor: 'rgba(67, 181, 129, 0.1)',
                        color: '#43b581',
                        '& .MuiAlert-icon': {
                          color: '#43b581'
                        }
                      }}
                    >
                      {successMessage}
                    </Alert>
                  )}

                  <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                    {!isLogin && (
                      <StyledTextField
                        fullWidth
                        label="Görünen Ad"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        margin="normal"
                        required
                        autoComplete="name"
                      />
                    )}
                    
                    <StyledTextField
                      fullWidth
                      label="E-posta"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      margin="normal"
                      required
                      autoComplete="email"
                    />
                    
                    <StyledTextField
                      fullWidth
                      label="Şifre"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      margin="normal"
                      required
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              sx={{ color: '#b9bbbe' }}
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    {!isLogin && (
                      <StyledTextField
                        fullWidth
                        label="Şifre Tekrar"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        margin="normal"
                        required
                        autoComplete="new-password"
                      />
                    )}

                    <PulseButton
                      type="submit"
                      fullWidth
                      disabled={loading}
                      sx={{ mt: 3, mb: 2 }}
                    >
                      {loading ? 'Yükleniyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')}
                    </PulseButton>

                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {isLogin ? 'Hesabınız yok mu?' : 'Zaten hesabınız var mı?'}
                      </Typography>
                      <Button
                        onClick={() => setIsLogin(!isLogin)}
                        sx={{ 
                          color: 'primary.main',
                          textTransform: 'none',
                          fontWeight: 500,
                          '&:hover': {
                            backgroundColor: 'rgba(88, 101, 242, 0.1)'
                          }
                        }}
                      >
                        {isLogin ? 'Kayıt ol' : 'Giriş yap'}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </LoginCard>
            </Box>
          </Grid>
        </Grid>
      </Container>
      
      {/* Email Doğrulama Dialog */}
      <EmailVerificationDialog
        open={showEmailVerification}
        onClose={handleCloseEmailVerification}
        onVerified={handleEmailVerified}
        userEmail={email}
      />
    </StyledContainer>
  );
};

export default LoginPage; 