import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  getPosts,
  createPost,
  deletePost,
} from "../api";
import { Navbar } from "../components/Navbar";
import { CreatePost } from "../components/CreatePost";
import { PostCard } from "../components/PostCard";
import { Loading } from "../components/Loading";

export function Home({ user, token, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  async function loadPosts() {
    try {
      setError("");
      const data = await getPosts();
      setPosts(
        Array.isArray(data.posts)
          ? data.posts
          : []
      );
    } catch (err) {
      setError(
        err.message ||
        "Failed to load posts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function handlePost(event, videoFile = null) {
    event.preventDefault();

    const trimmed = content.trim();

    if (!trimmed && !videoFile) {
      return;
    }

    if (posting) {
      return;
    }

    if (!token) {
      setError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setPosting(true);
    setError("");

    try {
      const data =
        await createPost(trimmed, token, videoFile);

      if (data.post) {
        setPosts((current) => [
          data.post,
          ...current,
        ]);
      }

      setContent("");
    } catch (err) {
      setError(
        err.message ||
        "Failed to create post."
      );
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id) {
    if (!token) {
      return;
    }

    try {
      setError("");

      await deletePost(id, token);

      setPosts((current) =>
        current.filter(
          (post) => post.id !== id
        )
      );
    } catch (err) {
      setError(
        err.message ||
        "Failed to delete post."
      );
    }
  }

  function handleLikeChange(postId, newLiked) {
    setPosts((current) =>
      current.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            liked_by_me: newLiked,
            like_count: newLiked
              ? post.like_count + 1
              : post.like_count - 1,
          };
        }
        return post;
      })
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="home-page">
      <Navbar user={user} onLogout={onLogout} />

      <main className="home-content">
        {/* Welcome Card */}
        <section className="welcome-card">
          <div className="welcome-avatar">
            {(user.display_name ||
              user.username ||
              "U"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <h1>
              Welcome to RISE,{" "}
              {user.display_name ||
                user.username}
              ! 🚀
            </h1>

            <p>
              @{user.username || "user"}
            </p>
          </div>
        </section>

        {/* Create Post */}
        <CreatePost
          user={user}
          content={content}
          onContentChange={setContent}
          onSubmit={handlePost}
          isPosting={posting}
        />

        {/* Errors */}
        {error && (
          <div className="error">{error}</div>
        )}

        {/* Feed */}
        <section className="feed">
          {loading ? (
            <Loading />
          ) : posts.length === 0 ? (
            <div className="feed-message">
              <h2>Your feed is empty.</h2>

              <p>
                Be the first person to
                post on RISE!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
                token={token}
                onDelete={handleDelete}
                onLikeChange={handleLikeChange}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
