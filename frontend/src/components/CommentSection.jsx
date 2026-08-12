import { useState, useEffect } from "react";
import { getComments, createComment, deleteComment } from "../api";
import { Avatar } from "./Avatar";

export function CommentSection({ postId, token, user }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  async function loadComments() {
    try {
      setError("");
      const data = await getComments(postId);
      setComments(data.comments || []);
    } catch (err) {
      setError(err.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setIsOpen(true);
    if (comments.length === 0) {
      setLoading(true);
      loadComments();
    }
  }

  async function handlePostComment(e) {
    e.preventDefault();

    const trimmed = newComment.trim();

    if (!trimmed || !token) {
      return;
    }

    setPosting(true);
    setError("");

    try {
      const data = await createComment(postId, trimmed, token);

      if (data.comment) {
        setComments((prev) => [data.comment, ...prev]);
      }

      setNewComment("");
    } catch (err) {
      setError(err.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(id) {
    if (!token) {
      return;
    }

    try {
      await deleteComment(id, token);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete comment");
    }
  }

  return (
    <div className="comment-section">
      <button
        className="comments-toggle"
        onClick={handleOpen}
      >
        💬 {comments.length}
      </button>

      {isOpen && (
        <div className="comments-panel">
          <div className="comments-header">
            <h3>Comments</h3>
            <button
              className="close-button"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {token && (
            <form
              className="comment-form"
              onSubmit={handlePostComment}
            >
              <Avatar
                name={user?.display_name}
                size="sm"
              />

              <div className="comment-input-group">
                <textarea
                  value={newComment}
                  onChange={(e) =>
                    setNewComment(e.target.value)
                  }
                  placeholder="Add a comment..."
                  maxLength={300}
                  disabled={posting}
                  className="comment-textarea"
                />

                <div className="comment-actions">
                  <span>
                    {newComment.length}/300
                  </span>

                  <button
                    type="submit"
                    disabled={
                      posting || !newComment.trim()
                    }
                    className="primary-button-sm"
                  >
                    {posting ? "..." : "Reply"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {error && (
            <div className="error-small">
              {error}
            </div>
          )}

          <div className="comments-list">
            {loading ? (
              <div className="loading-small">
                Loading...
              </div>
            ) : comments.length === 0 ? (
              <div className="empty-state">
                No comments yet
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="comment-item"
                >
                  <Avatar
                    name={comment.display_name}
                    size="sm"
                  />

                  <div className="comment-content">
                    <div className="comment-header">
                      <strong>
                        {comment.display_name ||
                          "Unknown"}
                      </strong>

                      <span>
                        @{comment.username ||
                          "user"}
                      </span>
                    </div>

                    <p>{comment.content}</p>

                    <small>
                      {new Date(
                        comment.created_at
                      ).toLocaleString()}
                    </small>
                  </div>

                  {user &&
                    comment.user_id ===
                      user.id && (
                      <button
                        className="delete-comment"
                        onClick={() =>
                          handleDeleteComment(
                            comment.id
                          )
                        }
                      >
                        ✕
                      </button>
                    )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
