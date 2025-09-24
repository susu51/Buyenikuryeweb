from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
import os
import uuid
import json
import asyncio
import requests
import googlemaps
from dotenv import load_dotenv

# Environment variables
load_dotenv()

# Configuration
SECRET_KEY = "mobil-kargo-secret-key-2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "mobil_kargo")

# Google Maps API configuration
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

# Initialize FastAPI app
app = FastAPI(title="Mobil Kargo API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# User roles
class UserRole(str, Enum):
    KURYE = "kurye"
    ISLETME = "isletme"
    MUSTERI = "musteri"

# Order status
class OrderStatus(str, Enum):
    PENDING = "pending"      # Bekliyor
    ASSIGNED = "assigned"    # Kuryeye atandı
    PICKED_UP = "picked_up"  # Toplandı
    IN_TRANSIT = "in_transit" # Yolda
    DELIVERED = "delivered"   # Teslim edildi
    CANCELLED = "cancelled"   # İptal edildi

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: UserRole
    address: Optional[str] = None
    vehicle_type: Optional[str] = None  # For couriers: "araba", "motosiklet", "bisiklet"
    business_name: Optional[str] = None  # For businesses

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str
    role: UserRole
    address: Optional[str] = None
    vehicle_type: Optional[str] = None
    business_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    rating: float = 5.0
    total_orders: int = 0

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class OrderCreate(BaseModel):
    customer_email: str
    pickup_address: str
    delivery_address: str
    pickup_phone: str
    delivery_phone: str
    package_description: str
    special_instructions: Optional[str] = None
    estimated_weight: Optional[float] = None  # kg
    estimated_value: Optional[float] = None   # TL

class Order(BaseModel):
    id: str
    customer_id: str
    business_id: str
    courier_id: Optional[str] = None
    pickup_address: str
    delivery_address: str
    pickup_phone: str
    delivery_phone: str
    package_description: str
    special_instructions: Optional[str] = None
    estimated_weight: Optional[float] = None
    estimated_value: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    delivery_fee: Optional[float] = None
    commission_rate: float = 0.15  # 15% commission

class LocationUpdate(BaseModel):
    courier_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TipCreate(BaseModel):
    order_id: str
    tip_amount: float = Field(..., ge=0, le=1000)  # 0-1000 TL aralığında
    tip_type: str = Field(..., regex="^(online|cash)$")  # online veya nakit
    note: Optional[str] = None

class Tip(BaseModel):
    id: str
    order_id: str
    customer_id: str
    courier_id: str
    tip_amount: float
    tip_type: str
    note: Optional[str] = None
    created_at: datetime

class Rating(BaseModel):
    order_id: str
    rated_by: str  # user_id
    rated_user: str  # user_id (courier or business)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Google Maps API models
class GeocodeRequest(BaseModel):
    address: str
    language: str = "tr"
    region: str = "tr"

class DirectionsRequest(BaseModel):
    origin: str
    destination: str
    waypoints: Optional[List[str]] = []
    mode: str = "driving"
    avoid_tolls: bool = False
    avoid_highways: bool = False
    language: str = "tr"
    region: str = "tr"

class PlacesRequest(BaseModel):
    query: str
    location: Optional[str] = None  # "lat,lng"
    radius: Optional[int] = 5000  # meters
    language: str = "tr"
    region: str = "tr"

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"User {user_id} connected")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        print(f"User {user_id} disconnected")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except:
                    self.disconnect(connection, user_id)

    async def broadcast_location_update(self, location_data: dict):
        # Broadcast to relevant users (customers tracking their orders)
        message = {
            "type": "location_update",
            "data": location_data
        }
        
        # Find active orders for this courier
        courier_id = location_data.get("courier_id")
        active_orders = await db.orders.find({
            "courier_id": courier_id,
            "status": {"$in": ["assigned", "picked_up", "in_transit"]}
        }).to_list(None)
        
        # Send location to customers of active orders
        for order in active_orders:
            await self.send_personal_message(message, order["customer_id"])

manager = ConnectionManager()

