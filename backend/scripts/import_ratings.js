import fs from 'fs';
import path from 'path';
import readline from 'readline';
import mongoose from 'mongoose';
import Movie from '../models/Movie.js'; 
import Interaction from '../models/Interaction.js';

import dotenv from 'dotenv';


/**
 * SIMPLIFIED: Import MovieLens ratings trực tiếp vào Interactions
 * Không cần tạo Users - dùng dummy ObjectIds
 * 
 * Usage: node scripts/importRatingsSimple.js /path/to/ml-1m
 */

// Parse và import ratings
async function importRatings(ratingsFilePath) {
  console.log('📁 Reading ratings.dat...');
  
  const fileStream = fs.createReadStream(ratingsFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Load movies với movieLensId
  console.log('🔄 Loading movies...');
  const Movie = mongoose.model('Movie');
  const movies = await Movie.find().select('_id movieLensId');
  
  const movieMap = new Map();
  movies.forEach(movie => {
    if (movie.movieLensId) {
      movieMap.set(movie.movieLensId, movie._id.toString());
    }
  });
  
  console.log(`✅ Loaded ${movieMap.size} movies with movieLensId`);
  
  if (movieMap.size === 0) {
    console.error('❌ No movies found with movieLensId! Run importMovieLensMinimal.js first.');
    process.exit(1);
  }

  // Map MovieLens user IDs to dummy MongoDB ObjectIds
  const userIdMap = new Map();
  
  function getUserObjectId(mlUserId) {
    if (!userIdMap.has(mlUserId)) {
      // Tạo consistent ObjectId từ ML user ID
      // Format: 24 hex chars, dùng mlUserId làm seed
      const hexId = mlUserId.toString().padStart(24, '0').slice(0, 24);
      userIdMap.set(mlUserId, new mongoose.Types.ObjectId(hexId));
    }
    return userIdMap.get(mlUserId);
  }

  let interactions = [];
  let processedCount = 0;
  let skippedCount = 0;
  const batchSize = 5000;

  console.log('\n📊 Processing ratings...\n');

  for await (const line of rl) {
    // Format: UserID::MovieID::Rating::Timestamp
    const parts = line.split('::');
    
    if (parts.length !== 4) continue;
    
    const mlUserId = parseInt(parts[0]);
    const mlMovieId = parseInt(parts[1]);
    const rating = parseFloat(parts[2]);
    const timestamp = parseInt(parts[3]) * 1000; // Convert to milliseconds
    
    // Check if movie exists
    const movieId = movieMap.get(mlMovieId);
    if (!movieId) {
      skippedCount++;
      continue;
    }
    
    // Get or create dummy user ObjectId
    const userId = getUserObjectId(mlUserId);
    
    // Create interaction
    interactions.push({
      userId,
      movieId,
      interactionType: 'rating',
      rating,
      timestamp: new Date(timestamp)
    });
    
    processedCount++;
    
    // Batch insert
    if (interactions.length >= batchSize) {
      try {
        const Interaction = mongoose.model('Interaction');
        await Interaction.insertMany(interactions, { ordered: false });
        console.log(`✓ Imported ${processedCount} ratings (${skippedCount} skipped, ${userIdMap.size} users)`);
      } catch (error) {
        if (error.code !== 11000) { // Ignore duplicates
          console.error('Error inserting batch:', error.message);
        }
      }
      interactions = [];
    }
  }
  
  // Insert remaining
  if (interactions.length > 0) {
    try {
      const Interaction = mongoose.model('Interaction');
      await Interaction.insertMany(interactions, { ordered: false });
    } catch (error) {
      if (error.code !== 11000) {
        console.error('Error inserting final batch:', error.message);
      }
    }
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   Processed: ${processedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Users: ${userIdMap.size}`);
  
  return { processedCount, skippedCount, userCount: userIdMap.size };
}

// Main
async function main() {
  const movieLensPath = process.argv[2];
  
  if (!movieLensPath) {
    console.error('❌ Usage: node importRatingsSimple.js /path/to/ml-1m');
    process.exit(1);
  }
  
  const ratingsFile = path.join(movieLensPath, 'ratings.dat');
  
  if (!fs.existsSync(ratingsFile)) {
    console.error(`❌ ratings.dat not found at ${ratingsFile}`);
    process.exit(1);
  }
  
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/moviesApp',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    );
    console.log('✅ Connected to MongoDB\n');
    
    // Import ratings
    const result = await importRatings(ratingsFile);
    
    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Final Summary:');
    console.log('═'.repeat(50));
    
    const Interaction = mongoose.model('interactions');
    const totalInteractions = await Interaction.countDocuments({ interactionType: 'rating' });
    const uniqueUsers = await Interaction.distinct('userId', { interactionType: 'rating' });
    const uniqueMovies = await Interaction.distinct('movieId', { interactionType: 'rating' });
    
    console.log(`Total interactions: ${totalInteractions.toLocaleString()}`);
    console.log(`Unique users: ${uniqueUsers.length.toLocaleString()}`);
    console.log(`Unique movies: ${uniqueMovies.length.toLocaleString()}`);
    
    if (uniqueUsers.length > 0 && uniqueMovies.length > 0) {
      console.log(`Avg ratings per user: ${(totalInteractions / uniqueUsers.length).toFixed(1)}`);
      console.log(`Avg ratings per movie: ${(totalInteractions / uniqueMovies.length).toFixed(1)}`);
      
      const sparsity = (1 - (totalInteractions / (uniqueUsers.length * uniqueMovies.length))) * 100;
      console.log(`Data sparsity: ${sparsity.toFixed(2)}%`);
    }
    
    // Rating distribution
    console.log('\n⭐ Rating distribution:');
    const ratingDist = await Interaction.aggregate([
      { $match: { interactionType: 'rating' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    ratingDist.forEach(r => {
      const bar = '█'.repeat(Math.floor(r.count / 50000));
      console.log(`  ${r._id} ⭐: ${r.count.toLocaleString()} ${bar}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Done!');
  }
}

// Run
main();








