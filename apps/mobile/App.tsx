import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './src/app/Navigation';
import { LoadingView } from './src/components/LoadingView';
import { useBootstrapSession } from './src/features/auth/useBootstrapSession';
import { usePushNotifications } from './src/features/notifications/usePushNotifications';
import { ThemeProvider, useAppTheme } from './src/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function Root() {
  const ready = useBootstrapSession();
  const { scheme } = useAppTheme();
  usePushNotifications();

  if (!ready) return <LoadingView />;

  return (
    <>
      <Navigation />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Root />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
