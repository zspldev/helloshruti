import { useEffect } from 'react';
import { useLocation, Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useRef } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProfile } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Headphones, BookOpen } from 'lucide-react';
import { FEATURES } from '@/config/features';

import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import ArticleDetail from '@/pages/ArticleDetail';
import History from '@/pages/History';
import VoiceOverlay from '@/components/VoiceOverlay';
import ListenPlayer from '@/components/ListenPlayer';

const queryClient = new QueryClient();

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var, leave
// publishableKey undefined, or replace publishableKeyFromHost with anything else.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV — the empty dev value
// is intentional, and any branching breaks the prod proxy.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(124 35% 18%)',
    colorForeground: 'hsl(135 4% 18%)',
    colorMutedForeground: 'hsl(130 3% 45%)',
    colorBackground: 'hsl(36 33% 97%)',
    colorInput: '#ffffff',
    colorInputForeground: 'hsl(135 4% 18%)',
    colorDanger: '#c0392b',
    colorNeutral: 'hsl(84 10% 85%)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-2xl text-primary',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground font-medium',
    formFieldLabel: 'text-foreground font-medium',
    footerActionLink: 'text-primary font-medium',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-primary',
    alertText: 'text-foreground',
    logoBox: 'mb-2',
    logoImage: 'h-12 w-12 rounded-xl',
    socialButtonsBlockButton: 'border border-border hover:bg-secondary/50',
    formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    formFieldInput: 'bg-white border border-border text-foreground',
    footerAction: 'text-center',
    dividerLine: 'bg-border',
    alert: 'bg-secondary/50 border border-border',
    otpCodeFieldInput: 'border border-border',
    formFieldRow: '',
    main: '',
  },
};

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <img src={`${basePath}/logo.svg`} alt="HelloShruti" className="h-10 w-10 rounded-xl" />
        <span className="text-2xl font-serif text-primary">HelloShruti</span>
      </div>
      {children}
    </div>
  );
}

function SignInPage() {
  return (
    <AuthLayout>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthLayout>
  );
}

function LandingPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-8 shadow-md">
          <Headphones className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight mb-6">
          Hello. I'm Shruti.
        </h1>
        <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
          Your daily briefing — real news, curated to your interests, read aloud and explained in
          plain language.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button size="lg" className="text-lg h-14 px-8" onClick={() => setLocation('/sign-up')}>
            Get Started
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg h-14 px-8"
            onClick={() => setLocation('/sign-in')}
          >
            Sign In
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 pb-10 text-muted-foreground">
        <BookOpen className="w-5 h-5" />
        <span>Live news, always in your language of choice.</span>
      </div>
    </div>
  );
}

function PostSignInRedirect() {
  const { getProfile } = useProfile();
  const profile = getProfile();
  return <Redirect to={profile ? '/dashboard' : '/onboarding'} />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <PostSignInRedirect />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// Helps user's webview stay up-to-date when the signed-in user changes by invalidating the QueryClient cache.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to continue your daily briefing',
          },
        },
        signUp: {
          start: {
            title: 'Meet Shruti',
            subtitle: 'Create your account to get started',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <div className="relative min-h-[100dvh] pb-24 md:pb-0">
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/onboarding" component={() => <ProtectedPage component={Onboarding} />} />
            <Route path="/dashboard" component={() => <ProtectedPage component={Dashboard} />} />
            <Route
              path="/article/:id"
              component={() => <ProtectedPage component={ArticleDetail} />}
            />
            <Route path="/history" component={() => <ProtectedPage component={History} />} />
            <Route path="/:rest*">
              {() => (
                <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
                  <h1 className="text-3xl font-serif text-primary mb-4">Page not found</h1>
                  <a href="/" className="text-lg text-primary underline">
                    Return home
                  </a>
                </div>
              )}
            </Route>
          </Switch>
          <Show when="signed-in">
            {FEATURES.voiceInteraction && <VoiceOverlay />}
            <ListenPlayer />
          </Show>
        </div>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </TooltipProvider>
  );
}

export default App;
