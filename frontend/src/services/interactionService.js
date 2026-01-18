import axios from 'axios';

// API URL - thay đổi theo backend của bạn
const API_URL = 'http://localhost:3000/api/v1';

// Config cho axios - dùng cookie (withCredentials) thay vì header token
const getAuthConfig = () => {
  return {
    headers: {
      'Content-Type': 'application/json'
    },
    withCredentials: true  // ✅ Quan trọng: gửi cookie jwt với request
  };
};

class InteractionService {
  /**
   * Track khi user xem phim
   */
  async trackView(movieId, duration = 0, completionRate = 0, deviceType = 'desktop') {
    try {
      const sessionId = this.getOrCreateSessionId();
      
      const response = await axios.post(
        `${API_URL}/interaction/view`,
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
   */
  async trackRating(movieId, rating) {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const response = await axios.post(
        `${API_URL}/interaction/rate`,
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
   */
  async getUserInteractions(userId, type = null) {
    try {
      const url = type 
        ? `${API_URL}/interaction/user/${userId}?type=${type}`
        : `${API_URL}/interaction/user/${userId}`;

      const response = await axios.get(url, getAuthConfig());
      return response.data;
    } catch (error) {
      console.error('Error fetching user interactions:', error);
      throw error;
    }
  }

  /**
   * Lấy rating trung bình của một phim
   */
  async getMovieRating(movieId) {
    try {
      const response = await axios.get(
        `${API_URL}/interaction/movie/${movieId}/rating`,
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching movie rating:', error);
      throw error;
    }
  }

  /**
   * Xóa một interaction
   */
  async deleteInteraction(interactionId) {
    try {
      const response = await axios.delete(
        `${API_URL}/interaction/${interactionId}`,
        getAuthConfig()
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting interaction:', error);
      throw error;
    }
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

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