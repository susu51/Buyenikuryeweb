import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Truck, RefreshCw, Star, MapPin, Plus, Edit, Ban, CheckCircle, Search } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const Couriers = () => {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    vehicle_type: '',
    address: '',
    password: ''
  });

  const fetchCouriers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/admin/couriers`);
      setCouriers(response.data || []);
    } catch (error) {
      console.error('Kuryeler yüklenirken hata:', error);
      toast.error('Kuryeler yüklenemedi');
      setCouriers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourier = async (e) => {
    e.preventDefault();
    try {
      const courierData = {
        ...formData,
        role: 'kurye'
      };
      
      await axios.post(`${API_BASE}/admin/users`, courierData);
      toast.success('Kurye başarıyla eklendi');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchCouriers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Kurye eklenirken hata oluştu';
      toast.error(message);
    }
  };

  const handleToggleStatus = async (courierId, currentStatus) => {
    try {
      await axios.put(`${API_BASE}/admin/users/${courierId}/toggle-status`);
      const newStatus = currentStatus ? 'pasif' : 'aktif';
      toast.success(`Kurye ${newStatus} duruma getirildi`);
      fetchCouriers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Durum değiştirilirken hata oluştu';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      phone: '',
      vehicle_type: '',
      address: '',
      password: ''
    });
    setSelectedCourier(null);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const filteredCouriers = couriers.filter(courier =>
    courier.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    courier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    courier.phone?.includes(searchTerm)
  );

  const vehicleTypes = [
    { value: 'motosiklet', label: 'Motosiklet' },
    { value: 'araba', label: 'Araba' },
    { value: 'bisiklet', label: 'Bisiklet' },
    { value: 'yaya', label: 'Yaya' }
  ];

  useEffect(() => {
    fetchCouriers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <Truck className="h-8 w-8 text-blue-600" />
            <span>Kurye Yönetimi</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Kuryeler ve performans bilgilerini yönetin
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={fetchCouriers} variant="outline" data-testid="refresh-couriers-btn">
            <RefreshCw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-courier-btn">
                <Plus className="mr-2 h-4 w-4" />
                Kurye Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateCourier}>
                <DialogHeader>
                  <DialogTitle>Yeni Kurye Ekle</DialogTitle>
                  <DialogDescription>
                    Sisteme yeni bir kurye ekleyin
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-email">E-posta</Label>
                    <Input
                      id="create-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="kurye@example.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="create-full-name">Ad Soyad</Label>
                    <Input
                      id="create-full-name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      placeholder="Ahmet Yılmaz"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="create-phone">Telefon</Label>
                    <Input
                      id="create-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="0532 XXX XX XX"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="create-vehicle">Araç Tipi</Label>
                    <Select value={formData.vehicle_type} onValueChange={(value) => setFormData({...formData, vehicle_type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Araç tipi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((vehicle) => (
                          <SelectItem key={vehicle.value} value={vehicle.value}>
                            {vehicle.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="create-address">Adres</Label>
                    <Input
                      id="create-address"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="İş adresi"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="create-password">Şifre</Label>
                    <Input
                      id="create-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Güvenli şifre girin"
                      required
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseCreateDialog}>
                    İptal
                  </Button>
                  <Button type="submit">
                    Kurye Ekle
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Kurye ara (ad, e-posta, telefon)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Courier Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{couriers.length}</div>
              <div className="text-sm text-gray-500">Toplam Kurye</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {couriers.filter(c => c.is_active).length}
              </div>
              <div className="text-sm text-gray-500">Aktif Kurye</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {couriers.filter(c => c.vehicle_type === 'motosiklet').length}
              </div>
              <div className="text-sm text-gray-500">Motosikletli</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {couriers.reduce((sum, c) => sum + (c.completed_orders || 0), 0)}
              </div>
              <div className="text-sm text-gray-500">Toplam Teslimat</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Couriers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCouriers.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <Truck className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>Kurye bulunamadı</p>
          </div>
        ) : (
          filteredCouriers.map((courier) => (
            <Card key={courier.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{courier.full_name}</CardTitle>
                  <Badge variant={courier.is_active ? "default" : "secondary"}>
                    {courier.is_active ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <CardDescription>{courier.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Telefon:</span>
                    <span className="text-sm font-medium">{courier.phone}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Araç:</span>
                    <span className="text-sm font-medium capitalize">
                      {courier.vehicle_type || 'Belirtilmemiş'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Teslimat:</span>
                    <span className="text-sm font-medium">{courier.completed_orders || 0} adet</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Puan:</span>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{courier.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                  </div>
                  
                  {courier.last_location && (
                    <div className="flex items-center space-x-2 pt-2 border-t">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-gray-500">Konum aktif</span>
                    </div>
                  )}

                  {courier.address && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-gray-500">Adres:</span>
                      <p className="text-xs text-gray-700 mt-1">{courier.address}</p>
                    </div>
                  )}
                  
                  <div className="flex space-x-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleToggleStatus(courier.id, courier.is_active)}
                    >
                      {courier.is_active ? (
                        <>
                          <Ban className="h-3 w-3 mr-1" />
                          Pasif Yap
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aktif Yap
                        </>
                      )}
                    </Button>
                    
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Couriers;