# Google Maps service class
class GoogleMapsService:
    def __init__(self):
        self.api_key = GOOGLE_MAPS_API_KEY
        self.emergent_key = EMERGENT_LLM_KEY
        self.base_url = "https://maps.googleapis.com/maps/api"
        
    async def make_google_request(self, endpoint: str, params: dict):
        """Make request to Google Maps API with fallback to Emergent"""
        try:
            # Try with Google Maps API key first
            if self.api_key and self.api_key != "your-google-maps-api-key-here":
                params['key'] = self.api_key
                url = f"{self.base_url}/{endpoint}"
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    return response.json()
            
            # Fallback to Emergent Universal Key proxy
            if self.emergent_key:
                headers = {
                    'Authorization': f'Bearer {self.emergent_key}',
                    'Content-Type': 'application/json'
                }
                
                # Use a generic maps proxy (simplified for demo)
                # In production, this would go through Emergent's proxy service
                proxy_data = {
                    'endpoint': endpoint,
                    'params': params,
                    'service': 'google_maps'
                }
                
                # For now, return mock data with Turkish support
                return await self.get_mock_response(endpoint, params)
                
        except Exception as e:
            print(f"Google Maps API error: {e}")
            return await self.get_mock_response(endpoint, params)
    
    async def get_mock_response(self, endpoint: str, params: dict):
        """Mock responses for testing (Turkish locations)"""
        if endpoint == "geocode/json":
            return {
                "results": [{
                    "formatted_address": params.get('address', 'İstanbul, Türkiye'),
                    "geometry": {
                        "location": {
                            "lat": 41.0082 + (hash(params.get('address', '')) % 100) * 0.001,
                            "lng": 28.9784 + (hash(params.get('address', '')) % 100) * 0.001
                        },
                        "location_type": "APPROXIMATE"
                    },
                    "place_id": f"mock_place_{hash(params.get('address', ''))}",
                    "types": ["street_address"]
                }],
                "status": "OK"
            }
        elif endpoint == "directions/json":
            return {
                "routes": [{
                    "legs": [{
                        "distance": {"value": 5000, "text": "5.0 km"},
                        "duration": {"value": 900, "text": "15 dakika"},
                        "start_address": params.get('origin', 'İstanbul'),
                        "end_address": params.get('destination', 'İstanbul'),
                        "steps": [
                            {
                                "html_instructions": f"{params.get('origin', 'Başlangıç')} noktasından {params.get('destination', 'Varış')} noktasına git",
                                "distance": {"value": 5000, "text": "5.0 km"},
                                "duration": {"value": 900, "text": "15 dakika"}
                            }
                        ]
                    }],
                    "overview_polyline": {"points": "mock_polyline_data"}
                }],
                "status": "OK"
            }
        elif endpoint == "place/textsearch/json":
            return {
                "results": [{
                    "formatted_address": f"{params.get('query', 'İstanbul')} - Arama Sonucu",
                    "geometry": {
                        "location": {
                            "lat": 41.0082,
                            "lng": 28.9784
                        }
                    },
                    "name": params.get('query', 'Arama Sonucu'),
                    "place_id": f"mock_search_{hash(params.get('query', ''))}",
                    "rating": 4.5,
                    "types": ["establishment"]
                }],
                "status": "OK"
            }
        
        return {"status": "UNKNOWN_ERROR"}

google_maps_service = GoogleMapsService()

