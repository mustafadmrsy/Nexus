import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ExpandMore,
  DragIndicator,
  Palette,
  Security,
  People,
  Close,
  Save,
  Cancel,
  AdminPanelSettings,
  Gavel,
  VolumeUp,
  Message,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ChromePicker } from 'react-color';
import { useAuth } from '../contexts/AuthContext';
import { Role, ServerPermissions, Server, ServerMember } from '../types';
import {
  getServerRoles,
  createRole,
  updateRole,
  deleteRole,
  updateRolePositions,
  assignRoleToUser,
  removeRoleFromUser,
  subscribeToServerRoles,
  ROLE_COLORS,
  DEFAULT_PERMISSIONS,
  ADMIN_PERMISSIONS,
  MODERATOR_PERMISSIONS
} from '../services/roleService';

interface RoleManagementDialogProps {
  open: boolean;
  onClose: () => void;
  server: Server;
  members: ServerMember[];
  onRoleUpdated?: () => void;
}

interface RoleFormData {
  name: string;
  color: string;
  permissions: ServerPermissions;
  mentionable: boolean;
}

export const RoleManagementDialog: React.FC<RoleManagementDialogProps> = ({
  open,
  onClose,
  server,
  members,
  onRoleUpdated
}) => {
  const { userProfile } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({
    name: '',
    color: '#99aab5',
    permissions: { ...DEFAULT_PERMISSIONS },
    mentionable: true
  });

  useEffect(() => {
    if (open && server.id) {
      loadRoles();
    }
  }, [open, server.id]);

  useEffect(() => {
    if (open && server.id) {
      const unsubscribe = subscribeToServerRoles(server.id, (updatedRoles) => {
        setRoles(updatedRoles);
      });
      
      return () => unsubscribe();
    }
  }, [open, server.id]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const serverRoles = await getServerRoles(server.id);
      setRoles(serverRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!userProfile?.uid || !roleFormData.name.trim()) return;

    setLoading(true);
    try {
      const result = await createRole(
        server.id,
        roleFormData.name.trim(),
        roleFormData.color,
        roleFormData.permissions,
        userProfile.uid
      );

      if (result.success) {
        setMessage({ type: 'success', text: 'Rol başarıyla oluşturuldu!' });
        setCreateDialogOpen(false);
        setRoleFormData({
          name: '',
          color: '#99aab5',
          permissions: { ...DEFAULT_PERMISSIONS },
          mentionable: true
        });
        onRoleUpdated?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Rol oluşturulurken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol oluşturulurken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!userProfile?.uid || !editingRole) return;

    setLoading(true);
    try {
      const result = await updateRole(editingRole.id, {
        name: roleFormData.name.trim(),
        color: roleFormData.color,
        permissions: roleFormData.permissions,
        mentionable: roleFormData.mentionable
      }, userProfile.uid);

      if (result.success) {
        setMessage({ type: 'success', text: 'Rol başarıyla güncellendi!' });
        setEditingRole(null);
        setRoleFormData({
          name: '',
          color: '#99aab5',
          permissions: { ...DEFAULT_PERMISSIONS },
          mentionable: true
        });
        onRoleUpdated?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Rol güncellenirken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol güncellenirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!userProfile?.uid || !roleToDelete) return;

    setLoading(true);
    try {
      const result = await deleteRole(roleToDelete.id, userProfile.uid);

      if (result.success) {
        setMessage({ type: 'success', text: 'Rol başarıyla silindi!' });
        setDeleteDialogOpen(false);
        setRoleToDelete(null);
        onRoleUpdated?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Rol silinirken hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol silinirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination || !userProfile?.uid) return;

    const items = Array.from(roles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setRoles(items);

    // Pozisyonları güncelle
    const rolePositions = items.map((role, index) => ({
      roleId: role.id,
      position: items.length - index - 1
    }));

    try {
      await updateRolePositions(server.id, rolePositions, userProfile.uid);
    } catch (error) {
      console.error('Error updating role positions:', error);
      loadRoles(); // Hata durumunda yeniden yükle
    }
  };

  const startEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      color: role.color,
      permissions: { ...role.permissions },
      mentionable: role.mentionable
    });
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      color: '#99aab5',
      permissions: { ...DEFAULT_PERMISSIONS },
      mentionable: true
    });
  };

  const applyPermissionTemplate = (template: 'default' | 'moderator' | 'admin') => {
    let permissions: ServerPermissions;
    
    switch (template) {
      case 'moderator':
        permissions = { ...MODERATOR_PERMISSIONS };
        setMessage({ type: 'success', text: 'Moderatör şablonu uygulandı!' });
        break;
      case 'admin':
        permissions = { ...ADMIN_PERMISSIONS };
        setMessage({ type: 'success', text: 'Admin şablonu uygulandı!' });
        break;
      default:
        permissions = { ...DEFAULT_PERMISSIONS };
        setMessage({ type: 'success', text: 'Varsayılan şablon uygulandı!' });
    }
    
    setRoleFormData(prev => ({ ...prev, permissions }));
    
    // Mesajı 2 saniye sonra kaldır
    setTimeout(() => setMessage(null), 2000);
  };

  const togglePermission = (permission: keyof ServerPermissions) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission]
      }
    }));
  };

  const getRoleMemberCount = (roleId: string) => {
    return members.filter(member => member.roles.includes(roleId)).length;
  };

  const handlePermissionChange = async (permissionKey: keyof ServerPermissions, value: boolean) => {
    if (!selectedRole || !userProfile?.uid) return;

    try {
      const updatedPermissions = {
        ...selectedRole.permissions,
        [permissionKey]: value
      };

      // Rol güncelleme işlemi - veritabanına kaydet
      const result = await updateRole(selectedRole.id, {
        permissions: updatedPermissions
      }, userProfile.uid);

      if (result.success) {
        // Local state'i güncelle
        setSelectedRole({
          ...selectedRole,
          permissions: updatedPermissions
        });

        // Roller listesini güncelle
        setRoles(prev => prev.map(role => 
          role.id === selectedRole.id 
            ? { ...role, permissions: updatedPermissions }
            : role
        ));

        setMessage({
          type: 'success',
          text: 'İzin başarıyla güncellendi'
        });
        
        // Callback'i çağır ki diğer bileşenler güncellensin
        onRoleUpdated?.();
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'İzin güncellenirken hata oluştu'
        });
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      setMessage({
        type: 'error',
        text: 'İzin güncellenirken hata oluştu'
      });
    }
  };

  const getPermissionGroupIcon = (group: string) => {
    switch (group) {
      case 'general': return <SettingsIcon />;
      case 'members': return <People />;
      case 'messages': return <Message />;
      case 'voice': return <VolumeUp />;
      case 'advanced': return <AdminPanelSettings />;
      default: return <Security />;
    }
  };

  const permissionGroups = {
    general: {
      title: 'Genel İzinler',
      permissions: [
        { key: 'canManageServer', label: 'Sunucuyu Yönet', description: 'Sunucu ayarlarını değiştirebilir' },
        { key: 'canManageChannels', label: 'Kanalları Yönet', description: 'Kanal oluşturabilir, düzenleyebilir ve silebilir' },
        { key: 'canManageRoles', label: 'Rolleri Yönet', description: 'Rol oluşturabilir ve düzenleyebilir' },
        { key: 'canCreateInvites', label: 'Davet Oluştur', description: 'Sunucuya davet bağlantısı oluşturabilir' },
        { key: 'canChangeNickname', label: 'Takma Ad Değiştir', description: 'Kendi takma adını değiştirebilir' },
        { key: 'canManageNicknames', label: 'Takma Adları Yönet', description: 'Diğer üyelerin takma adlarını değiştirebilir' },
        { key: 'canViewAuditLog', label: 'Denetim Günlüğünü Görüntüle', description: 'Sunucu denetim günlüğünü görüntüleyebilir' },
        { key: 'canViewServerInsights', label: 'Sunucu İstatistikleri', description: 'Sunucu istatistiklerini görüntüleyebilir' },
      ]
    },
    members: {
      title: 'Üye Yönetimi',
      permissions: [
        { key: 'canKickMembers', label: 'Üyeleri At', description: 'Üyeleri sunucudan atabilir' },
        { key: 'canBanMembers', label: 'Üyeleri Yasakla', description: 'Üyeleri sunucudan yasaklayabilir' },
        { key: 'canTimeoutMembers', label: 'Üyeleri Sustur', description: 'Üyeleri geçici olarak susturabilir' },
      ]
    },
    messages: {
      title: 'Mesaj İzinleri',
      permissions: [
        { key: 'canSendMessages', label: 'Mesaj Gönder', description: 'Kanallarda mesaj gönderebilir' },
        { key: 'canSendTTSMessages', label: 'TTS Mesaj Gönder', description: 'Sesli mesaj gönderebilir' },
        { key: 'canManageMessages', label: 'Mesajları Yönet', description: 'Mesajları silebilir ve düzenleyebilir' },
        { key: 'canEmbedLinks', label: 'Bağlantı Yerleştir', description: 'Mesajlarda bağlantı yerleştirebilir' },
        { key: 'canAttachFiles', label: 'Dosya Ekle', description: 'Mesajlara dosya ekleyebilir' },
        { key: 'canReadMessageHistory', label: 'Mesaj Geçmişini Oku', description: 'Eski mesajları okuyabilir' },
        { key: 'canMentionEveryone', label: '@everyone Kullan', description: 'Herkesi etiketleyebilir' },
        { key: 'canUseExternalEmojis', label: 'Harici Emoji', description: 'Diğer sunuculardan emoji kullanabilir' },
        { key: 'canAddReactions', label: 'Tepki Ekle', description: 'Mesajlara tepki ekleyebilir' },
      ]
    },
    voice: {
      title: 'Sesli Kanal İzinleri',
      permissions: [
        { key: 'canConnect', label: 'Bağlan', description: 'Sesli kanallara bağlanabilir' },
        { key: 'canSpeak', label: 'Konuş', description: 'Sesli kanallarda konuşabilir' },
        { key: 'canVideo', label: 'Video', description: 'Kamera açabilir' },
        { key: 'canUseVoiceActivity', label: 'Ses Etkinliği', description: 'Ses etkinliği kullanabilir' },
        { key: 'canPrioritySpeak', label: 'Öncelikli Konuşma', description: 'Diğerlerinden daha yüksek sesle konuşabilir' },
        { key: 'canMuteMembers', label: 'Üyeleri Sustur', description: 'Diğer üyeleri susturabilir' },
        { key: 'canDeafenMembers', label: 'Üyeleri Sağırlaştır', description: 'Diğer üyeleri sağırlaştırabilir' },
        { key: 'canMoveMembers', label: 'Üyeleri Taşı', description: 'Üyeleri farklı kanallara taşıyabilir' },
        { key: 'canStream', label: 'Yayın Yap', description: 'Ekran paylaşımı yapabilir' },
      ]
    },
    advanced: {
      title: 'Gelişmiş İzinler',
      permissions: [
        { key: 'canManageWebhooks', label: 'Webhook Yönet', description: 'Webhook oluşturabilir ve yönetebilir' },
        { key: 'canManageEmojis', label: 'Emoji Yönet', description: 'Sunucu emojilerini yönetebilir' },
        { key: 'canManageThreads', label: 'Konu Yönet', description: 'Konuları yönetebilir' },
        { key: 'canCreatePublicThreads', label: 'Herkese Açık Konu Oluştur', description: 'Herkese açık konular oluşturabilir' },
        { key: 'canCreatePrivateThreads', label: 'Özel Konu Oluştur', description: 'Özel konular oluşturabilir' },
        { key: 'canUseApplicationCommands', label: 'Uygulama Komutları', description: 'Slash komutları kullanabilir' },
      ]
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        disableEnforceFocus
        PaperProps={{
          sx: {
            backgroundColor: '#2f3136',
            color: 'white',
            height: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #40444b', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security />
              Rol Yönetimi - {server.name}
            </Typography>
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', height: '100%' }}>
          {/* Sol Panel - Rol Listesi */}
          <Box sx={{ width: '300px', borderRight: '1px solid #40444b', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Roller</Typography>
              <Button
                startIcon={<Add />}
                onClick={() => setCreateDialogOpen(true)}
                variant="contained"
                size="small"
                sx={{ backgroundColor: '#5865f2' }}
              >
                Yeni Rol
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="roles">
                  {(provided) => (
                    <List {...provided.droppableProps} ref={provided.innerRef}>
                      {roles.map((role, index) => (
                        <Draggable key={role.id} draggableId={role.id} index={index}>
                          {(provided) => (
                            <ListItem
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              sx={{
                                backgroundColor: selectedRole?.id === role.id ? 'rgba(88, 101, 242, 0.1)' : 'transparent',
                                borderRadius: 1,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                              }}
                              onClick={() => setSelectedRole(role)}
                            >
                              <Box {...provided.dragHandleProps} sx={{ mr: 1 }}>
                                <DragIndicator sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: role.color
                                  }}
                                />
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    {role.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {getRoleMemberCount(role.id)} üye
                                  </Typography>
                                </Box>
                              </Box>
                            </ListItem>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </List>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </Box>

          {/* Sağ Panel - Rol Detayları */}
          <Box sx={{ flexGrow: 1, p: 3 }}>
            {selectedRole ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: selectedRole.color
                      }}
                    />
                    <Typography variant="h5">{selectedRole.name}</Typography>
                    {selectedRole.isDefault && (
                      <Chip label="Varsayılan" size="small" color="primary" />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!selectedRole.isDefault && (
                      <>
                        <Button
                          startIcon={<Edit />}
                          onClick={() => startEditRole(selectedRole)}
                          variant="outlined"
                          size="small"
                        >
                          Düzenle
                        </Button>
                        <Button
                          startIcon={<Delete />}
                          onClick={() => {
                            setRoleToDelete(selectedRole);
                            setDeleteDialogOpen(true);
                          }}
                          variant="outlined"
                          color="error"
                          size="small"
                        >
                          Sil
                        </Button>
                      </>
                    )}
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={6}>
                    <Card sx={{ backgroundColor: '#36393f', mb: 2 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Rol Bilgileri
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Renk:
                          </Typography>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: selectedRole.color,
                              border: '2px solid #40444b'
                            }}
                          />
                          <Typography variant="body2">
                            {selectedRole.color}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Üye Sayısı:
                          </Typography>
                          <Badge
                            badgeContent={getRoleMemberCount(selectedRole.id)}
                            color="primary"
                          >
                            <People />
                          </Badge>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Etiketlenebilir:
                          </Typography>
                          <Typography variant="body2">
                            {selectedRole.mentionable ? 'Evet' : 'Hayır'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Pozisyon:
                          </Typography>
                          <Typography variant="body2">
                            {selectedRole.position}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={6}>
                    <Card sx={{ backgroundColor: '#36393f', mb: 2 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Bu Role Sahip Üyeler
                        </Typography>
                        <Box sx={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {members
                            .filter(member => member.roles.includes(selectedRole.id))
                            .map(member => (
                              <Box
                                key={member.userId}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  p: 1,
                                  borderRadius: 1,
                                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                                }}
                              >
                                <Avatar
                                  src={member.user?.photoURL}
                                  sx={{ width: 32, height: 32 }}
                                >
                                  {member.user?.displayName?.charAt(0)}
                                </Avatar>
                                <Typography variant="body2">
                                  {member.user?.displayName || 'Bilinmeyen Kullanıcı'}
                                </Typography>
                              </Box>
                            ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* İzinler */}
                <Typography variant="h6" sx={{ mb: 2 }}>
                  İzinler
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(permissionGroups).map(([groupKey, group]) => (
                    <Grid item xs={12} key={groupKey}>
                      <Accordion
                        sx={{
                          backgroundColor: '#36393f',
                          '&:before': { display: 'none' }
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getPermissionGroupIcon(groupKey)}
                            <Typography variant="subtitle1">{group.title}</Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            {group.permissions.map((permission) => (
                              <Grid item xs={12} sm={6} key={permission.key}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Switch
                                    checked={selectedRole.permissions[permission.key as keyof ServerPermissions]}
                                    onChange={(e) => handlePermissionChange(permission.key as keyof ServerPermissions, e.target.checked)}
                                    size="small"
                                  />
                                  <Box>
                                    <Typography variant="body2">
                                      {permission.label}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {permission.description}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Security sx={{ fontSize: 64, color: 'rgba(255, 255, 255, 0.3)', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Bir rol seçin
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rol detaylarını görüntülemek için sol panelden bir rol seçin
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        {message && (
          <Alert
            severity={message.type}
            onClose={() => setMessage(null)}
            sx={{ position: 'absolute', top: 60, right: 20, zIndex: 1000 }}
          >
            {message.text}
          </Alert>
        )}
      </Dialog>

      {/* Rol Oluşturma/Düzenleme Dialogu */}
      <Dialog
        open={createDialogOpen || editingRole !== null}
        onClose={() => {
          setCreateDialogOpen(false);
          cancelEdit();
        }}
        maxWidth="md"
        fullWidth
        disableEnforceFocus
        PaperProps={{
          sx: { backgroundColor: '#2f3136', color: 'white' }
        }}
      >
        <DialogTitle>
          {editingRole ? 'Rol Düzenle' : 'Yeni Rol Oluştur'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Rol Adı"
              value={roleFormData.name}
              onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#40444b',
                  color: 'white',
                  '& fieldset': { borderColor: '#40444b' },
                  '&:hover fieldset': { borderColor: '#5865f2' },
                  '&.Mui-focused fieldset': { borderColor: '#5865f2' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#5865f2' },
              }}
            />

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>Rol Rengi:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: roleFormData.color,
                    border: '2px solid #40444b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setColorPickerOpen(!colorPickerOpen)}
                />
                <Typography variant="body2" color="text.secondary">
                  {roleFormData.color}
                </Typography>
              </Box>
              
              {/* Önceden tanımlanmış renkler */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {ROLE_COLORS.map((color) => (
                  <Box
                    key={color}
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: roleFormData.color === color ? '2px solid white' : '2px solid transparent',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'scale(1.1)'
                      }
                    }}
                    onClick={() => setRoleFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </Box>
              
              {colorPickerOpen && (
                <Box sx={{ position: 'relative', zIndex: 1000, mt: 2 }}>
                  <ChromePicker
                    color={roleFormData.color}
                    onChange={(color) => setRoleFormData(prev => ({ ...prev, color: color.hex }))}
                  />
                  <Button
                    size="small"
                    onClick={() => setColorPickerOpen(false)}
                    sx={{ mt: 1 }}
                  >
                    Kapat
                  </Button>
                </Box>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>İzin Şablonları:</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => applyPermissionTemplate('default')}
                  sx={{ 
                    borderColor: '#5865f2',
                    color: '#5865f2',
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                      borderColor: '#4752c4',
                      backgroundColor: 'rgba(88, 101, 242, 0.1)',
                      transform: 'translateY(-1px)'
                    },
                    '&:active': {
                      transform: 'translateY(0px)',
                      backgroundColor: 'rgba(88, 101, 242, 0.2)'
                    }
                  }}
                >
                  VARSAYILAN
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => applyPermissionTemplate('moderator')}
                  sx={{ 
                    borderColor: '#f1c40f',
                    color: '#f1c40f',
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                      borderColor: '#d4ac0d',
                      backgroundColor: 'rgba(241, 196, 15, 0.1)',
                      transform: 'translateY(-1px)'
                    },
                    '&:active': {
                      transform: 'translateY(0px)',
                      backgroundColor: 'rgba(241, 196, 15, 0.2)'
                    }
                  }}
                >
                  MODERATÖR
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => applyPermissionTemplate('admin')}
                  sx={{ 
                    borderColor: '#e74c3c',
                    color: '#e74c3c',
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                      borderColor: '#c0392b',
                      backgroundColor: 'rgba(231, 76, 60, 0.1)',
                      transform: 'translateY(-1px)'
                    },
                    '&:active': {
                      transform: 'translateY(0px)',
                      backgroundColor: 'rgba(231, 76, 60, 0.2)'
                    }
                  }}
                >
                  ADMİN
                </Button>
              </Box>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={roleFormData.mentionable}
                  onChange={(e) => setRoleFormData(prev => ({ ...prev, mentionable: e.target.checked }))}
                />
              }
              label="Bu rol etiketlenebilir"
              sx={{ mb: 3 }}
            />

            {/* İzin Grupları */}
            {Object.entries(permissionGroups).map(([groupKey, group]) => (
              <Accordion
                key={groupKey}
                sx={{
                  backgroundColor: '#36393f',
                  mb: 2,
                  '&:before': { display: 'none' }
                }}
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getPermissionGroupIcon(groupKey)}
                    <Typography variant="subtitle1">{group.title}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {group.permissions.map((permission) => (
                      <Grid item xs={12} sm={6} key={permission.key}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={roleFormData.permissions[permission.key as keyof ServerPermissions]}
                              onChange={() => togglePermission(permission.key as keyof ServerPermissions)}
                              size="small"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">
                                {permission.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {permission.description}
                              </Typography>
                            </Box>
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              setCreateDialogOpen(false);
              cancelEdit();
            }}
            variant="outlined"
            sx={{ 
              borderColor: '#40444b',
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': { 
                borderColor: '#5865f2',
                backgroundColor: 'rgba(88, 101, 242, 0.1)'
              }
            }}
          >
            İptal
          </Button>
          <Button
            onClick={editingRole ? handleUpdateRole : handleCreateRole}
            variant="contained"
            disabled={loading || !roleFormData.name.trim()}
            sx={{ 
              backgroundColor: '#5865f2',
              '&:hover': { backgroundColor: '#4752c4' },
              '&:disabled': { backgroundColor: '#40444b' }
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : (editingRole ? 'Güncelle' : 'Oluştur')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rol Silme Dialogu */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        disableEnforceFocus
        PaperProps={{
          sx: { backgroundColor: '#2f3136', color: 'white' }
        }}
      >
        <DialogTitle>Rol Sil</DialogTitle>
        <DialogContent>
          <Typography>
            "{roleToDelete?.name}" rolünü silmek istediğinizden emin misiniz?
            Bu işlem geri alınamaz ve bu role sahip tüm üyeler rolü kaybedecektir.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            İptal
          </Button>
          <Button
            onClick={handleDeleteRole}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Sil'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}; 