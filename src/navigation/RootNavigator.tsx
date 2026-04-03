import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { HomeScreen } from '../screens/HomeScreen';
import { EditorScreen } from '../screens/EditorScreen';
import { GraphScreen } from '../screens/GraphScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DailyResurfaceScreen } from '../screens/DailyResurfaceScreen';
import { AddNoteScreen } from '../screens/AddNoteScreen';
import { BackupSetupScreen } from '../screens/BackupSetupScreen';
import { AIAssistantScreen } from '../screens/AIAssistantScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useTheme } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Notes:     'home',
  Graph:     'bubble-chart',
  Search:    'search',
  Resurface: 'auto-awesome',
  Settings:  'settings',
};

function wrap(Screen: React.ComponentType, label: string, useSafeArea = true) {
  return function WrappedScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    if (!useSafeArea) {
      return (
        <ErrorBoundary fallbackLabel={label}>
          <Screen />
        </ErrorBoundary>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ErrorBoundary fallbackLabel={label}>
          <Screen />
        </ErrorBoundary>
      </View>
    );
  };
}

function TabNavigator() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => (
          <MaterialIcons
            name={TAB_ICONS[route.name] ?? 'circle'}
            size={size}
            color={focused ? colors.accent : colors.muted}
          />
        ),
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 60,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
      })}>
      <Tab.Screen name="Notes"     component={wrap(HomeScreen, 'Notes')} />
      <Tab.Screen name="Graph"     component={wrap(GraphScreen, 'Graph')} />
      <Tab.Screen name="Search"    component={wrap(SearchScreen, 'Search')} />
      <Tab.Screen name="Resurface" component={wrap(DailyResurfaceScreen, 'Resurface')} />
      <Tab.Screen name="Settings"  component={wrap(SettingsScreen, 'Settings')} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { isDark, colors } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary:      colors.accent,
      background:   colors.bg,
      card:         colors.surface,
      text:         colors.text,
      border:       colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackTitleVisible: false,
        }}>
        <Stack.Screen name="Main"        component={TabNavigator}                          options={{ headerShown: false }} />
        <Stack.Screen name="AddNote"     component={wrap(AddNoteScreen, 'AddNote')}        options={{ headerShown: false }} />
        <Stack.Screen name="Editor"      component={wrap(EditorScreen, 'Editor', false)}   options={{ title: 'Note' }} />
        <Stack.Screen name="BackupSetup"   component={wrap(BackupSetupScreen, 'BackupSetup')}     options={{ headerShown: false }} />
        <Stack.Screen name="AIAssistant"   component={wrap(AIAssistantScreen, 'AIAssistant', false)} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
