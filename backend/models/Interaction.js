import mongoose from "mongoose";

const interactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
    index: true
  },
  interactionType: {
    type: String,
    enum: ['view', 'rating'],
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    // Rating chỉ bắt buộc khi interactionType là 'rating'
    validate: {
      validator: function(value) {
        if (this.interactionType === 'rating') {
          return value != null && value >= 1 && value <= 5;
        }
        return true;
      },
      message: 'Rating must be between 1 and 5 when interaction type is rating'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Metadata bổ sung
  metadata: {
    deviceType: String,      // 'mobile', 'desktop', 'tablet'
    sessionId: String,       // Session tracking
    duration: Number,        // Thời gian xem (giây) - cho view
    completionRate: Number   // % phim đã xem - cho view
  }
}, {
  timestamps: true  // Tự động thêm createdAt và updatedAt
});

// Compound index để tối ưu queries
interactionSchema.index({ userId: 1, movieId: 1 });
interactionSchema.index({ userId: 1, interactionType: 1 });
interactionSchema.index({ movieId: 1, interactionType: 1 });
interactionSchema.index({ timestamp: -1 });

// Virtual để tính interaction strength (có thể dùng cho recommendation scoring)
interactionSchema.virtual('interactionStrength').get(function() {
  if (this.interactionType === 'rating') {
    return this.rating / 5; // Normalize to 0-1
  } else if (this.interactionType === 'view') {
    // View strength dựa trên completion rate
    return this.metadata?.completionRate 
      ? this.metadata.completionRate / 100 
      : 0.5; // Default 0.5 nếu không có data
  }
  return 0;
});

// Static method: Lấy tất cả interactions của một user
interactionSchema.statics.getUserInteractions = async function(userId, type = null) {
  const query = { userId };
  if (type) {
    query.interactionType = type;
  }
  return this.find(query).populate('movieId').sort({ timestamp: -1 });
};

// Static method: Lấy tất cả interactions của một movie
interactionSchema.statics.getMovieInteractions = async function(movieId, type = null) {
  const query = { movieId };
  if (type) {
    query.interactionType = type;
  }
  return this.find(query).populate('userId').sort({ timestamp: -1 });
};

// Static method: Lấy rating trung bình của một movie
interactionSchema.statics.getAverageRating = async function(movieId) {
  const result = await this.aggregate([
    { 
      $match: { 
        movieId: new mongoose.Types.ObjectId(movieId),  // ✅ Fixed: thêm 'new'
        interactionType: 'rating'
      } 
    },
    { 
      $group: { 
        _id: '$movieId',
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      } 
    }
  ]);
  
  return result.length > 0 
    ? { average: result[0].averageRating, count: result[0].totalRatings }
    : { average: 0, count: 0 };
};

// Static method: Kiểm tra xem user đã có interaction với movie chưa
interactionSchema.statics.hasInteraction = async function(userId, movieId, type) {
  const interaction = await this.findOne({ userId, movieId, interactionType: type });
  return !!interaction;
};

// Static method: Export data cho ML training
interactionSchema.statics.exportForML = async function(startDate = null, endDate = null) {
  const query = {};
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .select('userId movieId interactionType rating timestamp metadata')
    .lean();
};

// Instance method: Update hoặc upsert interaction
interactionSchema.statics.upsertInteraction = async function(interactionData) {
  const { userId, movieId, interactionType, rating, metadata } = interactionData;
  
  // Tìm interaction hiện tại
  const existing = await this.findOne({ userId, movieId, interactionType });
  
  if (existing) {
    // Update nếu đã tồn tại
    existing.rating = rating || existing.rating;
    existing.metadata = { ...existing.metadata, ...metadata };
    existing.timestamp = new Date();
    return existing.save();
  } else {
    // Tạo mới nếu chưa tồn tại
    return this.create(interactionData);
  }
};

// Pre-save hook: Validate rating khi cần
interactionSchema.pre('save', function(next) {
  if (this.interactionType === 'rating' && !this.rating) {
    return next(new Error('Rating is required for rating interaction type'));
  }
  next();
});

const Interaction = mongoose.model('Interaction', interactionSchema);

export default Interaction;