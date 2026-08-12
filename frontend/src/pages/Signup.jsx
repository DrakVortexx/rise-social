import {
  Link,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";
import { signup } from "../api";

export function Signup() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = new FormData(
      event.currentTarget
    );

    const displayName =
      form.get("displayName");

    const username =
      form.get("username");

    const email =
      form.get("email");

    const password =
      form.get("password");

    setError("");
    setLoading(true);

    try {
      const data = await signup({
        displayName,
        username,
        email,
        password,
      });

      localStorage.setItem(
        "rise_token",
        data.token
      );

      localStorage.setItem(
        "rise_user",
        JSON.stringify(data.user)
      );

      navigate("/home");
    } catch (err) {
      setError(
        err.message ||
        "Could not create account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-logo">RISE</div>

        <h1>Build your audience.</h1>

        <p>Share. Connect. Grow.</p>
      </div>

      <div className="auth-card">
        <h2>Create your account</h2>

        <p className="auth-subtitle">
          Join RISE and start growing.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="displayName">
            Display name
          </label>

          <input
            id="displayName"
            name="displayName"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            required
            className="form-input"
          />

          <label htmlFor="username">
            Username
          </label>

          <input
            id="username"
            name="username"
            type="text"
            placeholder="@username"
            minLength="3"
            maxLength="30"
            autoComplete="username"
            required
            className="form-input"
          />

          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="form-input"
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            minLength="8"
            autoComplete="new-password"
            required
            className="form-input"
          />

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        <p className="switch-auth">
          Already have an account?{" "}

          <Link to="/login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
