/**
 * ============================================
 * REALISTIC RECOMMENDATION ALGORITHM
 * ============================================
 * 
 * Các cơ chế điều chỉnh tốc độ "dịch chuyển":
 * 
 * 1. TIME DECAY - Ratings cũ có weight thấp hơn
 * 2. MINIMUM THRESHOLD - Cần đủ số lượng ratings mới thay đổi
 * 3. SMOOTHING - Không thay đổi đột ngột
 * 4. EXPLORATION - Giữ đa dạng, tránh filter bubble
 * 5. CONFIDENCE - Rating cao hơn = confident hơn về preference
 */

// ==================== CẤU HÌNH ====================

const CONFIG = {
  // Số ratings tối thiểu để bắt đầu personalize
  MIN_RATINGS_FOR_PERSONALIZATION: 5,
  
  // Time decay - ratings cũ giảm weight
  TIME_DECAY: {
    ENABLED: true,
    HALF_LIFE_DAYS: 30,  // Sau 30 ngày, weight giảm 50%
  },
  
  // Exploration vs Exploitation
  EXPLORATION_RATIO: 0.2,  // 20% recommendations là khám phá mới
  
  // Smoothing - giới hạn thay đổi mỗi lần
  MAX_GENRE_SHIFT_PER_SESSION: 0.3,  // Tối đa 30% thay đổi
  
  // Rating weights
  RATING_WEIGHTS: {
    5: 1.0,    // Rất thích
    4: 0.6,   // Thích
    3: 0.2,    // Bình thường (gần như không ảnh hưởng)
    2: -0.3,   // Không thích
    1: -0.6,   // Rất không thích
  },
  
  // Genre diversity - tối thiểu số genres trong recommendations
  MIN_GENRES_IN_RESULTS: 2,
  
  // Confidence threshold
  MIN_RATINGS_PER_GENRE_FOR_CONFIDENCE: 3,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Tính time decay factor
 * Ratings gần đây có weight cao hơn
 */
function calculateTimeDecay(ratingDate) {
  if (!CONFIG.TIME_DECAY.ENABLED) return 1;
  
  const now = new Date();
  const daysDiff = (now - new Date(ratingDate)) / (1000 * 60 * 60 * 24);
  const halfLife = CONFIG.TIME_DECAY.HALF_LIFE_DAYS;
  
  // Exponential decay: weight = 0.5 ^ (days / halfLife)
  return Math.pow(0.5, daysDiff / halfLife);
}

/**
 * Tính confidence score cho một genre
 * Dựa trên số lượng ratings
 */
function calculateConfidence(ratingsCount) {
  const minRatings = CONFIG.MIN_RATINGS_PER_GENRE_FOR_CONFIDENCE;
  
  if (ratingsCount >= minRatings * 2) return 1.0;      // Rất confident
  if (ratingsCount >= minRatings) return 0.7;          // Confident
  if (ratingsCount >= 2) return 0.4;                   // Ít confident
  return 0.2;                                           // Không confident
}

/**
 * Tính genre preferences với các điều chỉnh
 */
async function calculateGenrePreferences(userId, Interaction) {
  const userRatings = await Interaction.find({
    userId,
    interactionType: 'rating'
  }).populate({
    path: 'movieId',
    populate: { path: 'genre' }
  }).sort({ timestamp: -1 });

  if (userRatings.length < CONFIG.MIN_RATINGS_FOR_PERSONALIZATION) {
    return {
      hasEnoughData: false,
      totalRatings: userRatings.length,
      minRequired: CONFIG.MIN_RATINGS_FOR_PERSONALIZATION,
      preferences: []
    };
  }

  // Tính genre scores với time decay và rating weights
  const genreData = {};

  userRatings.forEach(interaction => {
    if (!interaction.movieId?.genre) return;
    
    const genreId = interaction.movieId.genre._id.toString();
    const genreName = interaction.movieId.genre.name;
    const rating = interaction.rating;
    const timestamp = interaction.timestamp || interaction.createdAt;
    
    // Các factors
    const timeDecay = calculateTimeDecay(timestamp);
    const ratingWeight = CONFIG.RATING_WEIGHTS[rating] || 0;
    
    // Combined weight
    const weight = ratingWeight * timeDecay;
    
    if (!genreData[genreId]) {
      genreData[genreId] = {
        name: genreName,
        totalWeight: 0,
        count: 0,
        ratings: [],
        recentRating: null
      };
    }
    
    genreData[genreId].totalWeight += weight;
    genreData[genreId].count++;
    genreData[genreId].ratings.push({ rating, timestamp, weight });
    
    // Track most recent
    if (!genreData[genreId].recentRating || 
        new Date(timestamp) > new Date(genreData[genreId].recentRating.timestamp)) {
      genreData[genreId].recentRating = { rating, timestamp };
    }
  });

  // Convert to array với confidence scores
  const preferences = Object.entries(genreData)
    .map(([genreId, data]) => {
      const confidence = calculateConfidence(data.count);
      const avgWeight = data.totalWeight / data.count;
      
      // Final score = average weight * confidence
      const score = avgWeight * confidence;
      
      return {
        genreId,
        name: data.name,
        score: Math.round(score * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        ratingsCount: data.count,
        avgWeight: Math.round(avgWeight * 100) / 100,
        recentRating: data.recentRating
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    hasEnoughData: true,
    totalRatings: userRatings.length,
    preferences
  };
}

/**
 * Áp dụng exploration - thêm đa dạng vào recommendations
 */
async function applyExploration(recommendations, userPreferences, Movie, ratedMovieIds) {
  const explorationCount = Math.ceil(recommendations.length * CONFIG.EXPLORATION_RATIO);
  
  if (explorationCount === 0) return recommendations;
  
  // Lấy genres user CHƯA xem nhiều
  const lowExposureGenres = userPreferences
    .filter(p => p.ratingsCount < 3)
    .map(p => p.genreId);
  
  // Nếu không có genre mới, lấy random
  let explorationMovies = [];
  
  if (lowExposureGenres.length > 0) {
    explorationMovies = await Movie.find({
      _id: { $nin: Array.from(ratedMovieIds) },
      genre: { $in: lowExposureGenres }
    })
      .sort({ averageRating: -1 })
      .limit(explorationCount)
      .populate('genre');
  } else {
    // Random từ top rated movies user chưa xem
    explorationMovies = await Movie.find({
      _id: { $nin: Array.from(ratedMovieIds) }
    })
      .sort({ averageRating: -1, totalRatings: -1 })
      .skip(Math.floor(Math.random() * 50))
      .limit(explorationCount)
      .populate('genre');
  }

  // Mix exploration vào recommendations
  const mainRecs = recommendations.slice(0, recommendations.length - explorationCount);
  
  const explorationRecs = explorationMovies.map(movie => ({
    ...movie.toObject(),
    recommendationScore: 0.5,
    isExploration: true
  }));

  // Interleave: đặt exploration movies xen kẽ
  const result = [...mainRecs];
  explorationRecs.forEach((movie, i) => {
    const insertIndex = Math.min(3 + i * 3, result.length);
    result.splice(insertIndex, 0, movie);
  });

  return result.slice(0, recommendations.length);
}

/**
 * Đảm bảo diversity - không quá nhiều phim cùng genre
 */
function ensureDiversity(movies, minGenres = CONFIG.MIN_GENRES_IN_RESULTS) {
  const genreCounts = {};
  const maxPerGenre = Math.ceil(movies.length / minGenres);
  
  return movies.filter(movie => {
    const genreId = movie.genre?._id?.toString() || 'unknown';
    genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
    return genreCounts[genreId] <= maxPerGenre;
  });
}

// ==================== MAIN EXPORT ====================

export {
  CONFIG,
  calculateTimeDecay,
  calculateConfidence,
  calculateGenrePreferences,
  applyExploration,
  ensureDiversity
};

export default {
  CONFIG,
  calculateTimeDecay,
  calculateConfidence,
  calculateGenrePreferences,
  applyExploration,
  ensureDiversity
};