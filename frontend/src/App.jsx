import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Home } from "./pages/Home";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { PrivateRoute } from "./PrivateRoute";

import "./App.css";



function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("rise_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const token = localStorage.getItem("rise_token");

  function handleLogout() {
    localStorage.removeItem("rise_token");
    localStorage.removeItem("rise_user");
    setUser(null);
  }

  function handleUserUpdate(updatedUser) {
    setUser(updatedUser);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={user && token ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />}
        />

        <Route path="/login" element={user && token ? <Navigate to="/home" replace /> : <Login />} />

        <Route path="/signup" element={user && token ? <Navigate to="/home" replace /> : <Signup />} />

        <Route
          path="/home"
          element={
            <PrivateRoute user={user} token={token}>
              <Home
                user={user}
                token={token}
                onLogout={handleLogout}
              />
            </PrivateRoute>
          }
        />

        <Route
          path="/profile/:username"
          element={
            <PrivateRoute user={user} token={token}>
              <Profile
                user={user}
                token={token}
                onLogout={handleLogout}
              />
            </PrivateRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <PrivateRoute user={user} token={token}>
              <Settings
                user={user}
                token={token}
                onLogout={handleLogout}
                onUserUpdate={handleUserUpdate}
              />
            </PrivateRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to={user && token ? "/home" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;