import { useState } from "react";
import { Navigate } from "react-router-dom";
import { updateProfile, getMe } from "../api";
import { Navbar } from "../components/Navbar";

export function Settings({
  user,
  token,
  onLogout,
  onUserUpdate,
}) {
  const [displayName, setDisplayName] =
    useState(user?.display_name || "");
  const [bio, setBio] = useState(
    user?.bio || ""
  );
  const [avatarUrl, setAvatarUrl] =
    useState(user?.avatar_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await updateProfile(
        {
          display_name: displayName,
          bio,
          avatar_url: avatarUrl,
        },
        token
      );

      setSuccess(
        "Profile updated successfully!"
      );

      // Update local storage and parent state
      localStorage.setItem(
        "rise_user",
        JSON.stringify(data.user)
      );

      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
    } catch (err) {
      setError(
        err.message ||
        "Failed to update profile."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="settings-page">
      <Navbar
        user={user}
        onLogout={onLogout}
      />

      <main className="settings-content">
        <section className="settings-card">
          <h1>Settings</h1>

          <div className="settings-section">
            <h2>Profile</h2>

            <form onSubmit={handleSubmit}>
              <label htmlFor="displayName">
                Display Name
              </label>

              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) =>
                  setDisplayName(
                    e.target.value
                  )
                }
                maxLength="50"
                required
                className="form-input"
              />

              <label htmlFor="bio">Bio</label>

              <textarea
                id="bio"
                value={bio}
                onChange={(e) =>
                  setBio(e.target.value)
                }
                maxLength="160"
                placeholder="Tell us about yourself"
                className="form-input"
              />

              <small>
                {bio.length}/160
              </small>

              <label htmlFor="avatarUrl">
                Avatar URL
              </label>

              <input
                id="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) =>
                  setAvatarUrl(
                    e.target.value
                  )
                }
                placeholder="https://example.com/avatar.jpg"
                className="form-input"
              />

              {error && (
                <div className="error">
                  {error}
                </div>
              )}

              {success && (
                <div className="success">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
