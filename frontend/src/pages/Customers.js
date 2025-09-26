import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Users, RefreshCw, Package, Star, Plus, Edit, Ban, CheckCircle, Search, Phone, Mail } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    address: '',
    password: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // Müşteri endpoint'i ekleyeceğiz
      const response = await axios.get(`${API_BASE}/admin/users`);
      // Sadece müşterileri filtrele
      const customerData = response.data.filter(user => user.role === 'musteri') || [];
      setCustomers(customerData);
    } catch (error) {
      console.error('Müşteriler yüklenirken hata:', error);
      toast.error('Müşteriler yüklenemedi');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const customerData = {
        ...formData,
        role: 'musteri'
      };
      
      await axios.post(`${API_BASE}/admin/users`, customerData);
      toast.success('Müşteri başarıyla eklendi');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Müşteri eklenirken hata oluştu';
      toast.error(message);
    }
  };

  const handleToggleStatus = async (customerId, currentStatus) => {
    try {
      await axios.put(`${API_BASE}/admin/users/${customerId}/toggle-status`);
      const newStatus = currentStatus ? 'pasif' : 'aktif';
      toast.success(`Müşteri ${newStatus} duruma getirildi`);
      fetchCustomers();
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
      address: '',
      password: ''
    });
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const filteredCustomers = customers.filter(customer =>
    customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  useEffect(() => {
    fetchCustomers();
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
            <Users className="h-8 w-8 text-blue-600" />
            <span>Müşteri Yönetimi</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Kayıtlı müşterileri yönetin
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={fetchCustomers} variant="outline" data-testid="refresh-customers-btn">
            <RefreshCw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-customer-btn">
                <Plus className="mr-2 h-4 w-4" />
                Müşteri Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateCustomer}>
                <DialogHeader>
                  <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
                  <DialogDescription>
                    Sisteme yeni bir müşteri ekleyin
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
                      placeholder="musteri@example.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="create-full-name">Ad Soyad</Label>
                    <Input
                      id="create-full-name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      placeholder="Ayşe Demir"
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
                    <Label htmlFor="create-address">Adres</Label>
                    <Input
                      id="create-address"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="Ev/iş adresi"
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
                    Müşteri Ekle
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
              placeholder="Müşteri ara (ad, e-posta, telefon)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{customers.length}</div>
              <div className="text-sm text-gray-500">Toplam Müşteri</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {customers.filter(c => c.is_active).length}
              </div>
              <div className="text-sm text-gray-500">Aktif Müşteri</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {customers.reduce((sum, c) => sum + (c.total_orders || 0), 0)}
              </div>
              <div className="text-sm text-gray-500">Toplam Sipariş</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {customers.filter(c => c.created_at && 
                  new Date(c.created_at) > new Date(Date.now() - 30*24*60*60*1000)
                ).length}
              </div>
              <div className="text-sm text-gray-500">Son 30 Gün</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <CardTitle>Müşteriler ({filteredCustomers.length})</CardTitle>
          <CardDescription>
            Sisteme kayıtlı tüm müşteriler
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Müşteri bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Müşteri</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">İletişim</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Durum</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Sipariş</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Kayıt Tarihi</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-2">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{customer.full_name}</div>
                            <div className="text-sm text-gray-500">ID: {customer.id?.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            {customer.email}
                          </div>
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            {customer.phone}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <Badge variant={customer.is_active ? "default" : "secondary"}>
                          {customer.is_active ? "Aktif" : "Pasif"}
                        </Badge>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-1 text-gray-400" />
                          <span className="text-sm">{customer.total_orders || 0} adet</span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-sm text-gray-500">
                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(customer.id, customer.is_active)}
                            className="text-xs"
                          >
                            {customer.is_active ? (
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Customers;