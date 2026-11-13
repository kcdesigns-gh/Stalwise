import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, EmptyState, ErrorText, Loading, Segmented } from '@/components/ui';
import { APP_WEB_URL } from '@/constants/legal';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { COPIED_NOTICE, SHARE_FAILED, shareText } from '@/lib/share';
import { supabase, type MemberRole } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useAuth } from '@/providers/auth';
import { useBusiness } from '@/providers/business';
import { useState } from 'react';

const INVITABLE_ROLES: MemberRole[] = ['trainer', 'groom', 'casual'];

export default function StaffScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const myId = session?.user.id ?? null;

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
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

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
    setNotice(null);
    setBusy(true);
    const { data: invite, error: e } = await supabase.rpc('create_staff_invite', { bid, role });
    setBusy(false);
    if (e || !invite) return setActionError(e?.message ?? 'The invite could not be created.');
    await reload();
    const message = `You're invited to join ${business!.name} on Stalwise as a ${ROLE_LABELS[role]}.\n\nOpen ${APP_WEB_URL}, create an account, choose “Join with a code” and enter: ${invite.code}\n\n(Valid for 14 days.)`;
    const outcome = await shareText(message);
    if (outcome === 'copied') setNotice(`Invite ${invite.code} created. ${COPIED_NOTICE}`);
    else if (outcome === 'failed') setActionError(`Invite ${invite.code} was created, but it could not be shared. ${SHARE_FAILED}`);
    else setNotice(`Invite ${invite.code} created.`);
  };

  // Removing someone switches their membership off: they lose access at once,
  // and everything they recorded stays. A new invite lets them back in.
  const removeMember = async (membershipId: string) => {
    if (confirmRemove !== membershipId) {
      setConfirmRemove(membershipId);
      return;
    }
    setActionError(null);
    setNotice(null);
    setBusy(true);
    const { error: e } = await supabase.from('memberships').update({ active: false }).eq('id', membershipId);
    if (e) setActionError(e.message);
    else setNotice('Removed from the team. They can no longer open your records.');
    setConfirmRemove(null);
    await reload();
    setBusy(false);
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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ErrorText message={error ?? actionError} />
        {notice ? (
          <AppText color={Colors.success} accessibilityLiveRegion="polite">
            {notice}
          </AppText>
        ) : null}

        <Card gold>
          <AppText variant="heading" accessibilityRole="header">
            Invite staff
          </AppText>
          <AppText variant="small">
            Create a code, then share it with the person. They open {APP_WEB_URL.replace('https://', '')}, create an account and enter the code to join {business!.name}.
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
            data.members.map((m, i) => {
              const isMe = m.user_id === myId;
              const confirming = confirmRemove === m.id;
              return (
                <View key={m.id} style={[styles.memberRow, i < data.members.length - 1 && styles.divider]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">{`${m.name ?? 'Team member'}${isMe ? ' (you)' : ''}`}</AppText>
                    <AppText variant="small">{ROLE_LABELS[m.role]}</AppText>
                  </View>
                  {isMe ? null : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={confirming ? `Tap again to remove ${m.name ?? 'this person'}` : `Remove ${m.name ?? 'this person'} from the team`}
                      onPress={() => removeMember(m.id)}
                      disabled={busy}
                      style={styles.removeButton}>
                      <AppText variant="bodyStrong" color={Colors.danger}>
                        {confirming ? 'Tap again to remove' : 'Remove'}
                      </AppText>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
          {data && data.members.length > 1 ? (
            <AppText variant="small">Removing someone stops their access straight away. What they recorded stays.</AppText>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8, minHeight: 56 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  removeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm },
});
