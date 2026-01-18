import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  useGetSpecificMovieQuery,
  useAddMovieReviewMutation,
} from "../../redux/api/movies.js";
import MovieTabs from "./MovieTabs.jsx";
import MoviePlayer from "../../component/MoviePlayer.jsx";

const MovieDetails = () => {
  const { id: movieId } = useParams();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { data: movie, refetch } = useGetSpecificMovieQuery(movieId);
  const { userInfo } = useSelector((state) => state.auth);
  const [createReview, { isLoading: loadingMovieReview }] =
    useAddMovieReviewMutation();

  const submitHandler = async (e) => {
    e.preventDefault();

    try {
      await createReview({
        id: movieId,
        rating,
        comment,
      }).unwrap();

      refetch();
      toast.success("Review created successfully");
    } catch (error) {
      toast.error(error.data || error.message);
    }
  };

  // Helper: Format runtime
  const formatRuntime = (minutes) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Back Button */}
      <div className="p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>

      {/* Hero Section - Backdrop */}
      {movie?.backdrop && (
        <div className="relative w-full h-[50vh] overflow-hidden">
          <img
            src={movie.backdrop}
            alt={movie?.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent" />
        </div>
      )}

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto px-6 relative z-10 ${movie?.backdrop ? '-mt-32' : 'mt-4'}`}>
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column - Poster */}
          <div className="flex-shrink-0">
            <img
              src={movie?.image}
              alt={movie?.name}
              className="w-64 rounded-lg shadow-2xl"
            />
          </div>

          {/* Right Column - Info */}
          <div className="flex-1">
            {/* Title & Meta */}
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{movie?.name}</h1>
            
            <div className="flex flex-wrap items-center gap-3 mb-6 text-gray-300">
              <span>{movie?.year}</span>
              
              {movie?.runtime && (
                <>
                  <span className="text-gray-600">•</span>
                  <span>{formatRuntime(movie.runtime)}</span>
                </>
              )}
              
              {movie?.certification && movie.certification !== 'NR' && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="px-2 py-0.5 border border-gray-500 rounded text-sm">
                    {movie.certification}
                  </span>
                </>
              )}

              {movie?.voteAverage > 0 && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-500">⭐</span>
                    {movie.voteAverage.toFixed(1)}
                  </span>
                </>
              )}
            </div>

            {/* Genres */}
            {movie?.tmdbGenres && movie.tmdbGenres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {movie.tmdbGenres.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-4 py-1.5 bg-white/10 rounded-full text-sm hover:bg-white/20 transition-colors"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Tagline */}
            {movie?.tagline && (
              <p className="text-xl italic text-gray-400 mb-6">
                "{movie.tagline}"
              </p>
            )}

            {/* Description */}
            <p className="text-gray-300 leading-relaxed mb-8 max-w-3xl">
              {movie?.detail}
            </p>

            {/* Director */}
            {movie?.director && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Director
                </h3>
                <div className="flex items-center gap-3">
                  {movie.director.profilePath ? (
                    <img
                      src={movie.director.profilePath}
                      alt={movie.director.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-lg">{movie.director.name?.charAt(0)}</span>
                    </div>
                  )}
                  <span className="font-medium">{movie.director.name}</span>
                </div>
              </div>
            )}

            {/* Cast */}
            {movie?.cast && movie.cast.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Cast
                </h3>
                <div className="flex flex-wrap gap-4">
                  {movie.cast.map((actor) => (
                    <div
                      key={actor.id || actor._id || actor.name || actor}
                      className="flex items-center gap-3 bg-white/5 rounded-lg p-2 pr-4"
                    >
                      {typeof actor === 'object' ? (
                        <>
                          {actor.profilePath ? (
                            <img
                              src={actor.profilePath}
                              alt={actor.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                              <span>{actor.name?.charAt(0)}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{actor.name}</p>
                            {actor.character && (
                              <p className="text-xs text-gray-500">{actor.character}</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="font-medium text-sm">{actor}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Movie Player */}
        <div className="mt-12">
          <MoviePlayer movie={movie} />
        </div>

        {/* Review Section - CENTERED */}
        <div className="mt-16 flex justify-center">
          <div className="w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-8 text-center">Reviews</h2>

            {/* Write Review Form */}
            {userInfo ? (
              <div className="bg-white/5 rounded-xl p-6 mb-10">
                <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
                
                <form onSubmit={submitHandler}>
                  {/* Rating Section with Average */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-400 mb-3">
                      Your Rating
                    </label>
                    
                    <div className="flex items-center justify-between">
                      {/* User Rating Stars */}
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`text-3xl transition-transform hover:scale-110 ${
                              star <= rating ? 'text-yellow-500' : 'text-gray-600'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                        {rating > 0 && (
                          <span className="ml-3 text-gray-400 self-center">
                            {rating}/5
                          </span>
                        )}
                      </div>

                      {/* Average Rating Display */}
                      {(movie?.averageRating > 0 || movie?.totalRatings > 0) && (
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-yellow-500">
                              {movie?.averageRating?.toFixed(1) || '0.0'}
                            </span>
                            <span className="text-gray-500">/5</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {movie?.totalRatings || 0} ratings
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-400 mb-3">
                      Your Review
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="You can review the film ONCE ONLY. Think thoroughly."
                      rows={6}
                      className="w-full bg-white/5 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none text-base"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loadingMovieReview || !rating || !comment.trim()}
                    className="w-full px-8 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                  >
                    {loadingMovieReview ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl p-6 mb-10 text-center">
                <p className="text-gray-400 mb-4">Please sign in to write a review</p>
                <Link
                  to="/login"
                  className="inline-block px-6 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg font-semibold transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Reviews List */}
            <MovieTabs
              loadingMovieReview={loadingMovieReview}
              userInfo={userInfo}
              submitHandler={submitHandler}
              rating={rating}
              setRating={setRating}
              comment={comment}
              setComment={setComment}
              movie={movie}
              hideForm={true}
            />
          </div>
        </div>
      </div>

      {/* Bottom Spacing */}
      <div className="h-20" />
    </div>
  );
};

export default MovieDetails;