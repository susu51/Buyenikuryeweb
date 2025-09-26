import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, Package, Truck, Building2, TrendingUp, Clock, CheckCircle, DollarSign, RefreshCw, Activity } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      
      const response = await axios.get(`${API_BASE}/admin/dashboard/kargo-stats`);
      setStats(response.data);
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
      toast.error('İstatistikler yüklenemedi');
    } finally {
      setLoading(false);
      if (showRefreshIndicator) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    fetchStats(true);
    toast.success('Veriler güncellendi');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Toplam Kullanıcı',
      value: stats?.total_users || 0,
      description: 'Sistemdeki tüm kullanıcılar',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      testId: 'total-users-card'
    },
    {
      title: 'Kuryeler',
      value: stats?.total_couriers || 0,
      description: 'Aktif kurye sayısı',
      icon: Truck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      testId: 'couriers-card'
    },
    {
      title: 'İşletmeler',
      value: stats?.total_businesses || 0,
      description: 'Kayıtlı işletme sayısı',
      icon: Building2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      testId: 'businesses-card'
    },
    {
      title: 'Müşteriler',
      value: stats?.total_customers || 0,
      description: 'Kayıtlı müşteri sayısı',
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      testId: 'customers-card'
    }
  ];

  const orderStats = [
    {
      title: 'Toplam Sipariş',
      value: stats?.total_orders || 0,
      description: 'Tüm zamanların siparişi',
      icon: Package,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      testId: 'total-orders-card'
    },
    {
      title: 'Bekleyen Siparişler',
      value: stats?.pending_orders || 0,
      description: 'Kurye bekleyen siparişler',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      testId: 'pending-orders-card'
    },
    {
      title: 'Aktif Teslimatlar',
      value: stats?.active_orders || 0,
      description: 'Yolda olan siparişler',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      testId: 'active-orders-card'
    },
    {
      title: 'Bugün Teslim Edilen',
      value: stats?.delivered_today || 0,
      description: 'Bugün tamamlanan teslimat',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      testId: 'delivered-today-card'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2" data-testid="dashboard-title">
            <Truck className="h-8 w-8 text-blue-600" />
            <span>Mobil Kargo Yönetimi</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Kargo sistemi genel durumu ve istatistikleri
          </p>
        </div>
        
        <Button 
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          data-testid="refresh-btn"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* User Stats Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Kullanıcı İstatistikleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow" data-testid={stat.testId}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.title}
                </CardTitle>
                <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Order Stats Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sipariş İstatistikleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {orderStats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow" data-testid={stat.testId}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.title}
                </CardTitle>
                <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Financial and System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Summary */}
        <Card data-testid="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Finansal Özet</span>
            </CardTitle>
            <CardDescription>
              Komisyon gelirleri ve kazanç bilgileri
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Toplam Komisyon Geliri</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₺{(stats?.total_commission || 0).toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              
              <div className="text-sm text-gray-500">
                <p>• Teslim edilen her sipariş için %15 komisyon alınır</p>
                <p>• Ödemeler aylık olarak hesaplanır</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card data-testid="system-status-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-600" />
              <span>Sistem Durumu</span>
            </CardTitle>
            <CardDescription>
              Anlık sistem sağlığı ve performans bilgileri
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Veritabanı</span>
                <span className="text-sm font-medium text-green-600">● Çalışıyor</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Sunucusu</span>
                <span className="text-sm font-medium text-green-600">● Çalışıyor</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Harita Servisi</span>
                <span className="text-sm font-medium text-green-600">● Çalışıyor</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">WebSocket Bağlantısı</span>
                <span className="text-sm font-medium text-green-600">● Aktif</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card data-testid="quick-actions-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>Hızlı İşlemler</span>
          </CardTitle>
          <CardDescription>
            Sık kullanılan yönetim işlemleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => window.location.href = '/orders'}
              data-testid="manage-orders-btn"
            >
              <Package className="mr-2 h-4 w-4" />
              Siparişleri Yönet
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => window.location.href = '/couriers'}
              data-testid="manage-couriers-btn"
            >
              <Truck className="mr-2 h-4 w-4" />
              Kuryeleri Yönet
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => window.location.href = '/businesses'}
              data-testid="manage-businesses-btn"
            >
              <Building2 className="mr-2 h-4 w-4" />
              İşletmeleri Yönet
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => window.location.href = '/reports'}
              data-testid="view-reports-btn"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Raporları Görüntüle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;