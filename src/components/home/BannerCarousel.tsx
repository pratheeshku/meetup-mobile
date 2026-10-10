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
import { dash } from '../../theme/dashboardTheme';
import { radius, spacing, typography } from '../../theme/tokens';
import { toHttpsUrl } from '../../utils/httpsUrl';
import { imageUrlKey, perfLog } from '../../diagnostics/perfLog';

const SHUTTLR_ICON = require('../../assets/shuttlr-icon.png');

const GAP = 12;

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
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isTouched, setIsTouched] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - spacing.md * 2,
  );

  const scrollRef = useRef<ScrollView>(null);
  const jumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef(1);
  currentIndexRef.current = currentIndex;

  const containerWidthRef = useRef(containerWidth);
  containerWidthRef.current = containerWidth;

  const bannerIds = banners.map(b => b.id).join(',');
  const prevBannerIdsRef = useRef(bannerIds);
  const stableBannersRef = useRef(banners);
  if (bannerIds !== prevBannerIdsRef.current) {
    prevBannerIdsRef.current = bannerIds;
    stableBannersRef.current = banners;
  }
  const activeBanners = bannerIds === prevBannerIdsRef.current ? stableBannersRef.current : banners;

  const bannerCount = activeBanners.length;
  // 3:1 aspect ratio sizing: height is exactly containerWidth / 3
  const bannerHeight = Math.round(containerWidth / 3);
  const step = containerWidth + GAP;

  // Jump helper: when at trailing clone (N+1) jump to 1; when at leading clone (0) jump to N
  const handleJumpIfNeeded = useCallback((idx: number) => {
    if (bannerCount < 2) return;
    const currentStep = containerWidthRef.current + GAP;
    if (idx >= bannerCount + 1) {
      setCurrentIndex(1);
      scrollRef.current?.scrollTo({
        x: 1 * currentStep,
        animated: false,
      });
    } else if (idx <= 0) {
      setCurrentIndex(bannerCount);
      scrollRef.current?.scrollTo({
        x: bannerCount * currentStep,
        animated: false,
      });
    }
  }, [bannerCount]);

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

  // Clean up jump timeout on unmount
  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
      }
    };
  }, []);

  // Auto-advance timer (2+ banners, not touched, reduce motion off)
  useEffect(() => {
    if (bannerCount < 2 || isTouched || reduceMotion) {
      return;
    }

    const intervalMs = Math.max((intervalSeconds || 5) * 1000, 1000);
    const timer = setInterval(() => {
      const next = currentIndexRef.current + 1;
      const currentStep = containerWidthRef.current + GAP;
      setCurrentIndex(next);
      scrollRef.current?.scrollTo({
        x: next * currentStep,
        animated: true,
      });

      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
      }
      jumpTimeoutRef.current = setTimeout(() => {
        handleJumpIfNeeded(next);
      }, 450);
    }, intervalMs);

    return () => {
      clearInterval(timer);
      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
      }
    };
  }, [bannerCount, isTouched, reduceMotion, intervalSeconds, handleJumpIfNeeded]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
        jumpTimeoutRef.current = null;
      }
      const offsetX = event.nativeEvent.contentOffset.x;
      const currentStep = containerWidthRef.current + GAP;
      if (currentStep > 0) {
        const index = Math.round(offsetX / currentStep);
        setCurrentIndex(index);
        handleJumpIfNeeded(index);
      }
    },
    [handleJumpIfNeeded],
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
            onLoadStart={() => perfLog('img_load_start', { url: imageUrlKey(fallback.image_url!) })}
            onLoad={e =>
              perfLog('img_load', {
                url: imageUrlKey(fallback.image_url!),
                width: e.nativeEvent.source.width,
                height: e.nativeEvent.source.height,
              })
            }
            onError={() => perfLog('img_error', { url: imageUrlKey(fallback.image_url!) })}
          />
        ) : (
          <View style={styles.fallbackStaticAsset}>
            <Image
              source={SHUTTLR_ICON}
              style={styles.fallbackLogo}
              resizeMode="contain"
            />
            <Text style={styles.fallbackText}>{t('mob.brand.name')}</Text>
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
    const banner = activeBanners[0];
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
          onLoadStart={() => perfLog('img_load_start', { url: imageUrlKey(banner.image_url) })}
          onLoad={e =>
            perfLog('img_load', {
              url: imageUrlKey(banner.image_url),
              width: e.nativeEvent.source.width,
              height: e.nativeEvent.source.height,
            })
          }
          onError={() => perfLog('img_error', { url: imageUrlKey(banner.image_url) })}
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

  // Case 2+ banners: carousel with leading and trailing clones
  const slides = [
    { banner: activeBanners[bannerCount - 1], isClone: true, key: 'clone-leading' },
    ...activeBanners.map((b, i) => ({ banner: b, isClone: false, key: b.id || `banner-${i}` })),
    { banner: activeBanners[0], isClone: true, key: 'clone-trailing' },
  ];

  const realIndex = ((currentIndex - 1) % bannerCount + bannerCount) % bannerCount;

  return (
    <View
      style={styles.container}
      onLayout={e => {
        const newWidth = e.nativeEvent.layout.width;
        setContainerWidth(newWidth);
        const currentStep = newWidth + GAP;
        scrollRef.current?.scrollTo({
          x: currentIndexRef.current * currentStep,
          animated: false,
        });
      }}
      onTouchStart={() => setIsTouched(true)}
      onTouchEnd={() => setIsTouched(false)}
      onTouchCancel={() => setIsTouched(false)}
      testID="home-banner-carousel"
    >
      <View
        style={[
          styles.carouselWrapper,
          { width: containerWidth, height: bannerHeight },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          contentOffset={{ x: 1 * step, y: 0 }}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={[styles.carouselScrollView, { width: containerWidth }]}
        >
          {slides.map(slide => {
            const { banner, isClone, key } = slide;
            const safeClick = toHttpsUrl(banner.click_url);
            const isPressable = Boolean(safeClick);

            const cardContent = (
              <View
                style={[
                  styles.bannerCard,
                  { width: containerWidth, height: bannerHeight, marginRight: GAP },
                ]}
                accessible={!isClone}
                accessibilityElementsHidden={isClone}
                importantForAccessibility={isClone ? 'no-hide-descendants' : 'auto'}
                accessibilityRole={isPressable ? 'button' : 'image'}
                accessibilityLabel={isClone ? undefined : banner.alt_text}
              >
                <Image
                  source={{ uri: banner.image_url }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                  onLoadStart={() => perfLog('img_load_start', { url: imageUrlKey(banner.image_url) })}
                  onLoad={e =>
                    perfLog('img_load', {
                      url: imageUrlKey(banner.image_url),
                      width: e.nativeEvent.source.width,
                      height: e.nativeEvent.source.height,
                    })
                  }
                  onError={() => perfLog('img_error', { url: imageUrlKey(banner.image_url) })}
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
                  key={key}
                  onPress={() => handleBannerPress(banner.click_url)}
                  accessible={!isClone}
                  accessibilityElementsHidden={isClone}
                  importantForAccessibility={isClone ? 'no-hide-descendants' : 'auto'}
                >
                  {cardContent}
                </Pressable>
              );
            }

            return (
              <View
                key={key}
                accessible={!isClone}
                accessibilityElementsHidden={isClone}
                importantForAccessibility={isClone ? 'no-hide-descendants' : 'auto'}
              >
                {cardContent}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Dots */}
      <View style={styles.dotsRow} testID="banner-dots">
        {activeBanners.map((banner, index) => {
          const isActive = index === realIndex;
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
  carouselWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  carouselScrollView: {
    overflow: 'visible',
  },
  bannerCard: {
    aspectRatio: 3,
    borderRadius: 16,
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