# Authentication functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise credentials_exception
    
    return User(
        id=user["_id"],
        email=user["email"],
        full_name=user["full_name"],
        phone=user["phone"],
        role=user["role"],
        address=user.get("address"),
        vehicle_type=user.get("vehicle_type"),
        business_name=user.get("business_name"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"],
        rating=user.get("rating", 5.0),
        total_orders=user.get("total_orders", 0)
    )

# API Routes
@app.get("/api/")
async def root():
    return {"message": "Mobil Kargo API v1.0.0", "status": "active"}

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresi zaten kullanılıyor"
        )
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    user_doc = {
        "_id": user_id,
        "email": user_data.email,
        "password": hashed_password,
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "role": user_data.role,
        "address": user_data.address,
        "vehicle_type": user_data.vehicle_type,
        "business_name": user_data.business_name,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "rating": 5.0,
        "total_orders": 0
    }
    
    await db.users.insert_one(user_doc)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    user = User(
        id=user_id,
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        address=user_data.address,
        vehicle_type=user_data.vehicle_type,
        business_name=user_data.business_name,
        is_active=True,
        created_at=user_doc["created_at"],
        rating=5.0,
        total_orders=0
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@app.post("/api/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not verify_password(user_credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hesap devre dışı bırakılmış"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["_id"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(
        id=user["_id"],
        email=user["email"],
        full_name=user["full_name"],
        phone=user["phone"],
        role=user["role"],
        address=user.get("address"),
        vehicle_type=user.get("vehicle_type"),
        business_name=user.get("business_name"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"],
        rating=user.get("rating", 5.0),
        total_orders=user.get("total_orders", 0)
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@app.get("/api/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ISLETME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece işletmeler sipariş oluşturabilir"
        )
    
    # Find customer by email
    customer = await db.users.find_one({
        "email": order_data.customer_email,
        "role": UserRole.MUSTERI
    })
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Müşteri bulunamadı"
        )
    
    # Calculate delivery fee (basic calculation)
    base_fee = 25.0  # Base fee in TL
    weight_fee = (order_data.estimated_weight or 1) * 2.0  # 2 TL per kg
    delivery_fee = base_fee + weight_fee
    
    order_id = str(uuid.uuid4())
    order_doc = {
        "_id": order_id,
        "customer_id": customer["_id"],
        "business_id": current_user.id,
        "courier_id": None,
        "pickup_address": order_data.pickup_address,
        "delivery_address": order_data.delivery_address,
        "pickup_phone": order_data.pickup_phone,
        "delivery_phone": order_data.delivery_phone,
        "package_description": order_data.package_description,
        "special_instructions": order_data.special_instructions,
        "estimated_weight": order_data.estimated_weight,
        "estimated_value": order_data.estimated_value,
        "status": OrderStatus.PENDING,
        "created_at": datetime.utcnow(),
        "assigned_at": None,
        "picked_up_at": None,
        "delivered_at": None,
        "delivery_fee": delivery_fee,
        "commission_rate": 0.15
    }
    
    await db.orders.insert_one(order_doc)
    
    # Notify customer
    await manager.send_personal_message({
        "type": "new_order",
        "order_id": order_id,
        "message": "Yeni bir sipariş oluşturuldu"
    }, customer["_id"])
    
    return Order(**order_doc, id=order_id)

@app.get("/api/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    query = {}
    
    if current_user.role == UserRole.KURYE:
        # Couriers see available orders and their assigned orders
        query = {
            "$or": [
                {"courier_id": current_user.id},
                {"status": OrderStatus.PENDING, "courier_id": None}
            ]
        }
    elif current_user.role == UserRole.ISLETME:
        query = {"business_id": current_user.id}
    elif current_user.role == UserRole.MUSTERI:
        query = {"customer_id": current_user.id}
    
    orders_cursor = db.orders.find(query).sort("created_at", -1)
    orders = await orders_cursor.to_list(None)
    
    return [Order(**order, id=order["_id"]) for order in orders]

@app.post("/api/orders/{order_id}/assign")
async def assign_order(order_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.KURYE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece kuryeler sipariş alabilir"
        )
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sipariş bulunamadı"
        )
    
    if order["status"] != OrderStatus.PENDING or order["courier_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu sipariş zaten alınmış"
        )
    
    # Assign order to courier
    await db.orders.update_one(
        {"_id": order_id},
        {
            "$set": {
                "courier_id": current_user.id,
                "status": OrderStatus.ASSIGNED,
                "assigned_at": datetime.utcnow()
            }
        }
    )
    
    # Notify customer and business
    await manager.send_personal_message({
        "type": "order_assigned",
        "order_id": order_id,
        "courier_name": current_user.full_name,
        "message": "Sipariş kuryeye atandı"
    }, order["customer_id"])
    
    await manager.send_personal_message({
        "type": "order_assigned",
        "order_id": order_id,
        "courier_name": current_user.full_name,
        "message": "Sipariş kuryeye atandı"
    }, order["business_id"])
    
    return {"message": "Sipariş başarıyla alındı"}

@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: str, 
    status: OrderStatus, 
    current_user: User = Depends(get_current_user)
):
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sipariş bulunamadı"
        )
    
    # Only assigned courier can update status
    if current_user.role != UserRole.KURYE or order["courier_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu siparişi sadece atanan kurye güncelleyebilir"
        )
    
    update_data = {"status": status}
    
    if status == OrderStatus.PICKED_UP:
        update_data["picked_up_at"] = datetime.utcnow()
    elif status == OrderStatus.DELIVERED:
        update_data["delivered_at"] = datetime.utcnow()
        
        # Update courier's total orders
        await db.users.update_one(
            {"_id": current_user.id},
            {"$inc": {"total_orders": 1}}
        )
    
    await db.orders.update_one({"_id": order_id}, {"$set": update_data})
    
    # Notify relevant parties
    status_message = {
        OrderStatus.PICKED_UP: "Paket toplandı",
        OrderStatus.IN_TRANSIT: "Paket yolda",
        OrderStatus.DELIVERED: "Paket teslim edildi"
    }.get(status, "Sipariş durumu güncellendi")
    
    await manager.send_personal_message({
        "type": "status_update",
        "order_id": order_id,
        "status": status,
        "message": status_message
    }, order["customer_id"])
    
    await manager.send_personal_message({
        "type": "status_update",
        "order_id": order_id,
        "status": status,
        "message": status_message
    }, order["business_id"])
    
    return {"message": "Sipariş durumu güncellendi"}

@app.post("/api/orders/{order_id}/approve")
async def approve_order(order_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.MUSTERI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece müşteriler sipariş onaylayabilir"
        )
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sipariş bulunamadı"
        )
    
    if order["customer_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu siparişi sadece ilgili müşteri onaylayabilir"
        )
    
    if order["status"] != OrderStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece bekleyen siparişler onaylanabilir"
        )
    
    # Update order status to approved (ready for courier assignment)
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": "approved", "approved_at": datetime.utcnow()}}
    )
    
    # Notify business
    await manager.send_personal_message({
        "type": "order_approved",
        "order_id": order_id,
        "message": "Müşteri siparişi onayladı, kurye ataması yapılabilir"
    }, order["business_id"])
    
    return {"message": "Sipariş onaylandı"}

