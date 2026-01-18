import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema;

const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

const movieSchema = new mongoose.Schema(
  {
    // ==================== BASIC INFO ====================
    name: { type: String, required: true },
    year: { type: Number, required: true },
    genre: { type: ObjectId, ref: "Genre", required: true },
    detail: { type: String, required: true },
    
    // ==================== MEDIA ====================
    image: { type: String },           // Poster URL
    backdrop: { type: String },        // Backdrop URL (ảnh nền)
    
    // ==================== TMDB DATA (MỚI) ====================
    tmdbId: { 
      type: Number, 
      unique: true, 
      sparse: true,
      index: true 
    },
    
    // Thời lượng phim (phút)
    runtime: { 
      type: Number,
      default: null 
    },
    
    // Dán nhãn độ tuổi (G, PG, PG-13, R, NC-17, NR)
    certification: { 
      type: String,
      default: 'NR'  // Not Rated
    },
    
    // Genres từ TMDB (tối đa 3)
    tmdbGenres: [{
      id: Number,
      name: String
    }],
    
    // Cast - diễn viên (tối đa 5)
    cast: [{
      id: Number,
      name: String,
      character: String,
      profilePath: String
    }],
    
    // Director
    director: {
      id: Number,
      name: String,
      profilePath: String
    },
    
    // Các thông tin bổ sung
    originalTitle: { type: String },
    tagline: { type: String },
    popularity: { type: Number },
    voteAverage: { type: Number },     // TMDB rating
    voteCount: { type: Number },
    
    // ==================== MOVIELENS ====================
    movieLensId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true
    },
    
    // ==================== APP STATS ====================
    reviews: [reviewSchema],
    numReviews: { type: Number, required: true, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    
    // ==================== SYNC STATUS ====================
    tmdbSyncedAt: { type: Date },      // Lần cuối sync với TMDB
    tmdbSyncStatus: { 
      type: String, 
      enum: ['pending', 'synced', 'not_found', 'error'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

// Indexes
movieSchema.index({ name: 'text', detail: 'text' });
movieSchema.index({ movieLensId: 1 });
movieSchema.index({ tmdbId: 1 });
movieSchema.index({ tmdbSyncStatus: 1 });

// Virtual: Format runtime thành "2h 15m"
movieSchema.virtual('runtimeFormatted').get(function() {
  if (!this.runtime) return null;
  const hours = Math.floor(this.runtime / 60);
  const minutes = this.runtime % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
});

// Ensure virtuals are included in JSON
movieSchema.set('toJSON', { virtuals: true });
movieSchema.set('toObject', { virtuals: true });

const Movie = mongoose.model("Movie", movieSchema, 'movies');
export default Movie;