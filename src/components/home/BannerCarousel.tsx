/**
 * Banner Carousel (Shuttlr Home v2).
 *
 * Requirements:
 * - 2+ banners auto-rotate at interval_seconds; swipe supported; pause while touched;
 *   if the OS reduce-motion setting is on, no auto-advance.
 * - 1 banner static.
 * - 0 banners shows the fallback (API fallback object, or bundled static fallback asset).
 * - Set accessibilityLabel from alt_text.
 * - Banner with click_url is pressable and opens the system browser (re-checks scheme is
 *   https before opening); without it the banner is not pressable.
 * - "Ad" tag only when is_sponsored.
 * - Dot indicators below.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { BannerFallback, BannerItem } from '../../api/home';
import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { radius, spacing, typography } from '../../theme/tokens';
import { toHttpsUrl } from '../../utils/httpsUrl';

const SHUTTLR_ICON = require('../../assets/shuttlr-icon.png');

interface BannerCarouselProps {
  banners: BannerItem[];
  fallback: BannerFallback;
  intervalSeconds?: number;
}

export default function BannerCarousel({
  banners,
  fallback,
  intervalSeconds = 5,
}: BannerCarouselProps): React.JSX.Element {
  const t = useT();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTouched, setIsTouched] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - spacing.md * 2,
  );

  const scrollRef = useRef<ScrollView>(null);
  const bannerCount = banners.length;
  // 3:1 aspect ratio sizing: height is exactly containerWidth / 3
  const bannerHeight = Math.round(containerWidth / 3);

  // OS Reduce-Motion check
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (isMounted) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        setReduceMotion(enabled);
      },
    );

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  // Auto-advance timer (2+ banners, not touched, reduce motion off)
  useEffect(() => {
    if (bannerCount < 2 || isTouched || reduceMotion) {
      return;
    }

    const intervalMs = Math.max((intervalSeconds || 5) * 1000, 1000);
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % bannerCount;
        scrollRef.current?.scrollTo({
          x: next * containerWidth,
          animated: true,
        });
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [bannerCount, isTouched, reduceMotion, intervalSeconds, containerWidth]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      if (containerWidth > 0) {
        const index = Math.round(offsetX / containerWidth);
        if (index >= 0 && index < bannerCount) {
          setCurrentIndex(index);
        }
      }
    },
    [containerWidth, bannerCount],
  );

  const handleBannerPress = useCallback((clickUrl: string | null | undefined) => {
    const safeUrl = toHttpsUrl(clickUrl);
    if (safeUrl) {
      Linking.openURL(safeUrl).catch(() => {
        // Ignored
      });
    }
  }, []);

  // Case 0 banners: show fallback
  if (bannerCount === 0) {
    const safeFallbackClick = toHttpsUrl(fallback?.click_url);
    const fallbackAlt = fallback?.alt_text || t('mob.home.banner_fallback_alt');

    const content = (
      <View
        style={[styles.bannerCard, { width: containerWidth, height: bannerHeight }]}
        accessible
        accessibilityRole={safeFallbackClick ? 'button' : 'image'}
        accessibilityLabel={fallbackAlt}
      >
        {fallback?.image_url ? (
          <Image
            source={{ uri: fallback.image_url }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fallbackStaticAsset}>
            <Image
              source={SHUTTLR_ICON}
              style={styles.fallbackLogo}
              resizeMode="contain"
            />
            <Text style={styles.fallbackText}>Shuttlr</Text>
            <Text style={styles.fallbackTagline}>
              {t('mob.home.banner_fallback_tagline')}
            </Text>
          </View>
        )}
      </View>
    );

    return (
      <View
        style={styles.container}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        testID="home-banner-fallback"
      >
        {safeFallbackClick ? (
          <Pressable onPress={() => handleBannerPress(fallback.click_url)}>
            {content}
          </Pressable>
        ) : (
          content
        )}
      </View>
    );
  }

  // Case 1 banner: static
  if (bannerCount === 1) {
    const banner = banners[0];
    const safeClick = toHttpsUrl(banner.click_url);
    const isPressable = Boolean(safeClick);

    const content = (
      <View
        style={[styles.bannerCard, { width: containerWidth, height: bannerHeight }]}
        accessible
        accessibilityRole={isPressable ? 'button' : 'image'}
        accessibilityLabel={banner.alt_text}
      >
        <Image
          source={{ uri: banner.image_url }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        {banner.is_sponsored ? (
          <View style={styles.adTag} testID="banner-ad-tag">
            <Text style={styles.adTagText}>{t('mob.home.ad_tag')}</Text>
          </View>
        ) : null}
      </View>
    );

    return (
      <View
        style={styles.container}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        testID="home-banner-single"
      >
        {isPressable ? (
          <Pressable onPress={() => handleBannerPress(banner.click_url)}>
            {content}
          </Pressable>
        ) : (
          content
        )}
      </View>
    );
  }

  // Case 2+ banners: carousel
  return (
    <View
      style={styles.container}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      onTouchStart={() => setIsTouched(true)}
      onTouchEnd={() => setIsTouched(false)}
      onTouchCancel={() => setIsTouched(false)}
      testID="home-banner-carousel"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ width: containerWidth }}
      >
        {banners.map((banner, index) => {
          const safeClick = toHttpsUrl(banner.click_url);
          const isPressable = Boolean(safeClick);

          const cardContent = (
            <View
              style={[styles.bannerCard, { width: containerWidth, height: bannerHeight }]}
              accessible
              accessibilityRole={isPressable ? 'button' : 'image'}
              accessibilityLabel={banner.alt_text}
            >
              <Image
                source={{ uri: banner.image_url }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
              {banner.is_sponsored ? (
                <View style={styles.adTag} testID="banner-ad-tag">
                  <Text style={styles.adTagText}>{t('mob.home.ad_tag')}</Text>
                </View>
              ) : null}
            </View>
          );

          if (isPressable) {
            return (
              <Pressable
                key={banner.id || String(index)}
                onPress={() => handleBannerPress(banner.click_url)}
              >
                {cardContent}
              </Pressable>
            );
          }

          return (
            <View key={banner.id || String(index)}>
              {cardContent}
            </View>
          );
        })}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dotsRow} testID="banner-dots">
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          return (
            <View
              key={banner.id || String(index)}
              style={[styles.dot, isActive ? styles.dotActive : styles.dotIdle]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  bannerCard: {
    aspectRatio: 3,
    borderRadius: dashRadius.card,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  adTag: {
    position: 'absolute',
    top: spacing.xs + 2,
    right: spacing.xs + 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adTagText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#ffffff',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  fallbackStaticAsset: {
    width: '100%',
    height: '100%',
    backgroundColor: dash.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fallbackLogo: {
    width: 48,
    height: 48,
    marginBottom: spacing.xs,
  },
  fallbackText: {
    ...typography.bodyBold,
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  fallbackTagline: {
    ...typography.caption,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs + 2,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotIdle: {
    width: 6,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    width: 18,
    backgroundColor: dash.brand,
  },
});