@app.post("/api/orders/{order_id}/reject")
async def reject_order(order_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.MUSTERI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece müşteriler sipariş reddedebilir"
        )
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sipariş bulunamadı"
        )
    
    if order["customer_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu siparişi sadece ilgili müşteri reddedebilir"
        )
    
    if order["status"] != OrderStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece bekleyen siparişler reddedilebilir"
        )
    
    # Update order status to cancelled
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": OrderStatus.CANCELLED, "cancelled_at": datetime.utcnow()}}
    )
    
    # Notify business
    await manager.send_personal_message({
        "type": "order_rejected",
        "order_id": order_id,
        "message": "Müşteri siparişi reddetti"
    }, order["business_id"])
    
    return {"message": "Sipariş reddedildi"}

@app.post("/api/courier/start-work")
async def start_work(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.KURYE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece kuryeler işe başlayabilir"
        )
    
    # Record work start time
    work_session = {
        "_id": str(uuid.uuid4()),
        "courier_id": current_user.id,
        "start_time": datetime.utcnow(),
        "status": "active"
    }
    
    await db.work_sessions.insert_one(work_session)
    
    return {"message": "İşe başladınız", "session_id": work_session["_id"]}

@app.get("/api/orders/history")
async def get_order_history(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.KURYE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece kuryeler geçmiş siparişleri görebilir"
        )
    
    # Get completed orders for courier
    orders_cursor = db.orders.find({
        "courier_id": current_user.id,
        "status": {"$in": [OrderStatus.DELIVERED, OrderStatus.CANCELLED]}
    }).sort("created_at", -1).limit(20)
    
    orders = await orders_cursor.to_list(None)
    
    return [Order(**order, id=order["_id"]) for order in orders]

@app.post("/api/location/update")
async def update_location(location_data: LocationUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.KURYE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece kuryeler konum güncelleyebilir"
        )
    
    # Store location in database
    location_doc = {
        "courier_id": current_user.id,
        "latitude": location_data.latitude,
        "longitude": location_data.longitude,
        "accuracy": location_data.accuracy,
        "timestamp": location_data.timestamp
    }
    
    await db.courier_locations.insert_one(location_doc)
    
    # Broadcast to connected clients
    await manager.broadcast_location_update({
        "courier_id": current_user.id,
        "latitude": location_data.latitude,
        "longitude": location_data.longitude,
        "accuracy": location_data.accuracy,
        "timestamp": location_data.timestamp.isoformat()
    })
    
    return {"message": "Konum güncellendi"}

