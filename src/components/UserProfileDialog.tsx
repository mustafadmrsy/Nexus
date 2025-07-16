import React from 'react';
import { Dialog, DialogTitle, DialogContent, Avatar, Typography, Box, Chip, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface UserProfileDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    displayName: string;
    photoURL?: string;
    status?: string;
    bio?: string;
    uid?: string;
  };
  roles?: string[];
  serverRoles?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

const statusColors: Record<string, string> = {
  online: '#43b581',
  idle: '#faa61a',
  offline: '#747f8d',
};

export const UserProfileDialog: React.FC<UserProfileDialogProps> = ({ open, onClose, user, roles, serverRoles = [] }) => {
  // Rol rengini al
  const getRoleColor = (roleId: string) => {
    // Önce özel rolleri kontrol et
    const customRole = serverRoles.find(r => r.id === roleId);
    if (customRole) {
      return customRole.color;
    }
    
    // Sistem rolleri için varsayılan renkler
    switch (roleId) {
      case 'owner': return '#f04747';
      case 'admin': return '#ff9500';
      case 'moderator': return '#5865f2';
      default: return '#99aab5';
    }
  };

  // Rol adını al
  const getRoleName = (roleId: string) => {
    // Önce özel rolleri kontrol et
    const customRole = serverRoles.find(r => r.id === roleId);
    if (customRole) {
      return customRole.name;
    }
    
    // Sistem rolleri için varsayılan isimler
    switch (roleId) {
      case 'owner': return 'Sahip';
      case 'admin': return 'Admin';
      case 'moderator': return 'Moderatör';
      case 'member': return 'Üye';
      default: return roleId;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: '#2f3136', borderRadius: 3 } }}>
      <DialogTitle sx={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar src={user.photoURL} sx={{ width: 64, height: 64, mr: 2 }}>
          {user.displayName?.charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h6" color="white">{user.displayName}</Typography>
          {user.status && (
            <Chip
              label={user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              size="small"
              sx={{ backgroundColor: statusColors[user.status] || '#43b581', color: 'white', mt: 0.5 }}
            />
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary', ml: 'auto' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ color: 'white' }}>
        {user.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {user.bio}
          </Typography>
        )}
        {roles && roles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="#7289da" sx={{ mb: 1 }}>Roller</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {roles.filter(roleId => roleId !== 'member').map((roleId) => (
                <Chip 
                  key={roleId} 
                  label={getRoleName(roleId)} 
                  size="small" 
                  sx={{ 
                    backgroundColor: getRoleColor(roleId),
                    color: 'white' 
                  }} 
                />
              ))}
            </Box>
          </Box>
        )}
        {user.uid && (
          <Typography variant="caption" color="text.secondary">ID: {user.uid}</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}; 