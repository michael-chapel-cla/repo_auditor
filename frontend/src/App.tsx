import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import DashboardPage from "./features/dashboard/DashboardPage.tsx";
import AuditPage from "./features/audits/AuditPage.tsx";
import ResultsPage from "./features/results/ResultsPage.tsx";
import ContributorsPage from "./features/contributors/ContributorsPage.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

export default function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/audits" element={<AuditPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:auditId" element={<ResultsPage />} />
          <Route path="/contributors" element={<ContributorsPage />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}
