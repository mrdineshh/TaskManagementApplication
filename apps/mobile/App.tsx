import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Karla_400Regular, Karla_500Medium, Karla_600SemiBold, Karla_700Bold } from '@expo-google-fonts/karla';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './src/navigation/Navigation';
import { LoadingView } from './src/components/LoadingView';
import { useBootstrapSession } from './src/features/auth/useBootstrapSession';
import { usePushNotifications } from './src/features/notifications/usePushNotifications';
import { ThemeProvider, useAppTheme } from './src/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function Root() {
  // Studio Desk direction (docs/10-OPEN-DECISIONS.md §M5) — Fraunces/Karla, same pairing as
  // web's tailwind.config.js. makeTypography() (src/theme/index.ts) references these exact
  // family names, so nothing renders with the intended type until this resolves. Gated here
  // (inside ThemeProvider), not in App() directly, since LoadingView itself needs useAppTheme().
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Karla_400Regular,
    Karla_500Medium,
    Karla_600SemiBold,
    Karla_700Bold,
  });
  const ready = useBootstrapSession();
  const { scheme } = useAppTheme();
  usePushNotifications();

  if (!fontsLoaded || !ready) return <LoadingView />;

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
