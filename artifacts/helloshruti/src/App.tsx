import { useEffect } from 'react';
import { useLocation, Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProfile } from '@/hooks/use-profile';

import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import ArticleDetail from '@/pages/ArticleDetail';
import History from '@/pages/History';
import VoiceOverlay from '@/components/VoiceOverlay';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: any }) {
  const { getProfile } = useProfile();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!getProfile()) {
      setLocation('/onboarding');
    }
  }, []);

  if (!getProfile()) return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/article/:id" component={() => <ProtectedRoute component={ArticleDetail} />} />
      <Route path="/history" component={() => <ProtectedRoute component={History} />} />
      <Route path="/:rest*">
        {() => (
          <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-3xl font-serif text-primary mb-4">Page not found</h1>
            <a href="/" className="text-lg text-primary underline">Return home</a>
          </div>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <div className="relative min-h-[100dvh] pb-24 md:pb-0">
            <Router />
            {/* Global Voice Overlay Mount Point */}
            <VoiceOverlay />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;