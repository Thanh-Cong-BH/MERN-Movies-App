import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware xác thực JWT token
const authenticate = async (req, res, next) => {
  try {
    // ✅ Lấy token từ cookie 'jwt' HOẶC từ header Authorization
    let token = req.cookies?.jwt;  // Đọc từ cookie trước
    
    // Fallback: nếu không có cookie, thử lấy từ header
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token, access denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Tìm user từ decoded token
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found, authorization denied'
      });
    }

    // Gắn user vào request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid',
      error: error.message
    });
  }
};

// Middleware kiểm tra quyền admin
const authorizeAdmin = async (req, res, next) => {
  try {
    // Chạy auth middleware trước
    await authenticate(req, res, () => {});

    if (req.user && req.user.role !== 'admin' && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error in admin authentication',
      error: error.message
    });
  }
};

export { authenticate, authorizeAdmin };