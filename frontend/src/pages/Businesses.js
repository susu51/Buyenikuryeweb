import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Building2, RefreshCw, Package, Star } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const Businesses = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/admin/businesses`);
      setBusinesses(response.data || []);
    } catch (error) {
      console.error('İşletmeler yüklenirken hata:', error);
      toast.error('İşletmeler yüklenemedi');
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
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
            <Building2 className="h-8 w-8 text-blue-600" />
            <span>İşletme Yönetimi</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Kayıtlı işletmeler ve sipariş bilgileri
          </p>
        </div>
        
        <Button onClick={fetchBusinesses} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Yenile
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>Henüz işletme bulunmuyor</p>
          </div>
        ) : (
          businesses.map((business) => (
            <Card key={business.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{business.business_name || business.full_name}</CardTitle>
                  <Badge variant={business.is_active ? "default" : "secondary"}>
                    {business.is_active ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <CardDescription>{business.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Yetkili Kişi:</span>
                    <span className="text-sm font-medium">{business.full_name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Telefon:</span>
                    <span className="text-sm font-medium">{business.phone}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Toplam Sipariş:</span>
                    <div className="flex items-center space-x-1">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">{business.order_count || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Değerlendirme:</span>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{business.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                  </div>
                  
                  {business.address && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-gray-500">Adres:</span>
                      <p className="text-xs text-gray-700 mt-1">{business.address}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t">
                    <span className="text-xs text-gray-500">
                      Üyelik: {business.created_at ? new Date(business.created_at).toLocaleDateString('tr-TR') : '-'}
                    </span>
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

export default Businesses;