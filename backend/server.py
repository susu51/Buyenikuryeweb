from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import hashlib
import secrets
from enum import Enum
import shutil
import aiofiles
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / 'vehicles').mkdir(exist_ok=True)
(UPLOAD_DIR / 'licenses').mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'fallback-secret-key')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRE_MINUTES', 30))

# Simple password hashing using SHA256 + salt
security = HTTPBearer()

# Create the main app
app = FastAPI(title="Mobil Kargo Admin Panel API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Helper functions
async def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    """Save uploaded file and return the file path"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOAD_DIR / subfolder / unique_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as buffer:
        content = await file.read()
        await buffer.write(content)
    
    # Optimize image
    try:
        with Image.open(file_path) as img:
            # Resize if too large
            if img.width > 1024 or img.height > 1024:
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                img.save(file_path, optimize=True, quality=85)
    except Exception as e:
        logger.warning(f"Could not optimize image {file_path}: {e}")
    
    return f"uploads/{subfolder}/{unique_filename}"

# Enums
class VehicleType(str, Enum):
    CAR = "araba"
    MOTORCYCLE = "motosiklet" 
    ELECTRIC_MOTORCYCLE = "elektrikli_motosiklet"
    BICYCLE = "bisiklet"

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    MODERATOR = "moderator"
    COURIER = "kurye"

class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    full_name: str
    role: UserRole = UserRole.USER
    status: UserStatus = UserStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # Courier specific fields
    phone: Optional[str] = None
    address: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    vehicle_photo: Optional[str] = None
    license_photo: Optional[str] = None

class CourierCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    phone: str
    address: Optional[str] = None
    vehicle_type: VehicleType
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    role: UserRole = UserRole.USER

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: User

class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    new_users_today: int
    total_admins: int
    system_status: str
    total_couriers: Optional[int] = None
    total_businesses: Optional[int] = None
    total_customers: Optional[int] = None
    total_orders: Optional[int] = None
    pending_orders: Optional[int] = None
    active_orders: Optional[int] = None
    delivered_today: Optional[int] = None
    total_commission: Optional[float] = None

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    business_id: str
    courier_id: Optional[str] = None
    pickup_address: str
    delivery_address: str
    delivery_fee: float
    commission_rate: float = 0.1
    status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None
    customer_name: Optional[str] = None
    business_name: Optional[str] = None
    courier_name: Optional[str] = None

# Authentication Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Extract salt from stored hash (format: salt:hash)
        salt, stored_hash = hashed_password.split(':', 1)
        # Hash the plain password with the same salt
        test_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
        return test_hash == stored_hash
    except (ValueError, AttributeError):
        return False

def get_password_hash(password: str) -> str:
    # Generate random salt
    salt = secrets.token_hex(16)
    # Hash password with salt
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    # Return format: salt:hash
    return f"{salt}:{password_hash}"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(user_id: str = Depends(verify_token)):
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return User(**user)

async def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

# Initialize admin user
async def create_admin_user():
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        admin_user = User(
            email=admin_email,
            username="admin",
            full_name="System Administrator",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE
        )
        
        # Store user with hashed password separately
        user_with_password = {
            **admin_user.dict(),
            "password_hash": get_password_hash(admin_password)
        }
        
        await db.users.insert_one(user_with_password)
        print(f"Admin user created: {admin_email}")

# API Routes
@api_router.post("/admin/login", response_model=Token)
async def admin_login(login_data: AdminLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if user["role"] != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin privileges required."
        )
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    access_token_expires = timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(**user)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_obj
    )

@api_router.get("/admin/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_admin: User = Depends(get_current_admin_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": UserStatus.ACTIVE})
    new_users_today = await db.users.count_documents({"created_at": {"$gte": today}})
    total_admins = await db.users.count_documents({"role": UserRole.ADMIN})
    
    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        new_users_today=new_users_today,
        total_admins=total_admins,
        system_status="operational"
    )

@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(
    skip: int = 0, 
    limit: int = 100,
    current_admin: User = Depends(get_current_admin_user)
):
    users = await db.users.find().skip(skip).limit(limit).to_list(limit)
    return [User(**user) for user in users]

@api_router.post("/admin/couriers", response_model=User)
async def create_courier(
    courier_data: CourierCreate,
    current_admin: User = Depends(get_current_admin_user)
):
    # Check if user already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": courier_data.email},
            {"username": courier_data.username}
        ]
    })
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Create new courier
    courier = User(
        email=courier_data.email,
        username=courier_data.username,
        full_name=courier_data.full_name,
        phone=courier_data.phone,
        address=courier_data.address,
        vehicle_type=courier_data.vehicle_type,
        role=UserRole.COURIER
    )
    
    courier_with_password = {
        **courier.dict(),
        "password_hash": get_password_hash(courier_data.password)
    }
    
    await db.users.insert_one(courier_with_password)
    return courier

@api_router.post("/admin/couriers/{courier_id}/upload-vehicle-photo")
async def upload_vehicle_photo(
    courier_id: str,
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user)
):
    # Check if courier exists
    courier = await db.users.find_one({"id": courier_id, "role": "kurye"})
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    
    # Check vehicle type - bicycle doesn't need vehicle photo
    if courier.get("vehicle_type") == VehicleType.BICYCLE:
        raise HTTPException(status_code=400, detail="Bicycle couriers don't need vehicle photos")
    
    # Save file
    file_path = await save_uploaded_file(file, "vehicles")
    
    # Update courier record
    await db.users.update_one(
        {"id": courier_id},
        {"$set": {"vehicle_photo": file_path, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Vehicle photo uploaded successfully", "file_path": file_path}

@api_router.post("/admin/couriers/{courier_id}/upload-license-photo") 
async def upload_license_photo(
    courier_id: str,
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user)
):
    # Check if courier exists
    courier = await db.users.find_one({"id": courier_id, "role": "kurye"})
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    
    # Check vehicle type - bicycle doesn't need license
    if courier.get("vehicle_type") == VehicleType.BICYCLE:
        raise HTTPException(status_code=400, detail="Bicycle couriers don't need driver's license")
    
    # Save file
    file_path = await save_uploaded_file(file, "licenses")
    
    # Update courier record
    await db.users.update_one(
        {"id": courier_id},
        {"$set": {"license_photo": file_path, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "License photo uploaded successfully", "file_path": file_path}

@api_router.delete("/admin/couriers/{courier_id}/vehicle-photo")
async def delete_vehicle_photo(
    courier_id: str,
    current_admin: User = Depends(get_current_admin_user)
):
    courier = await db.users.find_one({"id": courier_id, "role": "kurye"})
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    
    if courier.get("vehicle_photo"):
        # Delete file from filesystem
        file_path = ROOT_DIR / courier["vehicle_photo"]
        if file_path.exists():
            file_path.unlink()
        
        # Update database
        await db.users.update_one(
            {"id": courier_id},
            {"$unset": {"vehicle_photo": ""}, "$set": {"updated_at": datetime.utcnow()}}
        )
    
    return {"message": "Vehicle photo deleted successfully"}

@api_router.delete("/admin/couriers/{courier_id}/license-photo")
async def delete_license_photo(
    courier_id: str,
    current_admin: User = Depends(get_current_admin_user)
):
    courier = await db.users.find_one({"id": courier_id, "role": "kurye"})
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    
    if courier.get("license_photo"):
        # Delete file from filesystem
        file_path = ROOT_DIR / courier["license_photo"]
        if file_path.exists():
            file_path.unlink()
        
        # Update database
        await db.users.update_one(
            {"id": courier_id},
            {"$unset": {"license_photo": ""}, "$set": {"updated_at": datetime.utcnow()}}
        )
    
    return {"message": "License photo deleted successfully"}

@api_router.post("/admin/users", response_model=User)
async def create_user(
    user_data: UserCreate,
    current_admin: User = Depends(get_current_admin_user)
):
    # Check if user already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": user_data.email},
            {"username": user_data.username}
        ]
    })
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    user_with_password = {
        **user.dict(),
        "password_hash": get_password_hash(user_data.password)
    }
    
    await db.users.insert_one(user_with_password)
    return user
async def get_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user)
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return User(**user)

@api_router.put("/admin/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_admin: User = Depends(get_current_admin_user)
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@api_router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user)
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deleting themselves
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}

@api_router.get("/admin/dashboard/kargo-stats", response_model=DashboardStats)
async def get_kargo_dashboard_stats(current_admin: User = Depends(get_current_admin_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Toplam kullanıcı sayıları
    total_couriers = await db.users.count_documents({"role": "kurye"})
    total_businesses = await db.users.count_documents({"role": "isletme"}) 
    total_customers = await db.users.count_documents({"role": "musteri"})
    total_users = total_couriers + total_businesses + total_customers
    
    # Sipariş istatistikleri
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    active_orders = await db.orders.count_documents({"status": {"$in": ["assigned", "picked_up", "in_transit"]}})
    delivered_today = await db.orders.count_documents({
        "status": "delivered",
        "delivered_at": {"$gte": today}
    })
    
    # Gelir hesaplaması (komisyon)
    pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "total_commission": {"$sum": {"$multiply": ["$delivery_fee", "$commission_rate"]}}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(None)
    total_commission = revenue_result[0]["total_commission"] if revenue_result else 0
    
    return {
        "total_users": total_users,
        "total_couriers": total_couriers,
        "total_businesses": total_businesses, 
        "total_customers": total_customers,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "active_orders": active_orders,
        "delivered_today": delivered_today,
        "total_commission": round(total_commission, 2),
        "system_status": "operational"
    }

@api_router.get("/admin/orders", response_model=List[Order])
async def get_all_orders(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    current_admin: User = Depends(get_current_admin_user)
):
    query = {}
    if status:
        query["status"] = status
        
    orders_cursor = db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = await orders_cursor.to_list(limit)
    
    # Kullanıcı bilgilerini de ekle
    for order in orders:
        customer = await db.users.find_one({"_id": order["customer_id"]})
        business = await db.users.find_one({"_id": order["business_id"]})
        courier = await db.users.find_one({"_id": order["courier_id"]}) if order.get("courier_id") else None
        
        order["customer_name"] = customer.get("full_name", "Bilinmiyor") if customer else "Bilinmiyor"
        order["business_name"] = business.get("business_name", business.get("full_name", "Bilinmiyor")) if business else "Bilinmiyor"
        order["courier_name"] = courier.get("full_name", "Atanmamış") if courier else "Atanmamış"
    
    return [Order(**{**order, "id": order["_id"]}) for order in orders]

@api_router.put("/admin/orders/{order_id}/cancel")
async def admin_cancel_order(
    order_id: str,
    current_admin: User = Depends(get_current_admin_user)
):
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    
    if order["status"] in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Bu sipariş iptal edilemez")
    
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow(), "cancelled_by": "admin"}}
    )
    
    return {"message": "Sipariş admin tarafından iptal edildi"}

@api_router.get("/admin/couriers", response_model=List[User])
async def get_all_couriers(current_admin: User = Depends(get_current_admin_user)):
    couriers_cursor = db.users.find({"role": "kurye"}).sort("created_at", -1)
    couriers = await couriers_cursor.to_list(None)
    
    # Her kurye için istatistik bilgileri ekle
    for courier in couriers:
        completed_orders = await db.orders.count_documents({
            "courier_id": courier["_id"],
            "status": "delivered"
        })
        courier["completed_orders"] = completed_orders
        
        # Son konum bilgisi
        last_location = await db.courier_locations.find_one(
            {"courier_id": courier["_id"]},
            sort=[("timestamp", -1)]
        )
        courier["last_location"] = last_location
        
        # Ensure all courier fields are present
        courier.setdefault("phone", "")
        courier.setdefault("address", "")
        courier.setdefault("vehicle_type", None)
        courier.setdefault("vehicle_photo", None)
        courier.setdefault("license_photo", None)
    
    return [User(**{**courier, "id": courier.get("id", courier.get("_id"))}) for courier in couriers]

@api_router.get("/admin/businesses", response_model=List[User])
async def get_all_businesses(current_admin: User = Depends(get_current_admin_user)):
    businesses_cursor = db.users.find({"role": "isletme"}).sort("created_at", -1)
    businesses = await businesses_cursor.to_list(None)
    
    # Her işletme için sipariş sayısını ekle
    for business in businesses:
        order_count = await db.orders.count_documents({"business_id": business["_id"]})
        business["order_count"] = order_count
    
    return [User(**{**business, "id": business["_id"]}) for business in businesses]

@api_router.put("/admin/users/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user)
):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    new_status = not user.get("is_active", True)
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"is_active": new_status}}
    )
    
    status_text = "aktif" if new_status else "pasif"
    return {"message": f"Kullanıcı {status_text} duruma getirildi"}

@api_router.get("/admin/financial-report")
async def get_financial_report(current_admin: User = Depends(get_current_admin_user)):
    # Komisyon gelirleri
    pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {
            "_id": {
                "month": {"$month": "$delivered_at"},
                "year": {"$year": "$delivered_at"}
            },
            "total_revenue": {"$sum": {"$multiply": ["$delivery_fee", "$commission_rate"]}},
            "order_count": {"$sum": 1}
        }},
        {"$sort": {"_id.year": -1, "_id.month": -1}}
    ]
    
    monthly_revenue = await db.orders.aggregate(pipeline).to_list(None)
    
    return {
        "monthly_revenue": monthly_revenue,
        "total_orders_delivered": sum(item["order_count"] for item in monthly_revenue),
        "total_commission_earned": sum(item["total_revenue"] for item in monthly_revenue)
    }

# Original routes
@api_router.get("/")
async def root():
    return {"message": "Admin Panel API"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    await create_admin_user()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()