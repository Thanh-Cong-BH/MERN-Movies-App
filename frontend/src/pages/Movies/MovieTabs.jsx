import { Link } from "react-router-dom";

const MovieTabs = ({
  userInfo,
  movie,
  hideForm = false,  // NEW: Option to hide form
}) => {
  // Nếu hideForm = true, chỉ hiển thị danh sách reviews
  return (
    <div>
      {/* Reviews List */}
      <section>
        {movie?.reviews?.length === 0 ? (
          <p className="text-gray-500 italic">No reviews yet. Be the first to review!</p>
        ) : (
          <div className="space-y-6">
            {movie?.reviews?.map((review) => (
              <div
                key={review._id}
                className="bg-white/5 rounded-xl p-5"
              >
                {/* Review Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center font-semibold">
                      {review.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold">{review.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Rating Stars */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-lg ${
                          star <= review.rating ? 'text-yellow-500' : 'text-gray-600'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                {/* Review Comment */}
                <p className="text-gray-300 leading-relaxed">
                  {review.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MovieTabs;