import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSessionStore } from '../lib/auth/session-store';
import { useAppTheme } from '../theme';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { MyTasksScreen } from '../screens/dashboard/MyTasksScreen';
import { TaskListScreen } from '../screens/tasks/TaskListScreen';
import { TaskDetailScreen } from '../screens/tasks/TaskDetailScreen';
import { TeamDashboardScreen } from '../screens/dashboard/TeamDashboardScreen';
import { ScorecardScreen } from '../screens/scorecard/ScorecardScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';

export type TasksStackParamList = {
  MyTasks: undefined;
  TaskList: undefined;
  TaskDetail: { id: string };
};

const MyTasksStack = createNativeStackNavigator<TasksStackParamList>();
const AllTasksStack = createNativeStackNavigator<TasksStackParamList>();
const Tabs = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  MyTasksTab: 'checkmark-circle',
  AllTasksTab: 'list',
  Team: 'people',
  ScorecardTab: 'trophy',
  Notifications: 'notifications',
};

function MyTasksStackNavigator() {
  const { colors } = useAppTheme();
  return (
    <MyTasksStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 16, fontWeight: '700', color: colors.text },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.bg },
        headerRight: () => <ThemeToggleButton />,
      }}
    >
      <MyTasksStack.Screen name="MyTasks" component={MyTasksScreen} options={{ title: 'My Tasks' }} />
      <MyTasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task', headerRight: undefined }} />
    </MyTasksStack.Navigator>
  );
}

function AllTasksStackNavigator() {
  const { colors } = useAppTheme();
  return (
    <AllTasksStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 16, fontWeight: '700', color: colors.text },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <AllTasksStack.Screen name="TaskList" component={TaskListScreen} options={{ title: 'All Tasks' }} />
      <AllTasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
    </AllTasksStack.Navigator>
  );
}

/**
 * Bottom tabs (docs/07-FRONTEND-MOBILE.md §4, docs/10-OPEN-DECISIONS.md §N) — added a
 * Scorecard tab so the leaderboard/scorecard feature (web Phase 4) isn't web-only anymore;
 * admin config stays desk-oriented (web only) either way.
 */
function MainTabs() {
  const { colors } = useAppTheme();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate[400],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? TAB_ICONS[route.name] : (`${TAB_ICONS[route.name]}-outline` as keyof typeof Ionicons.glyphMap)} color={color} size={size - 3} />
        ),
      })}
    >
      <Tabs.Screen name="MyTasksTab" component={MyTasksStackNavigator} options={{ title: 'My Tasks' }} />
      <Tabs.Screen name="AllTasksTab" component={AllTasksStackNavigator} options={{ title: 'All Tasks' }} />
      <Tabs.Screen name="Team" component={TeamDashboardScreen} options={{ title: 'Team' }} />
      <Tabs.Screen name="ScorecardTab" component={ScorecardScreen} options={{ title: 'Scorecard' }} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
    </Tabs.Navigator>
  );
}

export function Navigation() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const { scheme, colors } = useAppTheme();

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      primary: colors.primary,
      card: colors.surface,
      border: colors.border,
      text: colors.text,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {currentUser ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
