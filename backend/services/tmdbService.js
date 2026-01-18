/**
 * TMDB Service
 * Service để gọi TMDB API
 */

import axios from 'axios';

const CONFIG = {
  API_KEY: process.env.TMDB_API_KEY,
  BASE_URL: 'https://api.themoviedb.org/3',
  IMAGE_BASE: 'https://image.tmdb.org/t/p',
  POSTER_SIZE: 'w500',
  BACKDROP_SIZE: 'w1280',
  PROFILE_SIZE: 'w185',
  MAX_GENRES: 3,
  MAX_CAST: 5
};

class TMDBService {
  constructor() {
    this.apiKey = CONFIG.API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ TMDB_API_KEY not set. TMDB features will be disabled.');
    }
  }

  /**
   * Search movie by name and year
   */
  async searchMovie(name, year = null) {
    if (!this.apiKey) return null;

    try {
      const cleanName = name.replace(/\s*\(\d{4}\)\s*$/, '').trim();
      
      const params = {
        api_key: this.apiKey,
        query: cleanName,
        language: 'en-US'
      };
      
      if (year) params.year = year;

      const response = await axios.get(`${CONFIG.BASE_URL}/search/movie`, { params });
      
      return response.data.results?.[0] || null;
    } catch (error) {
      console.error('TMDB search error:', error.message);
      return null;
    }
  }

  /**
   * Get full movie details
   */
  async getMovieDetails(tmdbId) {
    if (!this.apiKey) return null;

    try {
      const response = await axios.get(`${CONFIG.BASE_URL}/movie/${tmdbId}`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
          append_to_response: 'credits,release_dates'
        }
      });

      return this.processMovieData(response.data);
    } catch (error) {
      console.error('TMDB details error:', error.message);
      return null;
    }
  }

  /**
   * Search and get full details in one call
   */
  async fetchMovieData(name, year = null) {
    const searchResult = await this.searchMovie(name, year);
    
    if (!searchResult) {
      return { found: false };
    }

    const details = await this.getMovieDetails(searchResult.id);
    
    return {
      found: true,
      ...details
    };
  }

  /**
   * Process raw TMDB data
   */
  processMovieData(data) {
    const director = data.credits?.crew?.find(c => c.job === 'Director');
    
    const cast = (data.credits?.cast || [])
      .slice(0, CONFIG.MAX_CAST)
      .map(actor => ({
        id: actor.id,
        name: actor.name,
        character: actor.character,
        profilePath: this.buildImageUrl(actor.profile_path, CONFIG.PROFILE_SIZE)
      }));

    const genres = (data.genres || [])
      .slice(0, CONFIG.MAX_GENRES)
      .map(g => ({ id: g.id, name: g.name }));

    const certification = this.extractCertification(data.release_dates);

    return {
      tmdbId: data.id,
      image: this.buildImageUrl(data.poster_path, CONFIG.POSTER_SIZE),
      backdrop: this.buildImageUrl(data.backdrop_path, CONFIG.BACKDROP_SIZE),
      runtime: data.runtime || null,
      certification,
      tmdbGenres: genres,
      cast,
      director: director ? {
        id: director.id,
        name: director.name,
        profilePath: this.buildImageUrl(director.profile_path, CONFIG.PROFILE_SIZE)
      } : null,
      originalTitle: data.original_title,
      tagline: data.tagline,
      popularity: data.popularity,
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      overview: data.overview
    };
  }

  /**
   * Extract certification
   */
  extractCertification(releaseDates) {
    if (!releaseDates?.results) return 'NR';

    const priorities = ['US', 'GB', 'AU'];

    for (const country of priorities) {
      const release = releaseDates.results.find(r => r.iso_3166_1 === country);
      if (release?.release_dates) {
        for (const date of release.release_dates) {
          if (date.certification) return date.certification;
        }
      }
    }

    return 'NR';
  }

  /**
   * Build image URL
   */
  buildImageUrl(path, size) {
    if (!path) return null;
    return `${CONFIG.IMAGE_BASE}/${size}${path}`;
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return !!this.apiKey;
  }
}

export default new TMDBService();