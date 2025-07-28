import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const LogoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  cursor: 'pointer',
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

const LogoIcon = styled(Box)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.9)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  
  '&::after': {
    content: '""',
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.6)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.5rem',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '0.5px',
}));

interface NexusLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  onClick?: () => void;
}

export const NexusLogo: React.FC<NexusLogoProps> = ({ 
  size = 'medium', 
  showText = true, 
  onClick 
}) => {
  const getSize = () => {
    switch (size) {
      case 'small': return { icon: 24, text: '1.2rem' };
      case 'large': return { icon: 40, text: '2rem' };
      default: return { icon: 32, text: '1.5rem' };
    }
  };

  const { icon, text } = getSize();

  return (
    <LogoContainer onClick={onClick}>
      <LogoIcon 
        sx={{ 
          width: icon, 
          height: icon,
          '&::before': { width: icon * 0.5, height: icon * 0.5 },
          '&::after': { width: icon * 0.75, height: icon * 0.75 }
        }}
      />
      {showText && (
        <LogoText sx={{ fontSize: text }}>
          NEXUS
        </LogoText>
      )}
    </LogoContainer>
  );
}; 