import React, { useState, useRef } from 'react';
import { useViewTracking } from '../hooks/useInteraction';
import './MoviePlayer.css';

const MoviePlayer = ({ movie }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  // Track view với custom hook - PHẢI đặt trước mọi conditional return
  const { viewTracked, updateCompletionRate } = useViewTracking(movie?._id, isPlaying);

  // Safety check: nếu movie undefined, return sau khi hooks đã được gọi
  if (!movie || !movie._id || !movie.videoUrl) {
    return null;
  }

  // Handle play/pause
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Update current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Calculate và update completion rate
      const completionRate = (videoRef.current.currentTime / duration) * 100;
      
      // Update mỗi 10% progress
      if (completionRate % 10 < 1) {
        updateCompletionRate(Math.floor(completionRate));
      }
    }
  };

  // Set duration khi metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Track khi video kết thúc
  const handleEnded = () => {
    setIsPlaying(false);
    updateCompletionRate(100);
  };

  // Format time (seconds to MM:SS)
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="movie-player">
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src={movie.videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Play/Pause overlay */}
        <div className="video-overlay" onClick={handlePlayPause}>
          {!isPlaying && (
            <div className="play-button">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="video-controls">
          <button className="control-button" onClick={handlePlayPause}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {viewTracked && (
            <div className="tracking-indicator" title="View tracked">
              ✓
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoviePlayer;