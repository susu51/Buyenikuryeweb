import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BarChart3, RefreshCw, DollarSign, TrendingUp, Calendar, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const Reports = () => {
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFinancialReport = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/admin/financial-report`);
      setFinancialData(response.data);
    } catch (error) {
      console.error('Finansal rapor yüklenirken hata:', error);
      toast.error('Finansal rapor yüklenemedi');
      setFinancialData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialReport();
  }, []);

  const getMonthName = (month) => {
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return months[month - 1];
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
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <span>Finansal Raporlar</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Komisyon gelirleri ve performans raporları
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={fetchFinancialReport} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            İndir
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Komisyon
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₺{financialData?.total_commission_earned?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-gray-500">
              Tüm zamanların komisyon geliri
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Teslim Edilen Sipariş
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {financialData?.total_orders_delivered || 0}
            </div>
            <p className="text-xs text-gray-500">
              Başarıyla tamamlanan teslimat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Ortalama Komisyon
            </CardTitle>
            <Calendar className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ₺{financialData?.total_orders_delivered > 0 
                ? (financialData.total_commission_earned / financialData.total_orders_delivered).toFixed(2)
                : '0.00'
              }
            </div>
            <p className="text-xs text-gray-500">
              Sipariş başına ortalama kazanç
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span>Aylık Komisyon Gelirleri</span>
          </CardTitle>
          <CardDescription>
            Aylara göre komisyon geliri dağılımı
          </CardDescription>
        </CardHeader>
        <CardContent>
          {financialData?.monthly_revenue?.length > 0 ? (
            <div className="space-y-4">
              {financialData.monthly_revenue.slice(0, 6).map((month, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">
                      {getMonthName(month._id.month)} {month._id.year}
                    </p>
                    <p className="text-sm text-gray-500">
                      {month.order_count} sipariş
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      ₺{month.total_revenue.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Komisyon geliri
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Henüz finansal veri bulunmuyor</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Info */}
      <Card>
        <CardHeader>
          <CardTitle>Komisyon Bilgileri</CardTitle>
          <CardDescription>
            Sistem komisyon oranları ve hesaplama detayları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900">Komisyon Oranı</h4>
              <p className="text-2xl font-bold text-blue-600">%15</p>
              <p className="text-sm text-blue-700">Her teslim edilen sipariş için</p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-900">Ödeme Döngüsü</h4>
              <p className="text-lg font-medium text-green-600">Aylık</p>
              <p className="text-sm text-green-700">Her ayın sonunda hesaplanır</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;