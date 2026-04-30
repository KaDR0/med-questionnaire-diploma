import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import QuestionnaireFormPage from "./pages/QuestionnaireFormPage";
import AssessmentResultPage from "./pages/AssessmentResultPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PatientSignupPage from "./pages/PatientSignupPage";
import DoctorSignupPage from "./pages/DoctorSignupPage";
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
import QuestionnaireArchivePage from "./pages/QuestionnaireArchivePage";
import PublicQuestionnaireSuccessPage from "./pages/PublicQuestionnaireSuccessPage";
import PublicQuestionnaireExpiredPage from "./pages/PublicQuestionnaireExpiredPage";
import PublicQuestionnaireInvalidPage from "./pages/PublicQuestionnaireInvalidPage";
import AuditLogPage from "./pages/AuditLogPage";
import AwaitingApprovalPage from "./pages/AwaitingApprovalPage";
import UserRoleManagementPage from "./pages/UserRoleManagementPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import AppShell from "./components/AppShell";
import PatientShell from "./components/PatientShell";
import PatientPortalPage from "./pages/PatientPortalPage";
import { useAuth } from "./context/AuthContext";
import { Box, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth();
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
      <Route
        path="/signup/patient"
        element={isAuthenticated ? <Navigate to="/" replace /> : <PatientSignupPage />}
      />
      <Route
        path="/signup/doctor"
        element={isAuthenticated ? <Navigate to="/" replace /> : <DoctorSignupPage />}
      />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/public/questionnaire/:token" element={<PublicQuestionnairePage />} />
      <Route path="/public/questionnaire/:token/success" element={<PublicQuestionnaireSuccessPage />} />
      <Route path="/public/questionnaire/expired" element={<PublicQuestionnaireExpiredPage />} />
      <Route path="/public/questionnaire/invalid" element={<PublicQuestionnaireInvalidPage />} />

      <Route
        path="/awaiting-approval"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["pending"]}>
              <AppShell>
                <AwaitingApprovalPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === "patient" ? (
              <Navigate to="/patient" replace />
            ) : (
              <AppShell>
                <DashboardPage />
              </AppShell>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["patient"]}>
              <PatientShell>
                <PatientPortalPage section="home" />
              </PatientShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/labs"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["patient"]}>
              <PatientShell>
                <PatientPortalPage section="labs" />
              </PatientShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/questionnaires"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["patient"]}>
              <PatientShell>
                <PatientPortalPage section="questionnaires" />
              </PatientShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/recommendations"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["patient"]}>
              <PatientShell>
                <PatientPortalPage section="recommendations" />
              </PatientShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/notifications"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["patient"]}>
              <PatientShell>
                <PatientPortalPage section="notifications" />
              </PatientShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <PatientsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor", "pending"]}>
              <AppShell>
                <ProfilePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <PatientDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/questionnaires"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <QuestionnairePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/questionnaires/:questionnaireId"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <QuestionnaireFormPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/assessments/:assessmentId"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <AssessmentResultPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/qr"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <CreateQrQuestionnairePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/my"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <MyQuestionnairesPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/create"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <QuestionnaireBuilderPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/:id/edit"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <QuestionnaireBuilderPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/:id"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["doctor", "chief_doctor"]}>
              <AppShell>
                <QuestionnaireDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/pending"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["chief_doctor"]}>
              <AppShell>
                <PendingQuestionnairesPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/archive"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["chief_doctor"]}>
              <AppShell>
                <QuestionnaireArchivePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/questionnaires/review/:id"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["chief_doctor"]}>
              <AppShell>
                <QuestionnaireReviewPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["chief_doctor"]}>
              <AppShell>
                <AuditLogPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/roles"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["chief_doctor"]}>
              <AppShell>
                <UserRoleManagementPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : user?.role === "patient" ? (
            <Navigate to="/patient" replace />
          ) : user?.role === "pending" ? (
            <Navigate to="/awaiting-approval" replace />
          ) : (
            <Navigate to="/" replace />
          )
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