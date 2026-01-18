import express from 'express';
const router = express.Router();
import recommendationService from '../services/recommendationService.js';
import Movie from '../models/Movie.js';
import Interaction from '../models/Interaction.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  CONFIG,
  calculateGenrePreferences,
  applyExploration,
  ensureDiversity
} from '../utils/recommendationUtils.js';

/**
 * ============================================
 * RECOMMENDATION ROUTES - Realistic Drift
 * ============================================
 * 
 * Tốc độ dịch chuyển được điều chỉnh bởi:
 * 1. MIN_RATINGS_FOR_PERSONALIZATION (5) - Cần 5 ratings mới personalize
 * 2. TIME_DECAY - Ratings cũ ít ảnh hưởng hơn
 * 3. CONFIDENCE - Cần 3+ ratings/genre mới confident
 * 4. EXPLORATION_RATIO (20%) - Giữ đa dạng
 * 5. RATING_WEIGHTS - 5⭐ ảnh hưởng nhiều, 3⭐ gần như không
 */

// @route   GET /api/v1/recommendation/personalized
router.get('/personalized', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const topK = parseInt(req.query.top_k) || 10;

    console.log(`[Recommendation] User: ${userId}, TopK: ${topK}`);

    // 1. Tính genre preferences với các điều chỉnh
    const preferenceResult = await calculateGenrePreferences(userId, Interaction);

    // 2. Chưa đủ data → Popular movies
    if (!preferenceResult.hasEnoughData) {
      console.log(`[Recommendation] Not enough data (${preferenceResult.totalRatings}/${preferenceResult.minRequired})`);
      
      const popularMovies = await Movie.find()
        .sort({ totalRatings: -1, averageRating: -1 })
        .limit(topK)
        .populate('genre');

      return res.json({
        success: true,
        algorithm: 'popular',
        message: `Đánh giá thêm ${preferenceResult.minRequired - preferenceResult.totalRatings} phim để nhận gợi ý cá nhân hóa!`,
        data: popularMovies,
        fallback: true,
        progress: {
          current: preferenceResult.totalRatings,
          required: preferenceResult.minRequired
        }
      });
    }

    // 3. Thử LightGCN trước
    let recommendations = [];
    let algorithm = 'content-based';

    try {
      const lightgcnResult = await recommendationService.getRecommendations(userId, topK + 5);
      if (lightgcnResult?.length > 0) {
        recommendations = lightgcnResult;
        algorithm = 'lightgcn';
        console.log(`[Recommendation] LightGCN: ${recommendations.length} results`);
      }
    } catch (err) {
      console.log(`[Recommendation] LightGCN unavailable: ${err.message}`);
    }

    // 4. Fallback to content-based với adjusted preferences
    if (recommendations.length === 0) {
      recommendations = await getAdjustedContentBased(userId, topK + 5, preferenceResult.preferences);
    }

    if (recommendations.length === 0) {
      // Final fallback
      const popularMovies = await Movie.find()
        .sort({ totalRatings: -1, averageRating: -1 })
        .limit(topK)
        .populate('genre');

      return res.json({
        success: true,
        algorithm: 'popular',
        data: popularMovies,
        fallback: true
      });
    }

    // 5. Fetch movie details
    const movieIds = recommendations.map(r => r.movieId || r._id);
    let movies = await Movie.find({ _id: { $in: movieIds } }).populate('genre');

    // 6. Sort và attach scores
    const moviesMap = new Map(movies.map(m => [m._id.toString(), m]));
    let sortedMovies = recommendations
      .map(r => {
        const movieId = (r.movieId || r._id)?.toString();
        const movie = moviesMap.get(movieId);
        if (movie) {
          return {
            ...movie.toObject(),
            recommendationScore: Math.round((r.score || 0) * 100) / 100
          };
        }
        return null;
      })
      .filter(m => m !== null);

    // 7. Get rated movie IDs for exploration
    const ratedMovieIds = new Set(
      (await Interaction.find({ userId }).select('movieId')).map(i => i.movieId.toString())
    );

    // 8. Apply exploration (20% diverse recommendations)
    sortedMovies = await applyExploration(
      sortedMovies, 
      preferenceResult.preferences,
      Movie,
      ratedMovieIds
    );

    // 9. Ensure diversity
    sortedMovies = ensureDiversity(sortedMovies);

    // 10. Trim to topK
    sortedMovies = sortedMovies.slice(0, topK);

    res.json({
      success: true,
      count: sortedMovies.length,
      algorithm,
      data: sortedMovies,
      fallback: false,
      // Info cho frontend hiển thị
      userProfile: {
        totalRatings: preferenceResult.totalRatings,
        topPreferences: preferenceResult.preferences.slice(0, 3).map(p => ({
          genre: p.name,
          confidence: p.confidence,
          ratingsCount: p.ratingsCount
        })),
        explorationEnabled: CONFIG.EXPLORATION_RATIO > 0
      }
    });

  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recommendations',
      error: error.message
    });
  }
});

