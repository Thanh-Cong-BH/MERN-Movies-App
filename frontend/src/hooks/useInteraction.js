import { useState, useEffect, useRef, useCallback } from 'react';
import interactionService from '../services/interactionService.js';

/**
 * Hook để track khi user xem phim
 * Tự động track view khi component mount và track completion khi unmount
 */
export const useViewTracking = (movieId, isPlaying = false) => {
  const [viewTracked, setViewTracked] = useState(false);
  const startTimeRef = useRef(null);
  const totalDurationRef = useRef(0);

  useEffect(() => {
    if (!movieId) return;

    // Track initial view
    const trackInitialView = async () => {
      try {
        const deviceType = interactionService.getDeviceType();
        await interactionService.trackView(movieId, 0, 0, deviceType);
        setViewTracked(true);
        startTimeRef.current = Date.now();
      } catch (error) {
        console.error('Failed to track view:', error);
      }
    };

    trackInitialView();

    // Cleanup: Track final view với duration và completion rate
    return () => {
      if (startTimeRef.current) {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        totalDurationRef.current += duration;
        
        // Track final view (không await vì đang cleanup)
        interactionService.trackView(
          movieId,
          totalDurationRef.current,
          0, // Completion rate sẽ được tính riêng
          interactionService.getDeviceType()
        ).catch(err => console.error('Error tracking final view:', err));
      }
    };
  }, [movieId]);

  // Update duration khi video đang play
  useEffect(() => {
    let intervalId;

    if (isPlaying && startTimeRef.current) {
      intervalId = setInterval(() => {
        const currentDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        totalDurationRef.current = currentDuration;
      }, 5000); // Update mỗi 5 giây
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying]);

  const updateCompletionRate = useCallback(async (completionRate) => {
    if (!movieId || !viewTracked) return;

    try {
      await interactionService.trackView(
        movieId,
        totalDurationRef.current,
        completionRate,
        interactionService.getDeviceType()
      );
    } catch (error) {
      console.error('Failed to update completion rate:', error);
    }
  }, [movieId, viewTracked]);

  return { viewTracked, updateCompletionRate };
};

/**
 * Hook để quản lý rating
 */
export const useRating = (movieId, initialRating = null) => {
  const [rating, setRating] = useState(initialRating);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [movieStats, setMovieStats] = useState({ averageRating: 0, totalRatings: 0 });

  // Fetch rating trung bình của phim
  useEffect(() => {
    if (!movieId) return;

    const fetchMovieRating = async () => {
      try {
        const response = await interactionService.getMovieRating(movieId);
        setMovieStats({
          averageRating: response.data.averageRating,
          totalRatings: response.data.totalRatings
        });
      } catch (error) {
        console.error('Failed to fetch movie rating:', error);
      }
    };

    fetchMovieRating();
  }, [movieId]);

  const submitRating = useCallback(async (newRating) => {
    if (!movieId) {
      setError('Movie ID is required');
      return;
    }

    if (newRating < 1 || newRating > 5) {
      setError('Rating must be between 1 and 5');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await interactionService.trackRating(movieId, newRating);
      setRating(newRating);
      
      // Update movie stats
      if (response.data.movieStats) {
        setMovieStats(response.data.movieStats);
      }

      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit rating');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [movieId]);

  const removeRating = useCallback(async (interactionId) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await interactionService.deleteInteraction(interactionId);
      setRating(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to remove rating');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    rating,
    movieStats,
    isSubmitting,
    error,
    submitRating,
    removeRating
  };
};

/**
 * Hook để lấy interaction history của user
 */
export const useUserInteractions = (userId, type = null) => {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchInteractions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await interactionService.getUserInteractions(userId, type);
        setInteractions(response.data);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to fetch interactions');
        console.error('Failed to fetch user interactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInteractions();
  }, [userId, type]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await interactionService.getUserInteractions(userId, type);
      setInteractions(response.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to refresh interactions');
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  return {
    interactions,
    loading,
    error,
    refresh
  };
};