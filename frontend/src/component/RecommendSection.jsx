import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './RecommendationsSection.css';

const API_URL = 'http://localhost:3000/api/v1'; // Thay đổi theo backend của bạn

const RecommendationsSection = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/recommendations/personalized`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setRecommendations(response.data.data);
      setIsFallback(response.data.fallback || false);
      setError(null);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Unable to load recommendations');
      
      // Fallback: load popular movies
      try {
        const response = await axios.get(`${API_URL}/recommendations/popular?limit=10`);
        setRecommendations(response.data.data);
        setIsFallback(true);
      } catch (fallbackErr) {
        console.error('Error loading popular movies:', fallbackErr);
      }
    } finally {
      setLoading(false);
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