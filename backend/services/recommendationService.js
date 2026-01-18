const axios = require('axios');

/**
 * Service để gọi Python Recommendation API
 */
class RecommendationService {
  constructor() {
    this.apiUrl = process.env.RECOMMENDATION_API_URL || 'http://localhost:8000';
  }

  /**
   * Get personalized recommendations cho user
   * @param {string} userId - MongoDB ObjectId của user
   * @param {number} topK - Số lượng recommendations
   */
  async getRecommendations(userId, topK = 10) {
    try {
      const response = await axios.post(`${this.apiUrl}/recommend`, {
        user_id: userId,
        top_k: topK
      });

      return response.data.recommendations;
    } catch (error) {
      console.error('Error getting recommendations:', error.message);
      
      // Fallback: return empty hoặc popular movies
      return [];
    }
  }

  /**
   * Get batch recommendations cho nhiều users
   * @param {Array<string>} userIds - Array of user IDs
   * @param {number} topK - Số lượng recommendations
   */
  async getBatchRecommendations(userIds, topK = 10) {
    try {
      const response = await axios.post(`${this.apiUrl}/recommend/batch`, 
        userIds,
        { params: { top_k: topK } }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting batch recommendations:', error.message);
      return {};
    }
  }

  /**
   * Check health của recommendation service
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`);
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Reload model (sau khi retrain)
   */
  async reloadModel() {
    try {
      const response = await axios.post(`${this.apiUrl}/reload`);
      return response.data;
    } catch (error) {
      console.error('Error reloading model:', error.message);
      throw error;
    }
  }
}

module.exports = new RecommendationService();