import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Settings,
  Logout,
  Person,
  DarkMode,
  LightMode,
  Notifications,
  Help,
  KeyboardArrowDown,
  KeyboardArrowRight,
  Circle,
  DoNotDisturb,
  AccessTime,
  Visibility
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { updateUserStatus } from '../services/authService';

interface ProfileDropdownProps {
  onLogout: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ onLogout }) => {
  const { userProfile, refreshUserProfile } = useAuth();
  const { isDarkMode, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [statusMenuEl, setStatusMenuEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const statusMenuOpen = Boolean(statusMenuEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setStatusMenuEl(null);
  };

  const handleStatusMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setStatusMenuEl(event.currentTarget);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuEl(null);
  };

  const handleStatusChange = async (newStatus: 'online' | 'idle' | 'dnd' | 'offline') => {
    try {
      console.log('🔄 Status değiştiriliyor:', newStatus);
      const result = await updateUserStatus(newStatus);
      if (result.success) {
        console.log('✅ Status başarıyla güncellendi:', newStatus);
        await refreshUserProfile();
        handleClose();
      } else {
        console.error('❌ Status güncelleme başarısız:', result.error);
      }
    } catch (error) {
      console.error('Status güncelleme hatası:', error);
    }
  };

  const handleLogout = () => {
    handleClose();
    onLogout();
  };

  const handleProfileClick = () => {
    handleClose();
    navigate('/profile');
  };

  const handleSettingsClick = () => {
    handleClose();
    navigate('/settings');
  };

  const handleNotificationsClick = () => {
    handleClose();
    navigate('/notifications');
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#43b581';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Çevrimiçi';
      case 'idle': return 'Boşta';
      case 'dnd': return 'Rahatsız Etmeyin';
      case 'offline': return 'Görünmez';
      default: return 'Çevrimiçi';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Circle sx={{ fontSize: 16, color: '#43b581' }} />;
      case 'idle': return <AccessTime sx={{ fontSize: 16, color: '#faa61a' }} />;
      case 'dnd': return <DoNotDisturb sx={{ fontSize: 16, color: '#f04747' }} />;
      case 'offline': return <Visibility sx={{ fontSize: 16, color: '#747f8d' }} />;
      default: return <Circle sx={{ fontSize: 16, color: '#43b581' }} />;
    }
  };

  const statusOptions = [
    { value: 'online', label: 'Çevrimiçi', icon: <Circle sx={{ fontSize: 16, color: '#43b581' }} /> },
    { value: 'idle', label: 'Boşta', icon: <AccessTime sx={{ fontSize: 16, color: '#faa61a' }} /> },
    { value: 'dnd', label: 'Rahatsız Etmeyin', icon: <DoNotDisturb sx={{ fontSize: 16, color: '#f04747' }} /> },
    { value: 'offline', label: 'Görünmez', icon: <Visibility sx={{ fontSize: 16, color: '#747f8d' }} /> },
  ];

  return (
    <Box>
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: getStatusColor(userProfile?.status || 'online'),
                border: '2px solid #2f3136',
              }}
            />
          }
        >
          <Avatar 
            src={userProfile?.photoURL} 
            sx={{ width: 40, height: 40, mr: 2 }}
          >
            {userProfile?.displayName?.charAt(0).toUpperCase()}
          </Avatar>
        </Badge>
        
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight="bold" noWrap>
            {userProfile?.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            #{userProfile?.uid?.slice(-4)}
          </Typography>
        </Box>
        
        <KeyboardArrowDown 
          sx={{ 
            fontSize: 20, 
            color: 'text.secondary',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }} 
        />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: isDarkMode ? '#18191c' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#292b2f' : '#e0e0e0'}`,
            borderRadius: 2,
            minWidth: 220,
            mt: 1,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Profil Bilgisi Header */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${isDarkMode ? '#292b2f' : '#e0e0e0'}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Avatar 
              src={userProfile?.photoURL}
              sx={{ width: 32, height: 32, mr: 2 }}
            >
              {userProfile?.displayName?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight="bold">
                {userProfile?.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {userProfile?.email}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={getStatusText(userProfile?.status || 'online')}
              size="small"
              sx={{
                backgroundColor: getStatusColor(userProfile?.status || 'online'),
                color: 'white',
                fontSize: '0.7rem',
                height: 20,
              }}
            />
          </Box>
        </Box>

        {/* Status Değiştirme Menü İtemi */}
        <MenuItem 
          onClick={handleStatusMenuClick}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            position: 'relative'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {getStatusIcon(userProfile?.status || 'online')}
            </ListItemIcon>
            <ListItemText primary={getStatusText(userProfile?.status || 'online')} />
          </Box>
          <KeyboardArrowRight sx={{ color: 'text.secondary' }} />
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Menü İtemleri */}
        <MenuItem onClick={handleProfileClick}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Profil Ayarları" />
        </MenuItem>
        
        <MenuItem onClick={handleSettingsClick}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Ayarlar" />
        </MenuItem>
        
        <MenuItem onClick={handleNotificationsClick}>
          <ListItemIcon>
            <Notifications fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Bildirimler" />
        </MenuItem>
        
        <MenuItem onClick={handleThemeToggle}>
          <ListItemIcon>
            {isDarkMode ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary="Koyu Tema" />
          <Switch
            checked={isDarkMode}
            onChange={handleThemeToggle}
            size="small"
            sx={{ ml: 1 }}
            onClick={(e) => e.stopPropagation()}
          />
        </MenuItem>
        
        <Divider sx={{ my: 1 }} />
        
        <MenuItem disabled>
          <ListItemIcon>
            <Help fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Yardım" />
          <Typography variant="caption" color="text.secondary">
            Yakında
          </Typography>
        </MenuItem>
        
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Çıkış Yap" />
        </MenuItem>
      </Menu>

      {/* Status Seçimi Alt Menü */}
      <Menu
        anchorEl={statusMenuEl}
        open={statusMenuOpen}
        onClose={handleStatusMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: isDarkMode ? '#18191c' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#292b2f' : '#e0e0e0'}`,
            borderRadius: 2,
            minWidth: 200,
            ml: 1,
          },
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1, display: 'block' }}>
            Durumunu Ayarla
          </Typography>
          {statusOptions.map((option) => (
            <MenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value as 'online' | 'idle' | 'dnd' | 'offline')}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                backgroundColor: userProfile?.status === option.value ? 'rgba(88, 101, 242, 0.1)' : 'transparent',
                '&:hover': {
                  backgroundColor: userProfile?.status === option.value ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {option.icon}
              </ListItemIcon>
              <ListItemText 
                primary={option.label}
                primaryTypographyProps={{
                  color: userProfile?.status === option.value ? 'primary.main' : 'text.primary',
                  fontWeight: userProfile?.status === option.value ? 'bold' : 'normal'
                }}
              />
            </MenuItem>
          ))}
        </Box>
      </Menu>
    </Box>
  );
}; 