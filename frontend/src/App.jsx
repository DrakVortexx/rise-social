import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { signup, login } from "./api";
import "./App.css";

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-logo">RISE</div>
        <h1>Build your audience.</h1>
        <p>Share. Connect. Grow.</p>
      </div>

      <div className="auth-card">
        {children}
      </div>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const email = form.get("email");
    const password = form.get("password");

    setError("");
    setLoading(true);

    try {
      const data = await login({
        email,
        password,
      });

      localStorage.setItem("rise_token", data.token);
      localStorage.setItem("rise_user", JSON.stringify(data.user));

      navigate("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="auth-subtitle">
        Log in to your RISE account.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>

        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>

        <input
          id="password"
          name="password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          required
        />

        {error && <div className="error">{error}</div>}

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="switch-auth">
        Don't have an account?{" "}
        <Link to="/signup">Create one</Link>
      </p>
    </AuthLayout>
  );
}

function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const displayName = form.get("displayName");
    const username = form.get("username");
    const email = form.get("email");
    const password = form.get("password");

    setError("");
    setLoading(true);

    try {
      const data = await signup({
        displayName,
        username,
        email,
        password,
      });

      localStorage.setItem("rise_token", data.token);
      localStorage.setItem("rise_user", JSON.stringify(data.user));

      navigate("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h2>Create your account</h2>

      <p className="auth-subtitle">
        Join RISE and start growing.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="displayName">Display name</label>

        <input
          id="displayName"
          name="displayName"
          type="text"
          placeholder="Your name"
          autoComplete="name"
          required
        />

        <label htmlFor="username">Username</label>

        <input
          id="username"
          name="username"
          type="text"
          placeholder="@username"
          minLength="3"
          maxLength="30"
          autoComplete="username"
          required
        />

        <label htmlFor="email">Email</label>

        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>

        <input
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          minLength="8"
          autoComplete="new-password"
          required
        />

        {error && <div className="error">{error}</div>}

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="switch-auth">
        Already have an account?{" "}
        <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}

function Home() {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("rise_user") || "null"
  );

  function logout() {
    localStorage.removeItem("rise_token");
    localStorage.removeItem("rise_user");
    navigate("/login");
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="brand-logo">RISE</div>

        <div className="home-user">
          <span>{user.display_name}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="home-content">
        <div className="welcome-card">
          <div className="avatar">
            {user.display_name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1>
              Welcome to RISE, {user.display_name} 👋
            </h1>

            <p>@{user.username}</p>
          </div>
        </div>

        <div className="coming-soon">
          <h2>Your feed is coming next 🚀</h2>

          <p>
            Your account is real and connected to the RISE database.
          </p>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/home" replace />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/home"
          element={<Home />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;