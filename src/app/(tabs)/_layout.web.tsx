// Web version of the tab bar (office browsers). Same tabs and role rules as
// the phone version, drawn as a plain bottom bar in the Stalwise colours.
import { Tabs } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts } from '@/constants/theme';
import { useBusiness } from '@/providers/business';

function tabIcon(name: IconName) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} color={color} size={24} />;
  }
  return TabIcon;
}

export default function WebTabsLayout() {
  const { isManager, role } = useBusiness();
  const seesStalls = role === 'manager' || role === 'trainer';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.royalBlue,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontFamily: Fonts.bold, fontSize: 12 },
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border, height: 64 },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="horses" options={{ title: 'Horses', tabBarIcon: tabIcon('horses') }} />
      <Tabs.Screen name="stalls" options={{ title: 'Stalls', tabBarIcon: tabIcon('stalls'), href: seesStalls ? undefined : null }} />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices', tabBarIcon: tabIcon('invoices'), href: isManager ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tabIcon('more') }} />
    </Tabs>
  );
}
