import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import {
  getProfile,
  getUserPosts,
  followUser,
  unfollowUser,
} from "../api";
import { Navbar } from "../components/Navbar";
import { PostCard } from "../components/PostCard";
import { Loading } from "../components/Loading";

export function Profile({
  user,
  token,
  onLogout,
}) {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setError("");

        const data = getProfile(username);

        const postsData = getUserPosts(
          username,
          token
        );

        const [profileRes, postsRes] =
          await Promise.all([
            data,
            postsData,
          ]);

        setProfile(profileRes.user);
        setPosts(
          Array.isArray(postsRes.posts)
            ? postsRes.posts
            : []
        );
        setFollowing(
          profileRes.user.is_following
        );
      } catch (err) {
        setError(
          err.message ||
          "Failed to load profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [username, token]);

  async function handleFollow() {
    if (!token) {
      return;
    }

    try {
      if (following) {
        await unfollowUser(username, token);
      } else {
        await followUser(username, token);
      }

      setFollowing(!following);

      setProfile((prev) => ({
        ...prev,
        follower_count: following
          ? prev.follower_count - 1
          : prev.follower_count + 1,
      }));
    } catch (err) {
      setError(
        err.message ||
        "Failed to update follow status."
      );
    }
  }

  async function handleDelete(id) {
    setPosts((current) =>
      current.filter((post) => post.id !== id)
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="profile-page">
        <Navbar
          user={user}
          onLogout={onLogout}
        />
        <Loading />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <Navbar
          user={user}
          onLogout={onLogout}
        />
        <main className="profile-content">
          <div className="error">
            {error || "User not found."}
          </div>
        </main>
      </div>
    );
  }

  const displayName =
    profile.display_name ||
    profile.username ||
    "Unknown";

  const isOwnProfile =
    user.username === profile.username;

  return (
    <div className="profile-page">
      <Navbar
        user={user}
        onLogout={onLogout}
      />

      <main className="profile-content">
        {/* Profile Header */}
        <section className="profile-header">
          <div className="profile-avatar">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
              />
            ) : (
              <div className="avatar-lg">
                {displayName.charAt(0)}
              </div>
            )}
          </div>

          <div className="profile-info">
            <h1>{displayName}</h1>

            <p className="profile-username">
              @{profile.username}
            </p>

            {profile.bio && (
              <p className="profile-bio">
                {profile.bio}
              </p>
            )}

            <div className="profile-stats">
              <div>
                <strong>
                  {profile.post_count}
                </strong>
                <span>Posts</span>
              </div>

              <div>
                <strong>
                  {profile.follower_count}
                </strong>
                <span>Followers</span>
              </div>

              <div>
                <strong>
                  {profile.following_count}
                </strong>
                <span>Following</span>
              </div>
            </div>

            {!isOwnProfile && (
              <button
                className={`follow-button ${following ? "following" : ""}`}
                onClick={handleFollow}
              >
                {following
                  ? "Following"
                  : "Follow"}
              </button>
            )}
          </div>
        </section>

        {/* Posts */}
        <section className="profile-posts">
          <h2>Posts</h2>

          {posts.length === 0 ? (
            <div className="feed-message">
              <p>No posts yet.</p>
            </div>
          ) : (
            <div className="feed">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={user}
                  token={token}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
