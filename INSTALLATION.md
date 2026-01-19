# 🎬 MERN Movies App - Hướng dẫn cài đặt

## 📋 Yêu cầu hệ thống

| Phần mềm | Phiên bản | Link tải |
|----------|-----------|----------|
| Node.js | 18+ | https://nodejs.org/ |
| MongoDB | 7.0+ | https://www.mongodb.com/try/download/community |
| Python | 3.10+ | https://www.python.org/downloads/ |
| Git | Mới nhất | https://git-scm.com/ |

---

## 🚀 Cài đặt

### Bước 1: Cài đặt dependencies

```bash
# Backend (ở root folder)
npm install

# Frontend
cd frontend
npm install
cd ..

# Python Recommendation Service
cd recommend
pip install -r requirements.txt
cd ..
```

### Bước 2: Cấu hình môi trường

Tạo file `.env` ở thư mục root:

```env
# Database
MONGO_URI=mongodb://localhost:27017/movies-app

# JWT Secret (đặt một chuỗi bất kỳ, giữ bí mật)
JWT_SECRET=your-super-secret-key-here

# TMDB API (lấy tại https://www.themoviedb.org/settings/api)
TMDB_API_KEY=your-tmdb-api-key

# Recommendation Service
RECOMMENDATION_API_URL=http://localhost:8000
```

### Bước 3: Khởi động MongoDB

```bash
# Windows
mongod

# macOS (Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

---

## ▶️ Chạy ứng dụng

### Cách 1: Chạy tất cả cùng lúc (khuyên dùng)

Mở **3 terminal** riêng biệt:

**Terminal 1 - Backend:**
```bash
npm run backend
```

**Terminal 2 - Frontend:**
```bash
npm run frontend
```

**Terminal 3 - Recommendation Service:**
```bash
cd recommend
python app.py
```

### Cách 2: Chạy Backend + Frontend cùng lúc

```bash
npm run fullstack
```

Sau đó mở terminal khác cho Recommendation Service:
```bash
cd recommend
python app.py
```

---

## 🌐 Truy cập

| Service | URL |
|---------|-----|
| 🖥️ Frontend | http://localhost:5173 |
| 🔧 Backend API | http://localhost:3000 |
| 🤖 Recommendation API | http://localhost:8000 |

---

## 📁 Cấu trúc project

```
MERN-Movies-App/
├── backend/                 # Backend source code
│   ├── config/              # Database config
│   ├── controllers/         # Route controllers
│   ├── middlewares/         # Auth middleware
│   ├── models/              # Mongoose models
│   ├── routes/              # API routes
│   └── index.js             # Entry point
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── redux/           # Redux store & slices
│   │   └── App.jsx
│   └── package.json
│
├── recommend/               # Python recommendation service
│   ├── app.py               # FastAPI server
│   ├── requirements.txt     # Python dependencies
│   └── models/              # ML models
│       ├── lightgcn_direct.pt
│       └── id_mappings.pkl
│
├── uploads/                 # Uploaded files
├── .env                     # Environment variables
├── package.json             # Root package.json
└── README.md
```

---

## 🔧 Các lệnh hữu ích

### Sync ảnh phim từ TMDB
```bash
node backend/scripts/syncTMDB.js --limit 100
```

### Reset sync status
```bash
node backend/scripts/syncTMDB.js --reset
```

### Kiểm tra MongoDB
```bash
mongosh movies-app
db.movies.countDocuments()
db.users.find()
```

---

## ❗ Xử lý lỗi thường gặp

### 1. MongoDB connection refused
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Giải pháp:** Đảm bảo MongoDB đang chạy
```bash
mongod
```

### 2. Module not found (Python)
```
ModuleNotFoundError: No module named 'fastapi'
```
**Giải pháp:** Cài lại dependencies
```bash
cd recommend
pip install -r requirements.txt
```

### 3. Port đã được sử dụng
```
Error: listen EADDRINUSE :::3000
```
**Giải pháp:** Tắt process đang dùng port
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### 4. JWT invalid signature
**Giải pháp:** Xóa cookie và đăng nhập lại, hoặc đảm bảo JWT_SECRET không thay đổi

### 5. CORS error
**Giải pháp:** Kiểm tra backend đang chạy và URL đúng

---

## 👤 Tạo tài khoản Admin

### Cách 1: Đăng ký qua UI rồi update trong MongoDB
```bash
mongosh movies-app
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { isAdmin: true } }
)
```

### Cách 2: Tạo trực tiếp trong MongoDB
```bash
mongosh movies-app
db.users.insertOne({
  username: "admin",
  email: "admin@example.com",
  password: "<hashed-password>",
  isAdmin: true
})
```

---

## 📱 API Endpoints chính

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/users/register` | Đăng ký |
| POST | `/api/v1/users/login` | Đăng nhập |
| POST | `/api/v1/users/logout` | Đăng xuất |

### Movies
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/movies/all-movies` | Lấy tất cả phim |
| GET | `/api/v1/movies/:id` | Chi tiết phim |
| GET | `/api/v1/movies/top-movies` | Phim đánh giá cao |

### Recommendations
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/recommendation/personalized` | Gợi ý cá nhân hóa |
| GET | `/api/v1/recommendation/popular` | Phim phổ biến |

### Interactions
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/interaction/rate` | Đánh giá phim |
| GET | `/api/v1/interaction/my-ratings` | Lịch sử đánh giá |

---

## 🎯 Lưu ý khi deploy

1. **Đổi JWT_SECRET** thành chuỗi phức tạp
2. **Không commit file .env** lên git
3. **Backup database** thường xuyên
4. **Sử dụng HTTPS** cho production
5. **Đặt rate limit** cho API
