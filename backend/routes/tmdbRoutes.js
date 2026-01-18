/**
 * TMDB Routes
 * API endpoints để quản lý sync với TMDB
 */

import express from 'express';
const router = express.Router();
import Movie from '../models/Movie.js';
import tmdbService from '../services/tmdbService.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleware.js';

// @route   GET /api/v1/tmdb/status
// @desc    Check TMDB service status và sync statistics
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const stats = await Movie.aggregate([
      {
        $group: {
          _id: '$tmdbSyncStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalMovies = await Movie.countDocuments();
    const moviesWithImages = await Movie.countDocuments({ 
      image: { $exists: true, $ne: null, $ne: '' } 
    });

    res.json({
      success: true,
      tmdbAvailable: tmdbService.isAvailable(),
      stats: {
        total: totalMovies,
        withImages: moviesWithImages,
        withoutImages: totalMovies - moviesWithImages,
        byStatus: stats.reduce((acc, s) => {
          acc[s._id || 'unknown'] = s.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   POST /api/v1/tmdb/sync/:movieId
// @desc    Sync single movie with TMDB
// @access  Private (Admin)
router.post('/sync/:movieId', authenticate, async (req, res) => {
  try {
    // Check admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin required' });
    }

    if (!tmdbService.isAvailable()) {
      return res.status(503).json({ 
        success: false, 
        message: 'TMDB API key not configured' 
      });
    }

    const movie = await Movie.findById(req.params.movieId);
    
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    // Fetch from TMDB
    const tmdbData = await tmdbService.fetchMovieData(movie.name, movie.year);

    if (!tmdbData.found) {
      await Movie.updateOne(
        { _id: movie._id },
        { tmdbSyncStatus: 'not_found', tmdbSyncedAt: new Date() }
      );
      return res.json({ 
        success: true, 
        status: 'not_found',
        message: `"${movie.name}" not found on TMDB` 
      });
    }

    // Update movie
    const updateData = {
      ...tmdbData,
      tmdbSyncStatus: 'synced',
      tmdbSyncedAt: new Date()
    };
    
    // Don't overwrite detail if TMDB doesn't have overview
    if (tmdbData.overview) {
      updateData.detail = tmdbData.overview;
    }
    delete updateData.overview;
    delete updateData.found;

    await Movie.updateOne({ _id: movie._id }, updateData);

    res.json({
      success: true,
      status: 'synced',
      movie: movie.name,
      data: updateData
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   POST /api/v1/tmdb/sync-batch
// @desc    Sync multiple movies (max 50 at a time)
// @access  Private (Admin)
router.post('/sync-batch', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin required' });
    }

    if (!tmdbService.isAvailable()) {
      return res.status(503).json({ 
        success: false, 
        message: 'TMDB API key not configured' 
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    // Find movies needing sync
    const movies = await Movie.find({
      $or: [
        { tmdbSyncStatus: 'pending' },
        { tmdbSyncStatus: { $exists: false } },
        { image: { $exists: false } },
        { image: null }
      ]
    }).limit(limit);

    if (movies.length === 0) {
      return res.json({ 
        success: true, 
        message: 'All movies are synced',
        synced: 0 
      });
    }

    const results = { synced: 0, not_found: 0, error: 0 };

    for (const movie of movies) {
      try {
        const tmdbData = await tmdbService.fetchMovieData(movie.name, movie.year);

        if (!tmdbData.found) {
          await Movie.updateOne(
            { _id: movie._id },
            { tmdbSyncStatus: 'not_found', tmdbSyncedAt: new Date() }
          );
          results.not_found++;
          continue;
        }

        const updateData = {
          ...tmdbData,
          tmdbSyncStatus: 'synced',
          tmdbSyncedAt: new Date()
        };
        
        if (tmdbData.overview) {
          updateData.detail = tmdbData.overview;
        }
        delete updateData.overview;
        delete updateData.found;

        await Movie.updateOne({ _id: movie._id }, updateData);
        results.synced++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (error) {
        console.error(`Error syncing ${movie.name}:`, error.message);
        await Movie.updateOne(
          { _id: movie._id },
          { tmdbSyncStatus: 'error', tmdbSyncedAt: new Date() }
        );
        results.error++;
      }
    }

    res.json({
      success: true,
      processed: movies.length,
      results
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/v1/tmdb/search
// @desc    Search movie on TMDB (for testing)
// @access  Private (Admin)
router.get('/search', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin required' });
    }

    const { name, year } = req.query;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const result = await tmdbService.fetchMovieData(name, year);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   POST /api/v1/tmdb/reset
// @desc    Reset all sync status to pending
// @access  Private (Admin)
router.post('/reset', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin required' });
    }

    const result = await Movie.updateMany(
      {},
      { 
        $set: { tmdbSyncStatus: 'pending' },
        $unset: { tmdbSyncedAt: 1 }
      }
    );

    res.json({
      success: true,
      message: `Reset ${result.modifiedCount} movies to pending`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;