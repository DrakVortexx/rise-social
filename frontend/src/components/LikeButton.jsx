import { likePost, unlikePost } from "../api";

export function LikeButton({
  postId,
  isLiked,
  likeCount,
  token,
  onLikeChange,
}) {
  async function handleLikeClick() {
    if (!token) {
      return;
    }

    try {
      if (isLiked) {
        await unlikePost(postId, token);
      } else {
        await likePost(postId, token);
      }

      onLikeChange(!isLiked);
    } catch (error) {
      console.error("Error updating like:", error);
    }
  }

  return (
    <button
      className={`like-button ${isLiked ? "liked" : ""}`}
      onClick={handleLikeClick}
      title={isLiked ? "Unlike" : "Like"}
    >
      <span className="like-icon">
        {isLiked ? "❤️" : "🤍"}
      </span>
      <span className="like-count">
        {likeCount || 0}
      </span>
    </button>
  );
}
