#!/usr/bin/env python3
"""
Mobil Kargo Backend API Test Suite
Tests all backend endpoints with Turkish language support
"""

import requests
import json
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://mobilkargo.preview.emergentagent.com/api"
TIMEOUT = 30

class MobilKargoTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.orders = {}  # Store created orders
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    headers: Dict = None, token: str = None, params: Dict = None) -> tuple:
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        
        # Set up headers
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        if token:
            req_headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers, params=params)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers, params=params)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=req_headers, params=params)
            else:
                return False, {"error": f"Unsupported method: {method}"}
                
            return True, response
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}
    
    def test_api_health(self):
        """Test API health endpoint"""
        success, response = self.make_request("GET", "/")
        
        if not success:
            self.log_test("API Health Check", False, "API bağlantısı başarısız", response)
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.log_test("API Health Check", True, f"API aktif: {data.get('message', 'OK')}")
            return True
        else:
            self.log_test("API Health Check", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_user_registration(self):
        """Test user registration for all 3 roles"""
        test_users = [
            {
                "role": "kurye",
                "email": "ahmet.kurye@test.com",
                "password": "kurye123",
                "full_name": "Ahmet Yılmaz",
                "phone": "+905551234567",
                "address": "İstanbul, Kadıköy",
                "vehicle_type": "motosiklet"
            },
            {
                "role": "isletme", 
                "email": "kargo.isletme@test.com",
                "password": "isletme123",
                "full_name": "Mehmet Özkan",
                "phone": "+905551234568",
                "address": "İstanbul, Şişli",
                "business_name": "Hızlı Kargo Ltd."
            },
            {
                "role": "musteri",
                "email": "ayse.musteri@test.com", 
                "password": "musteri123",
                "full_name": "Ayşe Demir",
                "phone": "+905551234569",
                "address": "İstanbul, Beşiktaş"
            }
        ]
        
        all_success = True
        
        for user_data in test_users:
            success, response = self.make_request("POST", "/auth/register", user_data)
            
            if not success:
                self.log_test(f"Register {user_data['role']}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                # Store user info and token
                self.users[user_data['role']] = data['user']
                self.tokens[user_data['role']] = data['access_token']
                
                self.log_test(f"Register {user_data['role']}", True, 
                            f"Kullanıcı kaydı başarılı: {data['user']['full_name']}")
            elif response.status_code == 400 and "zaten kullanılıyor" in response.json().get('detail', ''):
                # User already exists, this is fine for testing
                self.log_test(f"Register {user_data['role']}", True, 
                            f"Kullanıcı zaten mevcut: {user_data['email']}")
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Register {user_data['role']}", False, f"Kayıt başarısız: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_user_login(self):
        """Test user login for all roles"""
        login_data = [
            {"email": "ahmet.kurye@test.com", "password": "kurye123", "role": "kurye"},
            {"email": "kargo.isletme@test.com", "password": "isletme123", "role": "isletme"},
            {"email": "ayse.musteri@test.com", "password": "musteri123", "role": "musteri"}
        ]
        
        all_success = True
        
        for login in login_data:
            success, response = self.make_request("POST", "/auth/login", {
                "email": login["email"],
                "password": login["password"]
            })
            
            if not success:
                self.log_test(f"Login {login['role']}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                # Update token (in case registration failed but user exists)
                self.tokens[login['role']] = data['access_token']
                self.users[login['role']] = data['user']
                
                self.log_test(f"Login {login['role']}", True, 
                            f"Giriş başarılı: {data['user']['full_name']}")
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Login {login['role']}", False, f"Giriş başarısız: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_get_current_user(self):
        """Test getting current user info"""
        all_success = True
        
        for role, token in self.tokens.items():
            if not token:
                continue
                
            success, response = self.make_request("GET", "/auth/me", token=token)
            
            if not success:
                self.log_test(f"Get User Info {role}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                self.log_test(f"Get User Info {role}", True, 
                            f"Kullanıcı bilgisi alındı: {data['full_name']} ({data['role']})")
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Get User Info {role}", False, f"Bilgi alınamadı: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_unauthorized_access(self):
        """Test unauthorized access attempts"""
        # Test without token
        success, response = self.make_request("GET", "/auth/me")
        
        if not success:
            self.log_test("Unauthorized Access", False, "İstek başarısız", response)
            return False
            
        if response.status_code in [401, 403]:
            self.log_test("Unauthorized Access", True, f"Yetkisiz erişim doğru şekilde engellendi (HTTP {response.status_code})")
            return True
        else:
            self.log_test("Unauthorized Access", False, f"Beklenen 401/403, alınan {response.status_code}")
            return False
    
    def test_order_creation(self):
        """Test order creation by business"""
        if 'isletme' not in self.tokens or not self.tokens['isletme']:
            self.log_test("Order Creation", False, "İşletme token'ı bulunamadı")
            return False
            
        order_data = {
            "customer_email": "ayse.musteri@test.com",
            "pickup_address": "Atatürk Caddesi No:123, Kadıköy, İstanbul",
            "delivery_address": "İstiklal Caddesi No:456, Beyoğlu, İstanbul", 
            "pickup_phone": "+905551234567",
            "delivery_phone": "+905551234569",
            "package_description": "Elektronik ürün - Laptop",
            "special_instructions": "Kırılabilir, dikkatli taşıyın",
            "estimated_weight": 2.5,
            "estimated_value": 15000.0
        }
        
        success, response = self.make_request("POST", "/orders", order_data, token=self.tokens['isletme'])
        
        if not success:
            self.log_test("Order Creation", False, "İstek başarısız", response)
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.orders['test_order'] = data
            self.log_test("Order Creation", True, 
                        f"Sipariş oluşturuldu: {data['id']} - {data['package_description']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
            self.log_test("Order Creation", False, f"Sipariş oluşturulamadı: {error_msg}")
            return False
    
    def test_get_orders(self):
        """Test getting orders for different roles"""
        all_success = True
        
        for role, token in self.tokens.items():
            if not token:
                continue
                
            success, response = self.make_request("GET", "/orders", token=token)
            
            if not success:
                self.log_test(f"Get Orders {role}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                self.log_test(f"Get Orders {role}", True, 
                            f"Siparişler alındı: {len(data)} sipariş")
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Get Orders {role}", False, f"Siparişler alınamadı: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_order_assignment(self):
        """Test courier assigning order to themselves"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Order Assignment", False, "Kurye token'ı bulunamadı")
            return False
            
        if 'test_order' not in self.orders:
            self.log_test("Order Assignment", False, "Test siparişi bulunamadı")
            return False
            
        order_id = self.orders['test_order']['id']
        success, response = self.make_request("POST", f"/orders/{order_id}/assign", token=self.tokens['kurye'])
        
        if not success:
            self.log_test("Order Assignment", False, "İstek başarısız", response)
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.log_test("Order Assignment", True, f"Sipariş atandı: {data['message']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
            self.log_test("Order Assignment", False, f"Sipariş atanamadı: {error_msg}")
            return False
    
    def test_order_status_updates(self):
        """Test courier updating order status"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Order Status Updates", False, "Kurye token'ı bulunamadı")
            return False
            
        if 'test_order' not in self.orders:
            self.log_test("Order Status Updates", False, "Test siparişi bulunamadı")
            return False
            
        order_id = self.orders['test_order']['id']
        statuses = ["picked_up", "in_transit", "delivered"]
        all_success = True
        
        for status in statuses:
            success, response = self.make_request("PUT", f"/orders/{order_id}/status", 
                                                None, token=self.tokens['kurye'], params={"status": status})
            
            if not success:
                self.log_test(f"Status Update {status}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                self.log_test(f"Status Update {status}", True, f"Durum güncellendi: {data['message']}")
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Status Update {status}", False, f"Durum güncellenemedi: {error_msg}")
                all_success = False
                
            time.sleep(1)  # Small delay between status updates
            
        return all_success
    
    def test_location_update(self):
        """Test courier location update"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Location Update", False, "Kurye token'ı bulunamadı")
            return False
            
        location_data = {
            "courier_id": self.users['kurye']['id'],
            "latitude": 41.0082,  # Istanbul coordinates
            "longitude": 28.9784,
            "accuracy": 10.0,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        success, response = self.make_request("POST", "/location/update", location_data, token=self.tokens['kurye'])
        
        if not success:
            self.log_test("Location Update", False, "İstek başarısız", response)
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.log_test("Location Update", True, f"Konum güncellendi: {data['message']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
            self.log_test("Location Update", False, f"Konum güncellenemedi: {error_msg}")
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard stats for all roles"""
        all_success = True
        
        for role, token in self.tokens.items():
            if not token:
                continue
                
            success, response = self.make_request("GET", "/dashboard/stats", token=token)
            
            if not success:
                self.log_test(f"Dashboard Stats {role}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                stats_summary = ", ".join([f"{k}: {v}" for k, v in data.items()])
                self.log_test(f"Dashboard Stats {role}", True, f"İstatistikler alındı: {stats_summary}")
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Dashboard Stats {role}", False, f"İstatistikler alınamadı: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_websocket_connection(self):
        """Test WebSocket connection (basic connectivity test)"""
        try:
            import websocket
            
            # Test WebSocket URL
            ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
            test_user_id = self.users.get('kurye', {}).get('id', 'test-user-id')
            ws_endpoint = f"{ws_url}/ws/{test_user_id}"
            
            # Simple connection test
            ws = websocket.create_connection(ws_endpoint, timeout=5)
            ws.close()
            
            self.log_test("WebSocket Connection", True, "WebSocket bağlantısı başarılı")
            return True
            
        except Exception as e:
            self.log_test("WebSocket Connection", False, f"WebSocket bağlantısı başarısız: {str(e)}")
            return False
    
    def test_google_maps_geocoding(self):
        """Test Google Maps geocoding API with Turkish addresses"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Google Maps Geocoding", False, "Kurye token'ı bulunamadı")
            return False
            
        test_addresses = [
            "Kadıköy, İstanbul",
            "Beşiktaş, İstanbul", 
            "Taksim Meydanı, İstanbul",
            "Galata Kulesi, İstanbul"
        ]
        
        all_success = True
        
        for address in test_addresses:
            success, response = self.make_request("POST", "/maps/geocode", 
                                                token=self.tokens['kurye'], 
                                                params={"address": address})
            
            if not success:
                self.log_test(f"Geocoding {address}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("coordinates"):
                    coords = data["coordinates"]
                    lat, lng = coords["lat"], coords["lng"]
                    
                    # Validate coordinates are in Istanbul area
                    if 40.8 <= lat <= 41.3 and 28.5 <= lng <= 29.5:
                        self.log_test(f"Geocoding {address}", True, 
                                    f"Koordinatlar alındı: {lat:.4f}, {lng:.4f}")
                    else:
                        self.log_test(f"Geocoding {address}", False, 
                                    f"Koordinatlar İstanbul dışında: {lat:.4f}, {lng:.4f}")
                        all_success = False
                else:
                    self.log_test(f"Geocoding {address}", False, "Koordinat bilgisi alınamadı")
                    all_success = False
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Geocoding {address}", False, f"Geocoding başarısız: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_google_maps_directions(self):
        """Test Google Maps directions API"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Google Maps Directions", False, "Kurye token'ı bulunamadı")
            return False
            
        test_routes = [
            ("Kadıköy, İstanbul", "Beşiktaş, İstanbul"),
            ("Taksim, İstanbul", "Sultanahmet, İstanbul")
        ]
        
        all_success = True
        
        for origin, destination in test_routes:
            success, response = self.make_request("POST", "/maps/directions", 
                                                token=self.tokens['kurye'], 
                                                params={
                                                    "origin": origin,
                                                    "destination": destination
                                                })
            
            if not success:
                self.log_test(f"Directions {origin} → {destination}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    distance_text = data.get("distance_text", "")
                    duration_text = data.get("duration_text", "")
                    
                    if distance_text and duration_text:
                        self.log_test(f"Directions {origin} → {destination}", True, 
                                    f"Rota bulundu: {distance_text}, {duration_text}")
                    else:
                        self.log_test(f"Directions {origin} → {destination}", False, 
                                    "Rota bilgisi eksik")
                        all_success = False
                else:
                    self.log_test(f"Directions {origin} → {destination}", False, "Rota bulunamadı")
                    all_success = False
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Directions {origin} → {destination}", False, f"Directions başarısız: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_google_maps_places_search(self):
        """Test Google Maps places search API"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Google Maps Places Search", False, "Kurye token'ı bulunamadı")
            return False
            
        test_queries = [
            ("restoran", "41.0082,28.9784"),  # Istanbul center
            ("hastane", "41.0082,28.9784"),
            ("eczane", None)  # Without location filter
        ]
        
        all_success = True
        
        for query, location in test_queries:
            params = {"query": query}
            if location:
                params["location"] = location
                
            success, response = self.make_request("POST", "/maps/places/search", 
                                                token=self.tokens['kurye'], 
                                                params=params)
            
            if not success:
                self.log_test(f"Places Search {query}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    places = data.get("places", [])
                    location_desc = f" ({location} yakınında)" if location else ""
                    
                    self.log_test(f"Places Search {query}{location_desc}", True, 
                                f"{len(places)} yer bulundu")
                else:
                    self.log_test(f"Places Search {query}", False, "Arama başarısız")
                    all_success = False
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Places Search {query}", False, f"Arama başarısız: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_google_maps_reverse_geocoding(self):
        """Test Google Maps reverse geocoding API"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Google Maps Reverse Geocoding", False, "Kurye token'ı bulunamadı")
            return False
            
        test_coordinates = [
            (41.0082, 28.9784, "İstanbul merkez"),
            (41.0055, 28.9769, "Sultanahmet bölgesi")
        ]
        
        all_success = True
        
        for lat, lng, description in test_coordinates:
            success, response = self.make_request("GET", "/maps/reverse-geocode", 
                                                token=self.tokens['kurye'], 
                                                params={"lat": lat, "lng": lng})
            
            if not success:
                self.log_test(f"Reverse Geocoding {description}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                formatted_address = data.get("formatted_address", "")
                
                if formatted_address:
                    self.log_test(f"Reverse Geocoding {description}", True, 
                                f"Adres bulundu: {formatted_address}")
                else:
                    self.log_test(f"Reverse Geocoding {description}", False, "Adres bulunamadı")
                    all_success = False
            else:
                error_msg = response.json().get('detail', 'Bilinmeyen hata') if response.content else f"HTTP {response.status_code}"
                self.log_test(f"Reverse Geocoding {description}", False, f"Reverse geocoding başarısız: {error_msg}")
                all_success = False
                
        return all_success
    
    def test_google_maps_authentication(self):
        """Test that Google Maps endpoints require authentication"""
        endpoints_to_test = [
            ("POST", "/maps/geocode", {"address": "Istanbul"}),
            ("POST", "/maps/directions", {"origin": "Istanbul", "destination": "Ankara"}),
            ("POST", "/maps/places/search", {"query": "restoran"}),
            ("GET", "/maps/reverse-geocode", {"lat": 41.0082, "lng": 28.9784})
        ]
        
        all_success = True
        
        for method, endpoint, params in endpoints_to_test:
            # Test without token
            success, response = self.make_request(method, endpoint, params=params)
            
            if not success:
                self.log_test(f"Maps Auth {method} {endpoint}", False, "İstek başarısız", response)
                all_success = False
                continue
                
            if response.status_code in [401, 403]:
                self.log_test(f"Maps Auth {method} {endpoint}", True, "Yetkilendirme gereksinimi doğru")
            else:
                self.log_test(f"Maps Auth {method} {endpoint}", False, 
                            f"Beklenen 401/403, alınan {response.status_code}")
                all_success = False
                
        return all_success
    
    def test_google_maps_integration_flow(self):
        """Test full Google Maps integration flow"""
        if 'kurye' not in self.tokens or not self.tokens['kurye']:
            self.log_test("Google Maps Integration Flow", False, "Kurye token'ı bulunamadı")
            return False
            
        # Step 1: Geocode pickup address
        pickup_address = "Kadıköy İskele, İstanbul"
        success, response = self.make_request("POST", "/maps/geocode", 
                                            token=self.tokens['kurye'], 
                                            params={"address": pickup_address})
        
        if not success or response.status_code != 200:
            self.log_test("Google Maps Integration Flow", False, "Pickup geocoding başarısız")
            return False
            
        pickup_data = response.json()
        if not pickup_data.get("success"):
            self.log_test("Google Maps Integration Flow", False, "Pickup geocoding sonucu başarısız")
            return False
        
        # Step 2: Geocode delivery address
        delivery_address = "Taksim Meydanı, İstanbul"
        success, response = self.make_request("POST", "/maps/geocode", 
                                            token=self.tokens['kurye'], 
                                            params={"address": delivery_address})
        
        if not success or response.status_code != 200:
            self.log_test("Google Maps Integration Flow", False, "Delivery geocoding başarısız")
            return False
            
        delivery_data = response.json()
        if not delivery_data.get("success"):
            self.log_test("Google Maps Integration Flow", False, "Delivery geocoding sonucu başarısız")
            return False
        
        # Step 3: Get directions
        success, response = self.make_request("POST", "/maps/directions", 
                                            token=self.tokens['kurye'], 
                                            params={
                                                "origin": pickup_address,
                                                "destination": delivery_address
                                            })
        
        if not success or response.status_code != 200:
            self.log_test("Google Maps Integration Flow", False, "Directions başarısız")
            return False
            
        directions_data = response.json()
        if not directions_data.get("success"):
            self.log_test("Google Maps Integration Flow", False, "Directions sonucu başarısız")
            return False
        
        # Success
        distance = directions_data.get("distance_text", "N/A")
        duration = directions_data.get("duration_text", "N/A")
        
        self.log_test("Google Maps Integration Flow", True, 
                    f"Tam entegrasyon başarılı: {pickup_address} → {delivery_address} ({distance}, {duration})")
        return True
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Mobil Kargo Backend API Test Başlıyor...")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("API Health Check", self.test_api_health),
            ("User Registration", self.test_user_registration),
            ("User Login", self.test_user_login),
            ("Get Current User", self.test_get_current_user),
            ("Unauthorized Access", self.test_unauthorized_access),
            ("Order Creation", self.test_order_creation),
            ("Get Orders", self.test_get_orders),
            ("Order Assignment", self.test_order_assignment),
            ("Order Status Updates", self.test_order_status_updates),
            ("Location Update", self.test_location_update),
            ("Dashboard Stats", self.test_dashboard_stats),
            ("WebSocket Connection", self.test_websocket_connection),
            ("Google Maps Geocoding", self.test_google_maps_geocoding),
            ("Google Maps Directions", self.test_google_maps_directions),
            ("Google Maps Places Search", self.test_google_maps_places_search),
            ("Google Maps Reverse Geocoding", self.test_google_maps_reverse_geocoding),
            ("Google Maps Authentication", self.test_google_maps_authentication),
            ("Google Maps Integration Flow", self.test_google_maps_integration_flow)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n📋 {test_name} testi çalışıyor...")
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_test(test_name, False, f"Test hatası: {str(e)}")
        
        print("\n" + "=" * 60)
        print(f"📊 TEST SONUÇLARI: {passed}/{total} test başarılı")
        
        if passed == total:
            print("🎉 Tüm testler başarıyla geçti!")
        else:
            print(f"⚠️  {total - passed} test başarısız oldu.")
            
        return passed, total, self.test_results

def main():
    """Main test runner"""
    tester = MobilKargoTester()
    passed, total, results = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w', encoding='utf-8') as f:
        json.dump({
            "summary": {
                "passed": passed,
                "total": total,
                "success_rate": round((passed / total) * 100, 1) if total > 0 else 0
            },
            "results": results,
            "timestamp": datetime.now().isoformat()
        }, f, ensure_ascii=False, indent=2)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)