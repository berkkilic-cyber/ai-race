/**
 * Debug-only icon gallery (scripts/screens/icons.js screenshots it).
 *
 *   /dev/icons?debug=1&size=20&bg=light|dark&labels=0
 *
 * Renders nothing without `debug=1`. Labels are icon ids (developer-facing, not game text).
 */
import { useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, iconGroups } from '@/ui/icons';
import { Text } from '@/ui/locale/Text';
import { palettes } from '@/ui/theme';

const noopSubscribe = () => () => undefined;

export default function IconGallery() {
  const params = useLocalSearchParams<{ debug?: string; size?: string; bg?: string; labels?: string }>();
  // False while hydrating the static HTML (rendered without query params), true after.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated || params.debug !== '1') return null;

  const size = Math.max(8, Math.min(128, Number(params.size) || 28));
  const p = params.bg === 'dark' ? palettes.night : palettes.paper;
  const labels = params.labels !== '0';
  const cell = Math.max(size + 16, labels ? (size >= 48 ? 116 : 104) : size + 16);

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={styles.page}>
      <View testID="icon-gallery-ready">
        {iconGroups.map((g) => (
          <View key={g.id} style={styles.group}>
            <Text style={[styles.heading, { color: p.dim }]}>{`${g.id} (${g.names.length}) at ${size}px`}</Text>
            <View style={styles.grid}>
              {g.names.map((name) => (
                <View key={name} style={[styles.cell, { width: cell }]}>
                  <View style={{ height: size, justifyContent: 'center' }}>
                    <Icon name={name} size={size} color={p.text} accent={p.player} />
                  </View>
                  {labels ? (
                    <Text style={[styles.label, { color: p.dim }]} numberOfLines={1}>
                      {name}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16 },
  group: { marginBottom: 14 },
  heading: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', paddingVertical: 8 },
  label: { fontSize: 10, marginTop: 5 },
});
