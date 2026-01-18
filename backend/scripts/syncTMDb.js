/**
 * ============================================
 * TMDB SYNC SCRIPT
 * ============================================
 * 
 * Script để đồng bộ dữ liệu phim từ TMDB API
 * 
 * Cách dùng:
 *   node scripts/syncTMDB.js                    # Sync tất cả phim pending
 *   node scripts/syncTMDB.js --limit 100       # Sync 100 phim
 *   node scripts/syncTMDB.js --movie "Toy Story"  # Sync 1 phim cụ thể
 *   node scripts/syncTMDB.js --reset           # Reset tất cả về pending
 * 
 * Yêu cầu:
 *   - Biến môi trường TMDB_API_KEY
 *   - MongoDB connection
 */

import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ==================== CONFIG ====================
const CONFIG = {
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p',
  
  // Image sizes
  POSTER_SIZE: 'w500',
  BACKDROP_SIZE: 'w1280',
  PROFILE_SIZE: 'w185',
  
  // Limits
  MAX_GENRES: 3,
  MAX_CAST: 5,
  
  // Rate limiting (TMDB allows 40 requests/10 seconds)
  DELAY_BETWEEN_REQUESTS: 250,  // ms
  BATCH_SIZE: 50,
  DELAY_BETWEEN_BATCHES: 5000,  // ms
  
  // MongoDB
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/movies-app'
};

// ==================== MOVIE SCHEMA (inline) ====================
const movieSchema = new mongoose.Schema({
  name: String,
  year: Number,
  image: String,
  backdrop: String,
  tmdbId: Number,
  runtime: Number,
  certification: String,
  tmdbGenres: [{ id: Number, name: String }],
  cast: [{ id: Number, name: String, character: String, profilePath: String }],
  director: { id: Number, name: String, profilePath: String },
  originalTitle: String,
  tagline: String,
  popularity: Number,
  voteAverage: Number,
  voteCount: Number,
  detail: String,
  tmdbSyncedAt: Date,
  tmdbSyncStatus: String
}, { strict: false });

const Movie = mongoose.model('Movie', movieSchema, 'movies');

// ==================== TMDB API FUNCTIONS ====================

/**
 * Search movie by name and year
 */
async function searchMovie(name, year) {
  try {
    // Clean movie name (remove year in parentheses if present)
    const cleanName = name.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    
    const response = await axios.get(`${CONFIG.TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: CONFIG.TMDB_API_KEY,
        query: cleanName,
        year: year,
        language: 'en-US'
      }
    });
    
    if (response.data.results && response.data.results.length > 0) {
      // Return best match (first result)
      return response.data.results[0];
    }
    
    // Try without year if no results
    const responseNoYear = await axios.get(`${CONFIG.TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: CONFIG.TMDB_API_KEY,
        query: cleanName,
        language: 'en-US'
      }
    });
    
    return responseNoYear.data.results?.[0] || null;
    
  } catch (error) {
    console.error(`Error searching for "${name}":`, error.message);
    return null;
  }
}

/**
 * Get movie details with credits and release dates
 */
async function getMovieDetails(tmdbId) {
  try {
    const response = await axios.get(`${CONFIG.TMDB_BASE_URL}/movie/${tmdbId}`, {
      params: {
        api_key: CONFIG.TMDB_API_KEY,
        language: 'en-US',
        append_to_response: 'credits,release_dates'
      }
    });
    
    return response.data;
    
  } catch (error) {
    console.error(`Error getting details for TMDB ID ${tmdbId}:`, error.message);
    return null;
  }
}

/**
 * Extract US certification from release_dates
 */
function extractCertification(releaseDates) {
  if (!releaseDates?.results) return 'NR';
  
  // Priority: US > GB > AU > Other
  const priorities = ['US', 'GB', 'AU'];
  
  for (const country of priorities) {
    const release = releaseDates.results.find(r => r.iso_3166_1 === country);
    if (release?.release_dates) {
      for (const date of release.release_dates) {
        if (date.certification) {
          return date.certification;
        }
      }
    }
  }
  
  return 'NR';
}

/**
 * Build image URL
 */
