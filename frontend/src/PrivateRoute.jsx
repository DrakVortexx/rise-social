import { Navigate } from "react-router-dom";

export function PrivateRoute({ children, user, token }) {
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
