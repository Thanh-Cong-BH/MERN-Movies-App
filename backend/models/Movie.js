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
    // Basic info (giữ nguyên từ schema gốc)
    name: { type: String, required: true },
    image: { type: String },
    year: { type: Number, required: true },
    genre: { type: ObjectId, ref: "Genre", required: true },
    detail: { type: String, required: true },
    cast: [{ type: String }],
    reviews: [reviewSchema],
    numReviews: { type: Number, required: true, default: 0 },
    
    // MovieLens compatibility - CHỈ THÊM 3 FIELDS NÀY
    movieLensId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true
    },
    
    // Cached stats từ Interaction collection (tự động update)
    averageRating: {
      type: Number,
      default: 0
    },
    
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Index cho search
movieSchema.index({ name: 'text', detail: 'text' });
movieSchema.index({ movieLensId: 1 });

const Movie = mongoose.model("Movie", movieSchema, 'movies');
export default Movie;