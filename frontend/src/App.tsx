import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TwinProvider, useTwin } from "./context/TwinContext";
import { MainLayout } from "./layouts/MainLayout";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { Campus3DPage } from "./pages/Campus3DPage";
import { DigitalTwinPage } from "./pages/DigitalTwinPage";
import { StudentsPage } from "./pages/StudentsPage";
import { SimulationLabPage } from "./pages/SimulationLabPage";
import { RecoveryOptimizerPage } from "./pages/RecoveryOptimizerPage";
import { ConflictCentrePage, RiskIntelligencePage } from "./pages/ConflictsRiskPage";
import {
  AcademicsPage,
  AdministrationPage,
  AnalyticsPage,
  ClassroomsPage,
  EventsPage,
  ExaminationsPage,
  FacultyPage,
  HostelsPage,
  IncidentsPage,
  InfrastructurePage,
  LaboratoriesPage,
  PlacementsPage,
  SettingsPage,
  TransportationPage,
} from "./pages/ResourceModulesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { authUser } = useTwin();

  if (!authUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/campus-3d" element={<Campus3DPage />} />
        <Route path="/digital-twin" element={<DigitalTwinPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/academics" element={<AcademicsPage />} />
        <Route path="/faculty" element={<FacultyPage />} />
        <Route path="/classrooms" element={<ClassroomsPage />} />
        <Route path="/laboratories" element={<LaboratoriesPage />} />
        <Route path="/examinations" element={<ExaminationsPage />} />
        <Route path="/transportation" element={<TransportationPage />} />
        <Route path="/hostels" element={<HostelsPage />} />
        <Route path="/placements" element={<PlacementsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/infrastructure" element={<InfrastructurePage />} />
        <Route path="/conflicts" element={<ConflictCentrePage />} />
        <Route path="/simulation-lab" element={<SimulationLabPage />} />
        <Route path="/recovery-optimizer" element={<RecoveryOptimizerPage />} />
        <Route path="/risk-intelligence" element={<RiskIntelligencePage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/administration" element={<AdministrationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MainLayout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TwinProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TwinProvider>
    </QueryClientProvider>
  );
}

export default App;
