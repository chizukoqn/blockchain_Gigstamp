import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider } from "./contexts/AppContext";
import { useApp } from "./contexts/AppContext";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

// Client Pages
import ClientDashboard from "@/pages/client/Dashboard";
import CreateJob from "@/pages/client/CreateJob";
import ClientJobDetail from "@/pages/client/JobDetail";
import ClientProfile from "@/pages/client/Profile";

// Worker Pages
import WorkerDashboard from "@/pages/worker/Dashboard";
import BrowseJobs from "@/pages/worker/BrowseJobs";
import WorkerJobDetail from "@/pages/worker/JobDetail";
import WorkerProfile from "@/pages/worker/Profile";

import Demo from "./pages/Demo";

function ProtectedRoute({ component: Component, requiredRole }: { component: any; requiredRole?: 'client' | 'worker' }) {
  const { currentUser } = useApp();

  if (!currentUser) {
    return <Landing />;
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    return <NotFound />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path={"/"} component={Landing} />
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/demo"} component={Demo} />

      {/* Client Routes */}
      <Route path={"/client/dashboard"}>
        {() => <ProtectedRoute component={ClientDashboard} requiredRole="client" />}
      </Route>
      <Route path={"/client/create-job"}>
        {() => <ProtectedRoute component={CreateJob} requiredRole="client" />}
      </Route>
      <Route path={"/client/job/:jobId"}>
        {() => <ProtectedRoute component={ClientJobDetail} requiredRole="client" />}
      </Route>
      <Route path={"/client/profile"}>
        {() => <ProtectedRoute component={ClientProfile} requiredRole="client" />}
      </Route>

      {/* Worker Routes */}
      <Route path={"/worker/dashboard"}>
        {() => <ProtectedRoute component={WorkerDashboard} requiredRole="worker" />}
      </Route>
      <Route path={"/worker/browse-jobs"}>
        {() => <ProtectedRoute component={BrowseJobs} requiredRole="worker" />}
      </Route>
      <Route path={"/worker/job/:jobId"}>
        {() => <ProtectedRoute component={WorkerJobDetail} requiredRole="worker" />}
      </Route>
      <Route path={"/worker/profile"}>
        {() => <ProtectedRoute component={WorkerProfile} requiredRole="worker" />}
      </Route>

      {/* 404 */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}


export default App;
