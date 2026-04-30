import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RoleRoute({ allowedRoles = [], children }) {
  const { user } = useAuth();
  const role = user?.role;

  if (!allowedRoles.includes(role)) {
    if (role === "patient") {
      return <Navigate to="/patient" replace />;
    }
    if (role === "pending") {
      return <Navigate to="/awaiting-approval" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RoleRoute;

