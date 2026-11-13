import { NativeTabs } from 'expo-router/native-tabs';

import { Colors, Fonts } from '@/constants/theme';
import { useBusiness } from '@/providers/business';

export default function TabsLayout() {
  const { isManager, role } = useBusiness();
  const seesStalls = role === 'manager' || role === 'trainer';

  return (
    <NativeTabs
      tintColor={Colors.link}
      labelStyle={{
        default: { fontFamily: Fonts.semibold, color: Colors.textMuted },
        selected: { fontFamily: Fonts.bold, color: Colors.heading },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="horses">
        <NativeTabs.Trigger.Label>Horses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="list" />
      </NativeTabs.Trigger>

      {seesStalls ? (
        <NativeTabs.Trigger name="stalls">
          <NativeTabs.Trigger.Label>Stalls</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        </NativeTabs.Trigger>
      ) : null}

      {isManager ? (
        <NativeTabs.Trigger name="invoices">
          <NativeTabs.Trigger.Label>Invoices</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="receipt_long" />
        </NativeTabs.Trigger>
      ) : null}

      {isManager ? (
        <NativeTabs.Trigger name="clients">
          <NativeTabs.Trigger.Label>Clients</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        </NativeTabs.Trigger>
      ) : null}

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