/**
 * Content-based với adjusted weights
 */
async function getAdjustedContentBased(userId, topK, preferences) {
  try {
    // Lấy genres có confidence cao
    const confidentPreferences = preferences.filter(p => p.confidence >= 0.4);
    
    if (confidentPreferences.length === 0) {
      return [];
    }

    // Lấy movie IDs đã rate
    const ratedMovieIds = (await Interaction.find({ userId }).select('movieId'))
      .map(i => i.movieId.toString());

    // Top genres (chỉ những genre có score > 0)
    const positiveGenres = confidentPreferences
      .filter(p => p.score > 0)
      .slice(0, 4)
      .map(p => p.genreId);

    if (positiveGenres.length === 0) {
      return [];
    }

    // Query movies
    const movies = await Movie.find({
      _id: { $nin: ratedMovieIds },
      genre: { $in: positiveGenres }
    })
      .sort({ averageRating: -1, totalRatings: -1 })
      .limit(topK * 2)
      .populate('genre');

    // Score movies dựa trên preference scores
    const prefMap = new Map(preferences.map(p => [p.genreId, p]));
    
    const scoredMovies = movies.map(movie => {
      const genreId = movie.genre?._id?.toString();
      const pref = prefMap.get(genreId);
      
      // Base score từ preference
      const prefScore = pref ? pref.score * pref.confidence : 0;
      
      // Movie quality score
      const qualityScore = ((movie.averageRating || 3) / 5) * 0.3;
      
      // Combined
      const score = prefScore * 0.7 + qualityScore;
      
      return {
        movieId: movie._id.toString(),
        score
      };
    });

    // Sort by score
    scoredMovies.sort((a, b) => b.score - a.score);
    
    return scoredMovies.slice(0, topK);

  } catch (error) {
    console.error('Content-based error:', error);
    return [];
  }
}

// @route   GET /api/v1/recommendation/popular
router.get('/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const popularMovies = await Movie.find()
      .sort({ totalRatings: -1, averageRating: -1 })
      .limit(limit)
      .populate('genre');

    res.json({
      success: true,
      count: popularMovies.length,
      algorithm: 'popular',
      data: popularMovies
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching popular movies',
      error: error.message
    });
  }
});

// @route   GET /api/v1/recommendation/my-profile
// @desc    Xem profile preferences của user (cho demo)
router.get('/my-profile', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const preferenceResult = await calculateGenrePreferences(userId, Interaction);

    res.json({
      success: true,
      ...preferenceResult,
      config: {
        minRatingsRequired: CONFIG.MIN_RATINGS_FOR_PERSONALIZATION,
        explorationRatio: CONFIG.EXPLORATION_RATIO,
        timeDecayHalfLife: CONFIG.TIME_DECAY.HALF_LIFE_DAYS,
        ratingWeights: CONFIG.RATING_WEIGHTS
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// @route   GET /api/v1/recommendation/similar/:movieId
router.get('/similar/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const movie = await Movie.findById(movieId).populate('genre');
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    const similarMovies = await Movie.find({
      _id: { $ne: movieId },
      genre: movie.genre._id
    })
      .sort({ averageRating: -1, totalRatings: -1 })
      .limit(limit)
      .populate('genre');

    res.json({
      success: true,
      count: similarMovies.length,
      data: similarMovies
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/v1/recommendation/health
router.get('/health', async (req, res) => {
  try {
    const health = await recommendationService.checkHealth();
    res.json({
      ...health,
      realisticDrift: true,
      config: CONFIG
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      lightgcn: 'unavailable',
      contentBasedFallback: 'available',
      realisticDrift: true
    });
  }
});

// @route   POST /api/v1/recommendation/reload
router.post('/reload', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin required' });
    }
    const result = await recommendationService.reloadModel();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;