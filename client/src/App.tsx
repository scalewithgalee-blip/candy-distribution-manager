import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const routes = [
  "/",
  "/products",
  "/purchases",
  "/sales",
  "/inventory",
  "/deliveries",
  "/cash",
  "/expenses",
  "/capital",
  "/profit",
  "/weekly-reports",
  "/settings",
] as const;

function Router() {
  return (
    <Switch>
      {routes.map(path => (
        <Route key={path} path={path} component={Home} />
      ))}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
