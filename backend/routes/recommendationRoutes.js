import express from 'express';
const router = express.Router();
import recommendationService from '../services/recommendationService.js';
import Movie from '../models/Movie.js';
import { authenticate } from '../middlewares/authMiddleware.js';

// @route   GET /api/recommendations/personalized
// @desc    Get personalized recommendations cho user hiện tại
// @access  Private
router.get('/personalized', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const topK = parseInt(req.query.top_k) || 10;

    // Get recommendations từ Python service
    const recommendations = await recommendationService.getRecommendations(userId, topK);

    if (recommendations.length === 0) {
      // Fallback: return popular movies
      const popularMovies = await Movie.find()
        .sort({ totalRatings: -1, averageRating: -1 })
        .limit(topK);

      return res.json({
        success: true,
        message: 'Showing popular movies (no personalized data)',
        data: popularMovies,
        fallback: true
      });
    }

    // Fetch movie details từ MongoDB
    const movieIds = recommendations.map(r => r.movieId);
    const movies = await Movie.find({ _id: { $in: movieIds } }).populate('genre');

    // Sort theo thứ tự recommendations và attach scores
    const moviesMap = new Map(movies.map(m => [m._id.toString(), m]));
    const sortedMovies = recommendations
      .map(r => {
        const movie = moviesMap.get(r.movieId);
        if (movie) {
          return {
            ...movie.toObject(),
            recommendationScore: r.score
          };
        }
        return null;
      })
      .filter(m => m !== null);

    res.json({
      success: true,
      count: sortedMovies.length,
      data: sortedMovies,
      fallback: false
    });

  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recommendations',
      error: error.message
    });
  }
});

// @route   GET /api/recommendations/popular
// @desc    Get popular movies (fallback cho cold start)
// @access  Public
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
      data: popularMovies
    });

  } catch (error) {
    console.error('Error fetching popular movies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular movies',
      error: error.message
    });
  }
});

// @route   GET /api/recommendations/similar/:movieId
// @desc    Get similar movies (item-based)
// @access  Public
router.get('/similar/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Get current movie
    const movie = await Movie.findById(movieId).populate('genre');

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Find similar movies by genre
    const similarMovies = await Movie.find({
      _id: { $ne: movieId },
      genre: movie.genre._id
    })
      .sort({ averageRating: -1, totalRatings: -1 })
      .limit(limit)
      .populate('genre');

    res.json({
      success: true,
      movie: movie,
      count: similarMovies.length,
      data: similarMovies
    });

  } catch (error) {
    console.error('Error fetching similar movies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching similar movies',
      error: error.message
    });
  }
});

// @route   GET /api/recommendations/health
// @desc    Check recommendation service health
// @access  Private (Admin)
router.get('/health', authenticate, async (req, res) => {
  try {
    const health = await recommendationService.checkHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// @route   POST /api/recommendations/reload
// @desc    Reload recommendation model
// @access  Private (Admin)
router.post('/reload', authenticate, async (req, res) => {
  try {
    // Check admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await recommendationService.reloadModel();
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reloading model',
      error: error.message
    });
  }
});

export default router;