// Web version of the tab routes (office browsers). The persistent top nav
// lives in the root layout now, so this just keeps the route group working
// without drawing a second (bottom) bar underneath it.
import { Tabs } from 'expo-router/tabs';

import { Colors } from '@/constants/theme';
import { useBusiness } from '@/providers/business';

export default function WebTabsLayout() {
  const { isManager, role } = useBusiness();
  const seesStalls = role === 'manager' || role === 'trainer';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="horses" options={{ title: 'Horses' }} />
      <Tabs.Screen name="stalls" options={{ title: 'Stalls', href: seesStalls ? undefined : null }} />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices', href: isManager ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
