import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Edit, 
  Save, 
  X,
  Truck 
} from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'moderator': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'banned': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <User className="h-8 w-8" />
            <span>Profil Bilgileri</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Hesap bilgilerinizi yönetin
          </p>
        </div>
      </div>

      {/* Profile Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card data-testid="profile-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
                <Truck className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle className="text-xl">{user.full_name}</CardTitle>
              <CardDescription>@{user.username}</CardDescription>
              
              <div className="flex justify-center space-x-2 mt-4">
                <Badge variant={getRoleBadgeVariant(user.role)} data-testid="user-role-badge">
                  {user.role === 'admin' ? 'Yönetici' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
                <Badge variant={getStatusBadgeVariant(user.status)} data-testid="user-status-badge">
                  {user.status === 'active' ? 'Aktif' : user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Details Card */}
        <div className="lg:col-span-2">
          <Card data-testid="profile-details-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Hesap Detayları</CardTitle>
                <CardDescription>
                  Hesap bilgileriniz ve ayarlarınız
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                data-testid="edit-profile-btn"
              >
                {isEditing ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    İptal
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Düzenle
                  </>
                )}
              </Button>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Kişisel Bilgiler</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Ad Soyad</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900" data-testid="profile-fullname">
                        {user.full_name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Kullanıcı Adı</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900" data-testid="profile-username">
                        @{user.username}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-500">E-posta</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900" data-testid="profile-email">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Hesap Bilgileri</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Rol</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <Shield className="h-4 w-4 text-gray-400" />
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role === 'admin' ? 'Yönetici' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Durum</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <User className="h-4 w-4 text-gray-400" />
                      <Badge variant={getStatusBadgeVariant(user.status)}>
                        {user.status === 'active' ? 'Aktif' : user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Üyelik Tarihi</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900" data-testid="profile-created-date">
                        {new Date(user.created_at).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Son Giriş</label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900" data-testid="profile-last-login">
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Hiçbir zaman'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Sistem Bilgileri</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">Hesap Kimliği</label>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <code className="text-sm text-gray-700 break-all" data-testid="profile-user-id">
                      {user.id}
                    </code>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    İptal
                  </Button>
                  <Button data-testid="save-profile-btn">
                    <Save className="mr-2 h-4 w-4" />
                    Değişiklikleri Kaydet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Security Settings */}
      <Card data-testid="security-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Güvenlik Ayarları</span>
          </CardTitle>
          <CardDescription>
            Hesap güvenliği ve kimlik doğrulama yönetimi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Şifre</h4>
                <p className="text-sm text-gray-500">Son güncelleme: Yakın zamanda</p>
              </div>
              <Button variant="outline" size="sm">
                Şifre Değiştir
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">İki Faktörlü Kimlik Doğrulama</h4>
                <p className="text-sm text-gray-500">Ekstra güvenlik katmanı ekleyin</p>
              </div>
              <Button variant="outline" size="sm">
                2FA Etkinleştir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;