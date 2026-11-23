import { StyleSheet, View } from 'react-native';

import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, spacing, voice } from '../theme';
import { AD_CONFIG, bannerEnabled } from './config';

/**
 * The reserved banner area: a slim, clearly bounded box labelled as an ad, off unless
 * AD_CONFIG.bannerEnabled (or `?banner=1` on web). It takes no touches here; a real
 * banner view would be mounted inside it. Callers keep at least `BANNER_GAP` points of
 * empty space between it and any game control.
 */
export const BANNER_GAP = spacing.l;

export function BannerSlot() {
  if (!bannerEnabled()) return null;
  return (
    <View style={styles.slot} pointerEvents="none" accessibilityLabel={t('ui.ads.banner')} testID="ad-banner-slot">
      <Text style={styles.label}>{t('ui.ads.banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: AD_CONFIG.bannerWidth,
    maxWidth: '100%',
    height: AD_CONFIG.bannerHeight,
    marginHorizontal: BANNER_GAP,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  label: { ...voice.calmLabel, color: colors.dim },
});
