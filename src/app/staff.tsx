import { Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, EmptyState, ErrorText, Loading, Segmented } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { supabase, type MemberRole } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';
import { useState } from 'react';

const INVITABLE_ROLES: MemberRole[] = ['trainer', 'groom', 'casual'];

export default function StaffScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading, reload } = useScreenData(async () => {
    const [members, invites] = await Promise.all([
      supabase
        .from('memberships')
        .select('id, role, user_id, active, created_at')
        .eq('business_id', bid)
        .eq('active', true)
        .order('created_at'),
      supabase
        .from('staff_invites')
        .select('id, code, role, expires_at, used_at')
        .eq('business_id', bid)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]);
    const memberRows = must(members) ?? [];
    const { data: profileRows } =
      memberRows.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in(
              'id',
              memberRows.map((m) => m.user_id),
            )
        : { data: [] };
    const names = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));
    return {
      members: memberRows.map((m) => ({ ...m, name: names.get(m.user_id) ?? null })),
      invites: must(invites) ?? [],
    };
  }, [bid]);

  const [role, setRole] = useState<MemberRole>('groom');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Staff" showBack />
        <ErrorText message="Only the Manager can manage staff." />
      </View>
    );
  }
  if (loading && !data) return <Loading />;

  const createInvite = async () => {
    setActionError(null);
    setBusy(true);
    const { data: invite, error: e } = await supabase.rpc('create_staff_invite', { bid, role });
    setBusy(false);
    if (e || !invite) return setActionError(e?.message ?? 'The invite could not be created.');
    await reload();
    const message = `You're invited to join ${business!.name} on Stalwise as a ${ROLE_LABELS[role]}.\n\nDownload Stalwise, sign up, then enter this code to join: ${invite.code}\n\n(Valid for 14 days.)`;
    Share.share({ message }).catch(() => {});
  };

  const revoke = async (id: string) => {
    setActionError(null);
    setBusy(true);
    const { error: e } = await supabase.from('staff_invites').delete().eq('id', id);
    if (e) setActionError(e.message);
    await reload();
    setBusy(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="Staff" showBack />
      <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ErrorText message={error ?? actionError} />

        <Card gold>
          <AppText variant="heading" accessibilityRole="header">
            Invite staff
          </AppText>
          <AppText variant="small">
            Create a code, then share it with the person. They download Stalwise, sign up and enter the code to join {business!.name}.
          </AppText>
          <Segmented
            label="Role"
            options={INVITABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            value={role}
            onChange={setRole}
            disabled={busy}
          />
          <Button icon="add" title="Create and share invite" onPress={createInvite} loading={busy} />
        </Card>

        {data && data.invites.length > 0 ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Pending invites
            </AppText>
            {data.invites.map((inv, i) => (
              <DetailRow
                key={inv.id}
                label={`${inv.code} · ${ROLE_LABELS[inv.role]}`}
                value={`Expires ${formatDate(inv.expires_at)}`}
                onPress={() => revoke(inv.id)}
                last={i === data.invites.length - 1}
              />
            ))}
            <AppText variant="small">Tap an invite to cancel it.</AppText>
          </Card>
        ) : null}

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Team
          </AppText>
          {!data || data.members.length === 0 ? (
            <EmptyState title="Just you so far" message="Invite your trainers and grooms above." />
          ) : (
            data.members.map((m, i) => (
              <DetailRow
                key={m.id}
                label={m.name ?? 'Team member'}
                value={ROLE_LABELS[m.role]}
                last={i === data.members.length - 1}
              />
            ))
          )}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
