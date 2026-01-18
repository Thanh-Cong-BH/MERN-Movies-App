import axios from 'axios';

// API URL - thay đổi theo backend của bạn
const API_URL = 'http://localhost:3000/api/v1';

// Lấy token từ localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Config cho axios với token
const getAuthConfig = () => {
  const token = getAuthToken();
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

class InteractionService {
  /**
   * Track khi user xem phim
   * @param {string} movieId - ID của phim
   * @param {number} duration - Thời gian xem (giây)
   * @param {number} completionRate - Phần trăm phim đã xem (0-100)
   * @param {string} deviceType - Loại thiết bị: 'mobile', 'desktop', 'tablet'
   */
  async trackView(movieId, duration = 0, completionRate = 0, deviceType = 'desktop') {
    try {
      const sessionId = this.getOrCreateSessionId();
      
      const response = await axios.post(
        `${API_URL}/interactions/view`,
        {
          movieId,
          duration,
          completionRate,
          deviceType,
          sessionId
        },
        getAuthConfig()
      );

      return response.data;
    } catch (error) {
      console.error('Error tracking view:', error);
      throw error;
    }
  }

  /**
   * Track khi user đánh giá phim
   * @param {string} movieId - ID của phim
   * @param {number} rating - Điểm đánh giá (1-5)
   */
  async trackRating(movieId, rating) {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const response = await axios.post(
        `${API_URL}/interactions/rate`,
        {
          movieId,
          rating
        },
        getAuthConfig()
      );

      return response.data;
    } catch (error) {
      console.error('Error tracking rating:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả interactions của user hiện tại
   * @param {string} type - Optional: 'view' hoặc 'rating'
   */
  async getUserInteractions(userId, type = null) {
    try {
      const url = type 
        ? `${API_URL}/interactions/user/${userId}?type=${type}`
        : `${API_URL}/interactions/user/${userId}`;

      const response = await axios.get(url, getAuthConfig());
      return response.data;
    } catch (error) {
      console.error('Error fetching user interactions:', error);
      throw error;
    }
  }

  /**
   * Lấy rating trung bình của một phim
   * @param {string} movieId - ID của phim
   */
  async getMovieRating(movieId) {
    try {
      const response = await axios.get(
        `${API_URL}/interaction/movie/${movieId}/rating`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching movie rating:', error);
      throw error;
    }
  }

  /**
   * Xóa một interaction (ví dụ: xóa rating)
   * @param {string} interactionId - ID của interaction
   */
  async deleteInteraction(interactionId) {
    try {
      const response = await axios.delete(
        `${API_URL}/interactions/${interactionId}`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting interaction:', error);
      throw error;
    }
  }

  /**
   * Lấy hoặc tạo session ID
   */
  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Detect device type
   */
  getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }
}

export default new InteractionService();