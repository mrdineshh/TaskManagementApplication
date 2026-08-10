import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSessionStore } from '../lib/auth/session-store';
import { colors } from '../theme';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { MyTasksScreen } from '../screens/dashboard/MyTasksScreen';
import { TaskListScreen } from '../screens/tasks/TaskListScreen';
import { TaskDetailScreen } from '../screens/tasks/TaskDetailScreen';
import { TeamDashboardScreen } from '../screens/dashboard/TeamDashboardScreen';
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

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.slate[50], primary: colors.brand[600], card: colors.white, border: colors.slate[200] },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerShadowVisible: false,
  headerTitleStyle: { fontSize: 16, fontWeight: '700' as const, color: colors.slate[900] },
  headerTintColor: colors.brand[600],
  contentStyle: { backgroundColor: colors.slate[50] },
};

function MyTasksStackNavigator() {
  return (
    <MyTasksStack.Navigator screenOptions={stackScreenOptions}>
      <MyTasksStack.Screen name="MyTasks" component={MyTasksScreen} options={{ title: 'My Tasks' }} />
      <MyTasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
    </MyTasksStack.Navigator>
  );
}

function AllTasksStackNavigator() {
  return (
    <AllTasksStack.Navigator screenOptions={stackScreenOptions}>
      <AllTasksStack.Screen name="TaskList" component={TaskListScreen} options={{ title: 'All Tasks' }} />
      <AllTasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
    </AllTasksStack.Navigator>
  );
}

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  MyTasksTab: 'checkmark-circle',
  AllTasksTab: 'list',
  Team: 'people',
  Notifications: 'notifications',
};

/** Bottom tabs mirror the v1 mobile scope in docs/07-FRONTEND-MOBILE.md §4 — admin excluded. */
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.slate[400],
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.slate[200] },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? TAB_ICONS[route.name] : (`${TAB_ICONS[route.name]}-outline` as keyof typeof Ionicons.glyphMap)} color={color} size={size - 2} />
        ),
      })}
    >
      <Tabs.Screen name="MyTasksTab" component={MyTasksStackNavigator} options={{ title: 'My Tasks' }} />
      <Tabs.Screen name="AllTasksTab" component={AllTasksStackNavigator} options={{ title: 'All Tasks' }} />
      <Tabs.Screen name="Team" component={TeamDashboardScreen} options={{ title: 'Team' }} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
    </Tabs.Navigator>
  );
}

export function Navigation() {
  const currentUser = useSessionStore((s) => s.currentUser);

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
