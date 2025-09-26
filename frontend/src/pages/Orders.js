import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Package, RefreshCw, Search, Eye, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/admin/orders`);
      setOrders(response.data || []);
    } catch (error) {
      console.error('Siparişler yüklenirken hata:', error);
      toast.error('Siparişler yüklenemedi');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'picked_up': return 'bg-orange-100 text-orange-800';
      case 'in_transit': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Bekliyor';
      case 'assigned': return 'Atandı';
      case 'picked_up': return 'Toplandı';
      case 'in_transit': return 'Yolda';
      case 'delivered': return 'Teslim Edildi';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

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
            <Package className="h-8 w-8 text-blue-600" />
            <span>Sipariş Yönetimi</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Tüm kargo siparişlerini yönetin
          </p>
        </div>
        
        <Button onClick={fetchOrders} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Yenile
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Siparişler ({orders.length})</CardTitle>
          <CardDescription>
            Sistemdeki tüm kargo siparişleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Henüz sipariş bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Sipariş ID</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Müşteri</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">İşletme</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Kurye</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Durum</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Ücret</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-2 font-mono text-sm">
                        {order.id?.substring(0, 8)}...
                      </td>
                      <td className="py-4 px-2">
                        <span className="font-medium">{order.customer_name || 'Bilinmiyor'}</span>
                      </td>
                      <td className="py-4 px-2">
                        <span className="text-sm">{order.business_name || 'Bilinmiyor'}</span>
                      </td>
                      <td className="py-4 px-2">
                        <span className="text-sm">{order.courier_name || 'Atanmamış'}</span>
                      </td>
                      <td className="py-4 px-2">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusText(order.status)}
                        </Badge>
                      </td>
                      <td className="py-4 px-2 font-medium">
                        ₺{order.delivery_fee?.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-4 px-2 text-sm text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('tr-TR') : '-'}
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

export default Orders;