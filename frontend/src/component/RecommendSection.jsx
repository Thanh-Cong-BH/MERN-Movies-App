import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './RecommendSection.css';

const API_URL = 'http://localhost:3000/api/v1';

const RecommendationsSection = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  // Kiểm tra user đã login chưa (dựa vào userInfo trong localStorage)
  const isLoggedIn = () => {
    return !!localStorage.getItem('userInfo');
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      
      // Nếu chưa login, load popular movies
      if (!isLoggedIn()) {
        console.log('User not logged in, loading popular movies...');
        await loadPopularMovies();
        return;
      }

      // Gọi API với withCredentials để gửi cookie jwt
      const response = await axios.get(`${API_URL}/recommendation/personalized`, {
        withCredentials: true  // ✅ Gửi cookie jwt
      });

      setRecommendations(response.data.data);
      setIsFallback(response.data.fallback || false);
      setError(null);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      
      if (err.response?.status === 401) {
        console.log('Unauthorized - session expired or invalid');
      }
      
      // Fallback đến popular movies
      await loadPopularMovies();
    } finally {
      setLoading(false);
    }
  };

  const loadPopularMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/recommendation/popular?limit=10`, {
        withCredentials: true
      });
      setRecommendations(response.data.data);
      setIsFallback(true);
      setError(null);
    } catch (fallbackErr) {
      console.error('Error loading popular movies:', fallbackErr);
      setError('Unable to load movies');
      setRecommendations([]);
    }
  };

  if (loading) {
    return (
      <div className="recommendations-section">
        <div className="loading">Loading recommendations...</div>
      </div>
    );
  }

  if (error && recommendations.length === 0) {
    return (
      <div className="recommendations-section">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="recommendations-section">
      <div className="section-header">
        <h2>
          {isFallback ? '🔥 Popular Movies' : '✨ Recommended For You'}
        </h2>
        {isFallback && (
          <p className="fallback-notice">
            Watch and rate more movies to get personalized recommendations!
          </p>
        )}
      </div>

      <div className="movies-grid">
        {recommendations.map((movie) => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </div>
  );
};

const MovieCard = ({ movie }) => {
  return (
    <div className="movie-card">
      <div className="movie-image">
        {movie.image ? (
          <img src={movie.image} alt={movie.name} />
        ) : (
          <div className="no-image">
            <span>{movie.name.charAt(0)}</span>
          </div>
        )}
        
        {movie.recommendationScore && (
          <div className="rec-badge">
            Score: {movie.recommendationScore.toFixed(2)}
          </div>
        )}
      </div>

      <div className="movie-info">
        <h3 className="movie-title">{movie.name}</h3>
        <div className="movie-meta">
          <span className="year">{movie.year}</span>
          <span className="rating">
            ⭐ {movie.averageRating ? movie.averageRating.toFixed(1) : 'N/A'}
          </span>
        </div>
        <p className="movie-genre">{movie.genre?.name || 'Unknown'}</p>
      </div>

      <a href={`/movies/${movie._id}`} className="view-button">
        View Details
      </a>
    </div>
  );
};

export default RecommendationsSection;