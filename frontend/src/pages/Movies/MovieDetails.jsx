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
import StarRating from "../../component/StarRating.jsx";

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
    <>
      <div>
        <Link
          to="/"
          className="text-white font-semibold hover:underline ml-[20rem]"
        >
          Go Back
        </Link>
      </div>

      <div className="mt-[2rem]">
        {/* Movie Poster/Backdrop */}
        <div className="flex justify-center items-center">
          <img
            src={movie?.backdrop || movie?.image}
            alt={movie?.name}
            className="w-[70%] rounded"
          />
        </div>

        {/* Container One */}
        <div className="container flex justify-between ml-[20rem] mt-[3rem]">
          <section>
            <h2 className="text-5xl my-4 font-extrabold">{movie?.name}</h2>
            
            {/* Movie Meta Info */}
            <div className="flex items-center gap-4 my-4">
              <span className="text-[#B0B0B0]">{movie?.year}</span>
              
              {movie?.runtime && (
                <span className="text-[#B0B0B0]">
                  • {formatRuntime(movie.runtime)}
                </span>
              )}
              
              {movie?.certification && movie.certification !== 'NR' && (
                <span className="px-2 py-1 border border-gray-500 rounded text-sm">
                  {movie.certification}
                </span>
              )}
            </div>

            {/* Genres */}
            {movie?.tmdbGenres && movie.tmdbGenres.length > 0 && (
              <div className="flex gap-2 my-4">
                {movie.tmdbGenres.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 bg-gray-700 rounded-full text-sm"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Tagline */}
            {movie?.tagline && (
              <p className="text-lg italic text-gray-400 my-4">
                "{movie.tagline}"
              </p>
            )}

            {/* Description */}
            <p className="my-4 xl:w-[35rem] lg:w-[35rem] md:w-[30rem] text-[#B0B0B0]">
              {movie?.detail}
            </p>
          </section>

          <div className="mr-[5rem]">
            {/* Director */}
            {movie?.director && (
              <div className="mb-6">
                <p className="text-lg font-semibold mb-2">Director</p>
                <div className="flex items-center gap-3">
                  {movie.director.profilePath && (
                    <img
                      src={movie.director.profilePath}
                      alt={movie.director.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <span>{movie.director.name}</span>
                </div>
              </div>
            )}

            {/* Cast */}
            <div>
              <p className="text-lg font-semibold mb-2">Cast</p>
              {movie?.cast?.map((actor) => (
                <div 
                  key={actor.id || actor._id || actor.name} 
                  className="flex items-center gap-3 mt-3"
                >
                  {/* Nếu cast là object (format mới) */}
                  {typeof actor === 'object' ? (
                    <>
                      {actor.profilePath && (
                        <img
                          src={actor.profilePath}
                          alt={actor.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium">{actor.name}</p>
                        {actor.character && (
                          <p className="text-sm text-gray-400">
                            as {actor.character}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Nếu cast là string (format cũ) */
                    <p>{actor}</p>
                  )}
                </div>
              ))}
            </div>

            {/* TMDB Rating */}
            {movie?.voteAverage > 0 && (
              <div className="mt-6">
                <p className="text-lg font-semibold mb-2">TMDB Rating</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-yellow-500">
                    ⭐ {movie.voteAverage.toFixed(1)}
                  </span>
                  <span className="text-gray-400">
                    ({movie.voteCount?.toLocaleString()} votes)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Movie Player & Rating */}
        <div>
          <MoviePlayer movie={movie}></MoviePlayer>
          <StarRating movieId={movieId} size="large"></StarRating>
        </div>

        {/* Reviews */}
        <div className="container ml-[20rem]">
          <MovieTabs
            loadingMovieReview={loadingMovieReview}
            userInfo={userInfo}
            submitHandler={submitHandler}
            rating={rating}
            setRating={setRating}
            comment={comment}
            setComment={setComment}
            movie={movie}
          />
        </div>
      </div>
    </>
  );
};

export default MovieDetails;