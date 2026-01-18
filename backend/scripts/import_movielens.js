import fs from 'fs';
import path from 'path';
import readline from 'readline';
import mongoose from 'mongoose';

// Import models
import Movie from '../models/Movie.js';
import Genre from '../models/Genre.js';

/**
 * Import MovieLens 1M với schema tối giản
 * Chỉ lấy: movieLensId, name (title), year, genres
 * 
 * Usage: node scripts/importMovieLensMinimal.js /path/to/ml-1m
 */

// Parse movies.dat
async function parseMoviesFile(filePath) {
  console.log('📁 Reading movies.dat...');
  
  const movies = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const parts = line.split('::');
    if (parts.length !== 3) continue;
    
    const movieId = parseInt(parts[0]);
    const titleWithYear = parts[1].trim();
    const genresStr = parts[2].trim();
    
    // Extract title and year
    const yearMatch = titleWithYear.match(/\((\d{4})\)$/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
    const name = yearMatch 
      ? titleWithYear.substring(0, titleWithYear.lastIndexOf('(')).trim()
      : titleWithYear;
    
    // Parse genres - lấy genre đầu tiên làm primary
    const genres = genresStr.split('|');
    const primaryGenre = genres[0];
    
    movies.push({
      movieLensId: movieId,
      name,
      year,
      genre: primaryGenre, // Sẽ map sang Genre ObjectId sau
      detail: `${name} is a ${primaryGenre.toLowerCase()} movie from ${year}.`,
      cast: [],
      reviews: [],
      numReviews: 0,
      averageRating: 0,
      totalRatings: 0
    });
    
    if (movies.length % 500 === 0) {
      console.log(`Parsed ${movies.length} movies...`);
    }
  }
  
  console.log(`✅ Parsed ${movies.length} movies`);
  return movies;
}

// Parse ratings để tính stats
async function parseRatingsFile(filePath) {
  console.log('📁 Reading ratings.dat...');
  
  const ratingsMap = new Map();
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    const parts = line.split('::');
    if (parts.length !== 4) continue;
    
    const movieId = parseInt(parts[1]);
    const rating = parseFloat(parts[2]);
    
    if (!ratingsMap.has(movieId)) {
      ratingsMap.set(movieId, { sum: 0, count: 0 });
    }
    
    const stats = ratingsMap.get(movieId);
    stats.sum += rating;
    stats.count += 1;
    
    count++;
    if (count % 100000 === 0) {
      console.log(`Processed ${count} ratings...`);
    }
  }
  
  const movieStats = {};
  for (const [movieId, stats] of ratingsMap.entries()) {
    movieStats[movieId] = {
      averageRating: stats.sum / stats.count,
      totalRatings: stats.count
    };
  }
  
  console.log(`✅ Processed ${count} ratings`);
  return movieStats;
}

// Main
async function main() {
  const movieLensPath = process.argv[2];
  
  if (!movieLensPath) {
    console.error('❌ Usage: node importMovieLensMinimal.js /path/to/ml-1m');
    process.exit(1);
  }
  
  const moviesFile = path.join(movieLensPath, 'movies.dat');
  const ratingsFile = path.join(movieLensPath, 'ratings.dat');
  
  if (!fs.existsSync(moviesFile) || !fs.existsSync(ratingsFile)) {
    console.error('❌ movies.dat or ratings.dat not found');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/moviesApp',
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log('✅ Connected to MongoDB\n');
    
    // Parse data
    const movies = await parseMoviesFile(moviesFile);
    const movieStats = await parseRatingsFile(ratingsFile);
    
    // Add stats to movies
    const moviesWithStats = movies.map(movie => {
      const stats = movieStats[movie.movieLensId];
      if (stats) {
        return { ...movie, ...stats };
      }
      return movie;
    });
    
    console.log('\n💾 Importing to MongoDB...');
    console.log('⚠️  Note: Genres sẽ được tự động tạo nếu chưa có.\n');
    
    // Insert từng movie và handle genre
    let imported = 0;
    let skipped = 0;
    
    for (const movieData of moviesWithStats) {
      try {
        // Tìm hoặc tạo genre
        let genreDoc = await Genre.findOne({ name: movieData.genre });
        
        if (!genreDoc) {
          console.log(`Creating genre: ${movieData.genre}`);
          genreDoc = await Genre.create({ name: movieData.genre });
        }
        
        // Tạo movie với genre ObjectId
        const { genre, ...movieDataWithoutGenre } = movieData;
        await Movie.create({
          ...movieDataWithoutGenre,
          genre: genreDoc._id
        });
        
        imported++;
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} movies...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          skipped++;
        } else {
          console.error(`Error importing ${movieData.name}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Import complete!`);
    console.log(`Imported: ${imported}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    
    // Stats
    const total = await Movie.countDocuments();
    const avgRating = await Movie.aggregate([
      { $group: { _id: null, avg: { $avg: '$averageRating' } } }
    ]);
    
    console.log(`\nTotal movies: ${total}`);
    console.log(`Average rating: ${avgRating[0]?.avg.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main();








