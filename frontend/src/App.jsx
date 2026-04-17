import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import QuestionnaireFormPage from "./pages/QuestionnaireFormPage";
import AssessmentResultPage from "./pages/AssessmentResultPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProfilePage from "./pages/ProfilePage";
import AboutPage from "./pages/AboutPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import { Box, CircularProgress } from "@mui/material";

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        className="mq-workspace-bg"
        sx={{
          minHeight: "60vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />}
      />
      <Route path="/about" element={<AboutPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <PatientsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProfilePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id"
        element={
          <ProtectedRoute>
            <AppShell>
              <PatientDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/questionnaires"
        element={
          <ProtectedRoute>
            <AppShell>
              <QuestionnairePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/questionnaires/:questionnaireId"
        element={
          <ProtectedRoute>
            <AppShell>
              <QuestionnaireFormPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/assessments/:assessmentId"
        element={
          <ProtectedRoute>
            <AppShell>
              <AssessmentResultPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;