function buildImageUrl(path, size) {
  if (!path) return null;
  return `${CONFIG.TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Process movie data from TMDB
 */
function processMovieData(searchResult, details) {
  if (!details) return null;
  
  // Get director from crew
  const director = details.credits?.crew?.find(c => c.job === 'Director');
  
  // Get top cast (limit to MAX_CAST)
  const cast = (details.credits?.cast || [])
    .slice(0, CONFIG.MAX_CAST)
    .map(actor => ({
      id: actor.id,
      name: actor.name,
      character: actor.character,
      profilePath: buildImageUrl(actor.profile_path, CONFIG.PROFILE_SIZE)
    }));
  
  // Get genres (limit to MAX_GENRES)
  const genres = (details.genres || [])
    .slice(0, CONFIG.MAX_GENRES)
    .map(g => ({ id: g.id, name: g.name }));
  
  // Get certification
  const certification = extractCertification(details.release_dates);
  
  return {
    tmdbId: details.id,
    image: buildImageUrl(details.poster_path, CONFIG.POSTER_SIZE),
    backdrop: buildImageUrl(details.backdrop_path, CONFIG.BACKDROP_SIZE),
    runtime: details.runtime || null,
    certification: certification,
    tmdbGenres: genres,
    cast: cast,
    director: director ? {
      id: director.id,
      name: director.name,
      profilePath: buildImageUrl(director.profile_path, CONFIG.PROFILE_SIZE)
    } : null,
    originalTitle: details.original_title,
    tagline: details.tagline || null,
    popularity: details.popularity,
    voteAverage: details.vote_average,
    voteCount: details.vote_count,
    detail: details.overview || undefined,  // Only update if has value
    tmdbSyncedAt: new Date(),
    tmdbSyncStatus: 'synced'
  };
}

// ==================== SYNC FUNCTIONS ====================

/**
 * Sync single movie
 */
async function syncMovie(movie) {
  console.log(`  Syncing: "${movie.name}" (${movie.year})`);
  
  // Search on TMDB
  const searchResult = await searchMovie(movie.name, movie.year);
  
  if (!searchResult) {
    console.log(`    ❌ Not found on TMDB`);
    await Movie.updateOne(
      { _id: movie._id },
      { tmdbSyncStatus: 'not_found', tmdbSyncedAt: new Date() }
    );
    return { status: 'not_found', movie: movie.name };
  }
  
  // Get full details
  await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
  const details = await getMovieDetails(searchResult.id);
  
  if (!details) {
    console.log(`    ❌ Error getting details`);
    await Movie.updateOne(
      { _id: movie._id },
      { tmdbSyncStatus: 'error', tmdbSyncedAt: new Date() }
    );
    return { status: 'error', movie: movie.name };
  }
  
  // Process and update
  const updateData = processMovieData(searchResult, details);
  
  // Don't overwrite detail if TMDB doesn't have overview
  if (!updateData.detail) {
    delete updateData.detail;
  }
  
  await Movie.updateOne({ _id: movie._id }, updateData);
  
  console.log(`    ✅ Synced: ${updateData.runtime}min, ${updateData.certification}, ${updateData.cast.length} cast`);
  
  return { status: 'synced', movie: movie.name, tmdbId: updateData.tmdbId };
}

/**
 * Sync all pending movies
 */
async function syncAllMovies(limit = null) {
  // Find movies that need syncing
  const query = {
    $or: [
      { tmdbSyncStatus: 'pending' },
      { tmdbSyncStatus: { $exists: false } },
      { image: { $exists: false } },
      { image: null },
      { image: '' }
    ]
  };
  
  let moviesQuery = Movie.find(query).sort({ _id: 1 });
  
  if (limit) {
    moviesQuery = moviesQuery.limit(limit);
  }
  
  const movies = await moviesQuery;
  
  console.log(`\n📽️  Found ${movies.length} movies to sync\n`);
  
  if (movies.length === 0) {
    console.log('All movies are already synced!');
    return;
  }
  
  const stats = { synced: 0, not_found: 0, error: 0 };
  
  // Process in batches
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    
    try {
      const result = await syncMovie(movie);
      stats[result.status]++;
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      stats.error++;
    }
    
    // Rate limiting
    await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
    
    // Batch delay
    if ((i + 1) % CONFIG.BATCH_SIZE === 0 && i < movies.length - 1) {
      console.log(`\n⏳ Batch complete. Waiting ${CONFIG.DELAY_BETWEEN_BATCHES/1000}s...\n`);
      await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
    }
    
    // Progress
    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${movies.length} (${Math.round((i+1)/movies.length*100)}%)\n`);
    }
  }
  
  console.log('\n========================================');
  console.log('📊 SYNC COMPLETE');
  console.log('========================================');
  console.log(`✅ Synced:    ${stats.synced}`);
  console.log(`❌ Not found: ${stats.not_found}`);
  console.log(`⚠️  Errors:    ${stats.error}`);
  console.log('========================================\n');
}

/**
 * Reset all sync status to pending
 */
async function resetSyncStatus() {
  const result = await Movie.updateMany(
    {},
    { 
      $set: { tmdbSyncStatus: 'pending' },
      $unset: { tmdbSyncedAt: 1 }
    }
  );
  console.log(`Reset ${result.modifiedCount} movies to pending`);
}

// ==================== HELPERS ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== MAIN ====================

async function main() {
  // Check API key
  if (!CONFIG.TMDB_API_KEY) {
    console.error('❌ ERROR: TMDB_API_KEY not set!');
    console.error('Please set TMDB_API_KEY in your .env file');
    process.exit(1);
  }
  
  // Parse arguments
  const args = process.argv.slice(2);
  let limit = null;
  let movieName = null;
  let reset = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--movie' && args[i + 1]) {
      movieName = args[i + 1];
    }
    if (args[i] === '--reset') {
      reset = true;
    }
  }
  
  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  await mongoose.connect(CONFIG.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');
  
  try {
    if (reset) {
      await resetSyncStatus();
    } else if (movieName) {
      // Sync specific movie
      const movie = await Movie.findOne({ 
        name: { $regex: movieName, $options: 'i' } 
      });
      
      if (movie) {
        await syncMovie(movie);
      } else {
        console.log(`Movie "${movieName}" not found in database`);
      }
    } else {
      // Sync all
      await syncAllMovies(limit);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();