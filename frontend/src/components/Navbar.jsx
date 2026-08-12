import { Link, useNavigate } from "react-router-dom";
import { SearchBar } from "./SearchBar";

export function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  function handleLogout() {
    if (onLogout) {
      onLogout();
    }
    navigate("/login");
  }

  function handleNavigate(path) {
    navigate(path);
  }

  if (!user) {
    return null;
  }

  const displayName =
    user.display_name || user.username || "User";

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/home" className="navbar-brand">
          <span className="rise-logo">RISE</span>
        </Link>

        {/* Search */}
        <div className="navbar-search">
          <SearchBar onNavigate={handleNavigate} />
        </div>

        {/* Navigation Links */}
        <div className="navbar-menu">
          <Link
            to="/home"
            className="nav-link"
            title="Home"
          >
            🏠
          </Link>

          <Link
            to={`/profile/${user.username}`}
            className="nav-link"
            title="Profile"
          >
            👤
          </Link>

          <Link
            to="/settings"
            className="nav-link"
            title="Settings"
          >
            ⚙️
          </Link>

          <button
            className="nav-logout"
            onClick={handleLogout}
            title="Log out"
          >
            🚪
          </button>
        </div>

        {/* Mobile Menu */}
        <div className="navbar-user-mobile">
          <Link
            to={`/profile/${user.username}`}
            className="user-name"
          >
            @{user.username}
          </Link>
        </div>
      </div>
    </nav>
  );
}