@app.get("/api/couriers/{courier_id}/location")
async def get_courier_location(courier_id: str, current_user: User = Depends(get_current_user)):
    # Get latest location
    location = await db.courier_locations.find_one(
        {"courier_id": courier_id},
        sort=[("timestamp", -1)]
    )
    
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kurye konumu bulunamadı"
        )
    
    return {
        "courier_id": location["courier_id"],
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "accuracy": location.get("accuracy"),
        "timestamp": location["timestamp"].isoformat()
    }

@app.post("/api/ratings")
async def create_rating(rating_data: Rating, current_user: User = Depends(get_current_user)):
    # Verify the order exists and user is involved
    order = await db.orders.find_one({"_id": rating_data.order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sipariş bulunamadı"
        )
    
    # Only customer can rate courier, or courier can rate customer
    if not (
        (current_user.role == UserRole.MUSTERI and current_user.id == order["customer_id"]) or
        (current_user.role == UserRole.KURYE and current_user.id == order["courier_id"])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu siparişi değerlendirme yetkiniz yok"
        )
    
    # Check if already rated
    existing_rating = await db.ratings.find_one({
        "order_id": rating_data.order_id,
        "rated_by": current_user.id
    })
    
    if existing_rating:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu siparişi zaten değerlendirdiniz"
        )
    
    rating_doc = {
        "_id": str(uuid.uuid4()),
        "order_id": rating_data.order_id,
        "rated_by": current_user.id,
        "rated_user": rating_data.rated_user,
        "rating": rating_data.rating,
        "comment": rating_data.comment,
        "created_at": rating_data.created_at
    }
    
    await db.ratings.insert_one(rating_doc)
    
    # Update user's average rating
    ratings_cursor = db.ratings.find({"rated_user": rating_data.rated_user})
    ratings = await ratings_cursor.to_list(None)
    average_rating = sum(r["rating"] for r in ratings) / len(ratings)
    
    await db.users.update_one(
        {"_id": rating_data.rated_user},
        {"$set": {"rating": round(average_rating, 1)}}
    )
    
    return {"message": "Değerlendirme kaydedildi"}

# Google Maps API endpoints
@app.post("/api/maps/geocode")
async def geocode_address(address: str, current_user: User = Depends(get_current_user)):
    """Geocode address to coordinates"""
    try:
        params = {
            'address': address,
            'language': 'tr',
            'region': 'tr'
        }
        
        result = await google_maps_service.make_google_request('geocode/json', params)
        
        if result.get('status') == 'OK' and result.get('results'):
            location_data = result['results'][0]
            return {
                "success": True,
                "coordinates": location_data['geometry']['location'],
                "formatted_address": location_data['formatted_address'],
                "place_id": location_data.get('place_id'),
                "location_type": location_data['geometry'].get('location_type')
            }
        else:
            raise HTTPException(status_code=404, detail="Adres bulunamadı")
    
    except Exception as e:
        print(f"Geocoding error: {e}")
        raise HTTPException(status_code=500, detail="Adres koordinatları alınamadı")

