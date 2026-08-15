import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DocumentationTeam from "./pages/DocumentationTeam";
import SystemAdmin from "./pages/SystemAdmin";
import ManagementPortal from "./pages/ManagementPortal";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tidcatlas.ly/"} component={Home} />
      <Route path={"/public"} component={Home} />
      <Route path={"/tidcatlas.ly/public"} component={Home} />
      <Route path={"/management"} component={ManagementPortal} />
      <Route path={"/tidcatlas.ly/management"} component={ManagementPortal} />
      <Route path={"/documentation-team"} component={DocumentationTeam} />
      <Route path={"/tidcatlas.ly/documentation-team"} component={DocumentationTeam} />
      <Route path={"/system-admin"} component={SystemAdmin} />
      <Route path={"/tidcatlas.ly/system-admin"} component={SystemAdmin} />
      <Route path={"/admin"} component={SystemAdmin} />
      <Route path={"/tidcatlas.ly/admin"} component={SystemAdmin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
