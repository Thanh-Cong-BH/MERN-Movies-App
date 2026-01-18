import express from 'express';
const router = express.Router();
import Interaction from '../models/Interaction.js';
import { authenticate } from '../middlewares/authMiddleware.js'; // Giả sử đã có auth middleware

// @route   POST /api/interactions/view
// @desc    Track khi user xem phim
// @access  Private
router.post('/view', authenticate, async (req, res) => {
  try {
    const { movieId, duration, completionRate, deviceType, sessionId } = req.body;
    const userId = req.user._id; // Từ auth middleware

    // Validate
    if (!movieId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Movie ID is required' 
      });
    }

    // Tạo hoặc update view interaction
    const interaction = await Interaction.upsertInteraction({
      userId,
      movieId,
      interactionType: 'view',
      metadata: {
        duration: duration || 0,
        completionRate: completionRate || 0,
        deviceType: deviceType || 'unknown',
        sessionId: sessionId || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'View interaction tracked successfully',
      data: interaction
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking view interaction',
      error: error.message
    });
  }
});

// @route   POST /api/interactions/rate
// @desc    Track khi user đánh giá phim
// @access  Private
router.post('/rate', authenticate, async (req, res) => {
  try {
    const { movieId, rating } = req.body;
    const userId = req.user._id;

    // Validate
    if (!movieId || !rating) {
      return res.status(400).json({ 
        success: false, 
        message: 'Movie ID and rating are required' 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating must be between 1 and 5' 
      });
    }

    // Tạo hoặc update rating interaction
    const interaction = await Interaction.upsertInteraction({
      userId,
      movieId,
      interactionType: 'rating',
      rating
    });

    // Tính lại average rating của movie
    const { average, count } = await Interaction.getAverageRating(movieId);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        interaction,
        movieStats: {
          averageRating: average,
          totalRatings: count
        }
      }
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting rating',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/user/:userId
// @desc    Lấy tất cả interactions của một user
// @access  Private
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query; // Optional: 'view' hoặc 'rating'

    // Kiểm tra quyền: user chỉ xem được interactions của mình
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const interactions = await Interaction.getUserInteractions(
      userId, 
      type || null
    );

    res.json({
      success: true,
      count: interactions.length,
      data: interactions
    });
  } catch (error) {
    console.error('Error fetching user interactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interactions',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/movie/:movieId
// @desc    Lấy tất cả interactions của một movie
// @access  Public
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const { type } = req.query;

    const interactions = await Interaction.getMovieInteractions(
      movieId, 
      type || null
    );

    res.json({
      success: true,
      count: interactions.length,
      data: interactions
    });
  } catch (error) {
    console.error('Error fetching movie interactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interactions',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/movie/:movieId/rating
// @desc    Lấy rating trung bình của một movie
// @access  Public
router.get('/movie/:movieId/rating', async (req, res) => {
  try {
    const { movieId } = req.params;
    const stats = await Interaction.getAverageRating(movieId);

    res.json({
      success: true,
      data: {
        movieId,
        averageRating: stats.average,
        totalRatings: stats.count
      }
    });
  } catch (error) {
    console.error('Error fetching rating stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rating statistics',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/export
// @desc    Export interactions data cho ML training
// @access  Private (Admin only)
router.get('/export', authenticate, async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { startDate, endDate, format } = req.query;

    const interactions = await Interaction.exportForML(startDate, endDate);

    // Format dữ liệu theo yêu cầu
    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(interactions);
      res.header('Content-Type', 'text/csv');
      res.attachment('interactions.csv');
      return res.send(csv);
    }

    // Default: JSON
    res.json({
      success: true,
      count: interactions.length,
      data: interactions
    });
  } catch (error) {
    console.error('Error exporting interactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting interactions',
      error: error.message
    });
  }
});

// @route   GET /api/interactions/stats
// @desc    Lấy thống kê tổng quan về interactions
// @access  Private (Admin only)
router.get('/stats', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await Interaction.aggregate([
      {
        $group: {
          _id: '$interactionType',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalUsers = await Interaction.distinct('userId');
    const totalMovies = await Interaction.distinct('movieId');

    res.json({
      success: true,
      data: {
        interactionsByType: stats,
        totalUniqueUsers: totalUsers.length,
        totalUniqueMovies: totalMovies.length
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// @route   DELETE /api/interactions/:id
// @desc    Xóa một interaction (ví dụ: user muốn xóa rating)
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const interaction = await Interaction.findById(id);

    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: 'Interaction not found'
      });
    }

    // Kiểm tra quyền
    if (interaction.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await interaction.remove();

    res.json({
      success: true,
      message: 'Interaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting interaction',
      error: error.message
    });
  }
});

// Helper function: Convert JSON to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = ['userId', 'movieId', 'interactionType', 'rating', 'timestamp', 'duration', 'completionRate'];
  const csv = [headers.join(',')];

  data.forEach(item => {
    const row = [
      item.userId,
      item.movieId,
      item.interactionType,
      item.rating || '',
      item.timestamp,
      item.metadata?.duration || '',
      item.metadata?.completionRate || ''
    ];
    csv.push(row.join(','));
  });

  return csv.join('\n');
}

export default router;