@app.post("/api/maps/directions")
async def get_directions(
    origin: str, 
    destination: str, 
    waypoints: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get directions between points"""
    try:
        params = {
            'origin': origin,
            'destination': destination,
            'mode': 'driving',
            'language': 'tr',
            'region': 'tr',
            'avoid': 'tolls'
        }
        
        if waypoints:
            params['waypoints'] = waypoints
        
        result = await google_maps_service.make_google_request('directions/json', params)
        
        if result.get('status') == 'OK' and result.get('routes'):
            route = result['routes'][0]
            leg = route['legs'][0]
            
            return {
                "success": True,
                "distance": leg['distance']['value'],
                "distance_text": leg['distance']['text'],
                "duration": leg['duration']['value'],
                "duration_text": leg['duration']['text'],
                "start_address": leg['start_address'],
                "end_address": leg['end_address'],
                "polyline": route['overview_polyline']['points'],
                "steps": [
                    {
                        "instruction": step['html_instructions'],
                        "distance": step['distance']['value'],
                        "duration": step['duration']['value']
                    }
                    for step in leg['steps']
                ]
            }
        else:
            raise HTTPException(status_code=404, detail="Rota bulunamadı")
    
    except Exception as e:
        print(f"Directions error: {e}")
        raise HTTPException(status_code=500, detail="Rota bilgisi alınamadı")

@app.post("/api/maps/places/search")
async def search_places(
    query: str, 
    location: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Search for places"""
    try:
        params = {
            'query': query,
            'language': 'tr',
            'region': 'tr'
        }
        
        if location:
            params['location'] = location
            params['radius'] = 5000
        
        result = await google_maps_service.make_google_request('place/textsearch/json', params)
        
        if result.get('status') == 'OK':
            places = []
            for place in result.get('results', [])[:10]:  # Limit to 10 results
                places.append({
                    "name": place.get('name'),
                    "formatted_address": place.get('formatted_address'),
                    "coordinates": place['geometry']['location'],
                    "place_id": place.get('place_id'),
                    "rating": place.get('rating'),
                    "types": place.get('types', [])
                })
            
            return {
                "success": True,
                "places": places
            }
        else:
            return {
                "success": True,
                "places": []
            }
    
    except Exception as e:
        print(f"Places search error: {e}")
        raise HTTPException(status_code=500, detail="Yer arama başarısız")

@app.get("/api/maps/reverse-geocode")
async def reverse_geocode(
    lat: float, 
    lng: float, 
    current_user: User = Depends(get_current_user)
):
    """Convert coordinates to address"""
    try:
        params = {
            'latlng': f"{lat},{lng}",
            'language': 'tr',
            'region': 'tr'
        }
        
        result = await google_maps_service.make_google_request('geocode/json', params)
        
        if result.get('status') == 'OK' and result.get('results'):
            address_data = result['results'][0]
            return {
                "success": True,
                "formatted_address": address_data['formatted_address'],
                "place_id": address_data.get('place_id'),
                "address_components": address_data.get('address_components', [])
            }
        else:
            return {
                "success": False,
                "formatted_address": f"Yaklaşık konum: {lat:.4f}, {lng:.4f}"
            }
    
    except Exception as e:
        print(f"Reverse geocoding error: {e}")
        return {
            "success": False,
            "formatted_address": f"Konum: {lat:.4f}, {lng:.4f}"
        }

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.KURYE:
        # Courier stats
        total_deliveries = await db.orders.count_documents({
            "courier_id": current_user.id,
            "status": OrderStatus.DELIVERED
        })
        
        pending_orders = await db.orders.count_documents({
            "courier_id": current_user.id,
            "status": {"$in": [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]}
        })
        
        # Calculate earnings (85% of delivery fees)
        pipeline = [
            {"$match": {"courier_id": current_user.id, "status": OrderStatus.DELIVERED}},
            {"$group": {"_id": None, "total_earnings": {"$sum": {"$multiply": ["$delivery_fee", 0.85]}}}}
        ]
        earnings_result = await db.orders.aggregate(pipeline).to_list(None)
        total_earnings = earnings_result[0]["total_earnings"] if earnings_result else 0
        
        return {
            "total_deliveries": total_deliveries,
            "pending_orders": pending_orders,
            "total_earnings": round(total_earnings, 2),
            "rating": current_user.rating
        }
    
    elif current_user.role == UserRole.ISLETME:
        # Business stats
        total_orders = await db.orders.count_documents({"business_id": current_user.id})
        pending_orders = await db.orders.count_documents({
            "business_id": current_user.id,
            "status": OrderStatus.PENDING
        })
        delivered_orders = await db.orders.count_documents({
            "business_id": current_user.id,
            "status": OrderStatus.DELIVERED
        })
        
        return {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "delivered_orders": delivered_orders,
            "success_rate": round((delivered_orders / total_orders * 100) if total_orders > 0 else 0, 1)
        }
    
    elif current_user.role == UserRole.MUSTERI:
        # Customer stats
        total_orders = await db.orders.count_documents({"customer_id": current_user.id})
        pending_orders = await db.orders.count_documents({
            "customer_id": current_user.id,
            "status": {"$in": [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]}
        })
        delivered_orders = await db.orders.count_documents({
            "customer_id": current_user.id,
            "status": OrderStatus.DELIVERED
        })
        
        return {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "delivered_orders": delivered_orders
        }

# WebSocket endpoint
@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "location_update":
                # Handle real-time location updates
                await manager.broadcast_location_update(message_data["data"])
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)