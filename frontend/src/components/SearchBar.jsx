import { useState } from "react";
import { searchUsers } from "../api";

export function SearchBar({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(value) {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);

    try {
      const data = await searchUsers(value);
      setResults(data.users || []);
      setIsOpen(true);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectUser(username) {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onNavigate(`/profile/${username}`);
  }

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => query && setIsOpen(true)}
        placeholder="Search users..."
        className="search-input"
      />

      {isOpen && (
        <div className="search-results">
          {loading ? (
            <div className="search-loading">Searching...</div>
          ) : results.length > 0 ? (
            results.map((user) => (
              <button
                key={user.id}
                className="search-result-item"
                onClick={() => handleSelectUser(user.username)}
              >
                <div className="result-avatar">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {(user.display_name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="result-info">
                  <strong>{user.display_name || "Unknown"}</strong>
                  <span>@{user.username}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="search-empty">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
