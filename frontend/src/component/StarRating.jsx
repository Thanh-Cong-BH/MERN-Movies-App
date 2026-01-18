import React, { useState } from 'react';
import { useRating } from '../hooks/useInteraction.js';
import './StarRating.css';

const StarRating = ({ movieId, size = 'medium', showStats = true, readOnly = false }) => {
  const { rating, movieStats, isSubmitting, error, submitRating } = useRating(movieId);
  const [hoverRating, setHoverRating] = useState(0);

  const handleRatingClick = async (selectedRating) => {
    if (readOnly || isSubmitting) return;

    try {
      await submitRating(selectedRating);
    } catch (error) {
      console.error('Failed to submit rating:', error);
    }
  };

  const handleMouseEnter = (star) => {
    if (readOnly) return;
    setHoverRating(star);
  };

  const handleMouseLeave = () => {
    setHoverRating(0);
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'star-rating-small';
      case 'large': return 'star-rating-large';
      default: return 'star-rating-medium';
    }
  };

  const displayRating = hoverRating || rating || 0;

  return (
    <div className={`star-rating-container ${getSizeClass()}`}>
      <div className="stars-wrapper">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star ${star <= displayRating ? 'star-filled' : 'star-empty'} ${
              readOnly ? 'star-readonly' : ''
            }`}
            onClick={() => handleRatingClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            disabled={readOnly || isSubmitting}
            aria-label={`Rate ${star} stars`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="star-icon"
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
        ))}
      </div>

      {showStats && (
        <div className="rating-stats">
          <span className="average-rating">
            {movieStats.averageRating > 0
              ? movieStats.averageRating.toFixed(1)
              : 'No ratings'}
          </span>
          {movieStats.totalRatings > 0 && (
            <span className="total-ratings">({movieStats.totalRatings})</span>
          )}
        </div>
      )}

      {!readOnly && rating > 0 && (
        <div className="user-rating-info">
          <span className="user-rating-label">Your rating: {rating}/5</span>
        </div>
      )}

      {error && <div className="rating-error">{error}</div>}

      {isSubmitting && <div className="rating-loading">Submitting...</div>}
    </div>
  );
};

export default StarRating;