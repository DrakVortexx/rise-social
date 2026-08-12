import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { LikeButton } from "./LikeButton";
import { CommentSection } from "./CommentSection";
import { getVideoUrl } from "../api";

export function PostCard({
  post,
  currentUser,
  token,
  onDelete,
  onLikeChange,
}) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const displayName =
    post.display_name ||
    post.username ||
    "Unknown user";

  const username = post.username || "unknown";

  useEffect(() => {
    if (post.video) {
      setVideoLoading(true);
      getVideoUrl(post.id)
        .then((data) => {
          setVideoUrl(data.url);
        })
        .catch((err) => {
          console.error("Failed to load video URL:", err);
        })
        .finally(() => {
          setVideoLoading(false);
        });
    }
  }, [post.id, post.video]);

  function handleDelete() {
    if (onDelete) {
      onDelete(post.id);
    }
  }

  function handleLikeChange(newLiked) {
    if (onLikeChange) {
      onLikeChange(post.id, newLiked);
    }
  }

  return (
    <article className="post-card">
      <div className="post-header">
        <Link
          to={`/profile/${username}`}
          className="post-author-link"
        >
          <Avatar
            name={displayName}
            size="md"
          />

          <div className="post-author-info">
            <strong>{displayName}</strong>
            <span>@{username}</span>
          </div>
        </Link>

        {currentUser &&
          String(post.user_id) ===
            String(currentUser.id) && (
            <button
              className="delete-post-btn"
              onClick={handleDelete}
              title="Delete post"
            >
              ✕
            </button>
          )}
      </div>

      <div className="post-content">
        {post.content && (
          <p>{post.content}</p>
        )}
      </div>

      {post.video && (
        <div className="post-video-container">
          {videoLoading ? (
            <div className="video-loading">
              Loading video...
            </div>
          ) : videoUrl ? (
            <video
              controls
              className="post-video"
              src={videoUrl}
              preload="metadata"
            />
          ) : (
            <div className="video-error">
              Failed to load video
            </div>
          )}
          <div className="video-info">
            {post.video.duration && (
              <span className="video-duration">
                {Math.floor(post.video.duration / 60)}:{String(Math.floor(post.video.duration % 60)).padStart(2, "0")}
              </span>
            )}
            {post.video.file_size && (
              <span className="video-size">
                {(post.video.file_size / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </div>
        </div>
      )}

      <div className="post-timestamp">
        {new Date(
          post.created_at
        ).toLocaleString()}
      </div>

      <div className="post-actions">
        <LikeButton
          postId={post.id}
          isLiked={post.liked_by_me}
          likeCount={post.like_count}
          token={token}
          onLikeChange={handleLikeChange}
        />

        <CommentSection
          postId={post.id}
          token={token}
          user={currentUser}
        />
      </div>
    </article>
  );
}
