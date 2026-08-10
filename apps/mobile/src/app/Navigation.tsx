import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSessionStore } from '../lib/auth/session-store';
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

function MyTasksStackNavigator() {
  return (
    <MyTasksStack.Navigator>
      <MyTasksStack.Screen name="MyTasks" component={MyTasksScreen} options={{ title: 'My Tasks' }} />
      <MyTasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
    </MyTasksStack.Navigator>
  );
}

function AllTasksStackNavigator() {
  return (
    <AllTasksStack.Navigator>
      <AllTasksStack.Screen name="TaskList" component={TaskListScreen} options={{ title: 'All Tasks' }} />
      <AllTasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
    </AllTasksStack.Navigator>
  );
}

/** Bottom tabs mirror the v1 mobile scope in docs/07-FRONTEND-MOBILE.md §4 — admin excluded. */
function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="MyTasksTab" component={MyTasksStackNavigator} options={{ title: 'My Tasks' }} />
      <Tabs.Screen name="AllTasksTab" component={AllTasksStackNavigator} options={{ title: 'All Tasks' }} />
      <Tabs.Screen name="Team" component={TeamDashboardScreen} options={{ title: 'Team' }} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Tabs.Navigator>
  );
}

export function Navigation() {
  const currentUser = useSessionStore((s) => s.currentUser);

  return (
    <NavigationContainer>
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
