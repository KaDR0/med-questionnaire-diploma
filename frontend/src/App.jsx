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
import PublicQuestionnairePage from "./pages/PublicQuestionnairePage";
import CreateQrQuestionnairePage from "./pages/CreateQrQuestionnairePage";
import MyQuestionnairesPage from "./pages/MyQuestionnairesPage";
import PendingQuestionnairesPage from "./pages/PendingQuestionnairesPage";
import DashboardPage from "./pages/DashboardPage";
import QuestionnaireBuilderPage from "./pages/QuestionnaireBuilderPage";
import QuestionnaireDetailPage from "./pages/QuestionnaireDetailPage";
import QuestionnaireReviewPage from "./pages/QuestionnaireReviewPage";
import PublicQuestionnaireSuccessPage from "./pages/PublicQuestionnaireSuccessPage";
import PublicQuestionnaireExpiredPage from "./pages/PublicQuestionnaireExpiredPage";
import PublicQuestionnaireInvalidPage from "./pages/PublicQuestionnaireInvalidPage";
import AuditLogPage from "./pages/AuditLogPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import { Box, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();

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
        <CircularProgress aria-label={t("common.loading")} />
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
      <Route path="/public/questionnaire/:token" element={<PublicQuestionnairePage />} />
      <Route path="/public/questionnaire/:token/success" element={<PublicQuestionnaireSuccessPage />} />
      <Route path="/public/questionnaire/expired" element={<PublicQuestionnaireExpiredPage />} />
      <Route path="/public/questionnaire/invalid" element={<PublicQuestionnaireInvalidPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients"
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
      <Route
        path="/questionnaires/qr"
        element={
          <ProtectedRoute>
            <AppShell>
              <CreateQrQuestionnairePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/my"
        element={
          <ProtectedRoute>
            <AppShell>
              <MyQuestionnairesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/create"
        element={
          <ProtectedRoute>
            <AppShell>
              <QuestionnaireBuilderPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/:id/edit"
        element={
          <ProtectedRoute>
            <AppShell>
              <QuestionnaireBuilderPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/:id"
        element={
          <ProtectedRoute>
            <AppShell>
              <QuestionnaireDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/pending"
        element={
          <ProtectedRoute>
            <AppShell>
              <PendingQuestionnairesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/review/:id"
        element={
          <ProtectedRoute>
            <AppShell>
              <QuestionnaireReviewPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute>
            <AppShell>
              <AuditLogPage />
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