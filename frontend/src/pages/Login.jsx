import {
  Link,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";
import { login } from "../api";

export function Login() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = new FormData(
      event.currentTarget
    );

    const email = form.get("email");
    const password = form.get("password");

    setError("");
    setLoading(true);

    try {
      const data = await login({
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
        err.message || "Login failed."
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
        <h2>Welcome back</h2>

        <p className="auth-subtitle">
          Log in to your RISE account.
        </p>

        <form onSubmit={handleSubmit}>
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
            placeholder="Your password"
            autoComplete="current-password"
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
              ? "Logging in..."
              : "Log in"}
          </button>
        </form>

        <p className="switch-auth">
          Don't have an account?{" "}

          <Link to="/signup">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
