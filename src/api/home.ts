/**
 * Home API (Shuttlr Home v2 backend contract).
 *
 * Endpoints (built in parallel):
 * - GET /home/banners (authenticated)
 * - GET /home/summary (authenticated, query param sports)
 *
 * Caching:
 * If /home/banners fails, returns last good response from AsyncStorage cache
 * (`@meetup/home_banners_cache`), or bundled fallback banner data if no cache exists.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../config/appConfig.json';
import { apiClient } from './client';
import type { Event } from '../types/event';
import { type EventApiItem, mapEventApiItem } from './events';
import type { CourtProvider } from '../types/tournament';

export interface BannerItem {
  id: string;
  image_url: string;
  alt_text: string;
  click_url: string | null;
  is_sponsored: boolean;
}

export interface BannerFallback {
  image_url: string | null;
  alt_text: string;
  click_url: string | null;
  is_sponsored: boolean;
}

export interface HomeBannersResponse {
  interval_seconds: number;
  banners: BannerItem[];
  fallback: BannerFallback;
}

export interface HomeSummaryResponse {
  upcoming_games_this_week: number;
  active_groups: number;
}

export interface HomeMenuLinks {
  about_url: string | null;
  privacy_url: string | null;
  terms_url: string | null;
  help_url: string | null;
}

export interface HomeMenuResponse {
  links: HomeMenuLinks;
  active_groups: number;
  upcoming_games: number;
}

interface RequestOptions {
  correlationId?: string;
}

export const BANNERS_CACHE_KEY = '@meetup/home_banners_cache';
export const MENU_CACHE_KEY = '@meetup/home_menu_cache';
export const LEGAL_LINKS_CACHE_KEY = '@meetup/legal_links_cache';

export const BANNERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MENU_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const LEGAL_LINKS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CacheEnvelope<T> {
  savedAt: number;
  data: T;
}

export const BUNDLED_FALLBACK_BANNER: HomeBannersResponse = {
  interval_seconds: 5,
  banners: [],
  fallback: {
    image_url: null,
    alt_text: `Welcome to ${appConfig.appName} — Play together`,
    click_url: null,
    is_sponsored: false,
  },
};

export async function getCachedBanners(): Promise<HomeBannersResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(BANNERS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
      // Old format without savedAt counts as expired
      return null;
    }
    const age = Date.now() - parsed.savedAt;
    if (age > BANNERS_CACHE_TTL_MS || age < 0) {
      return null;
    }
    return parsed.data as HomeBannersResponse;
  } catch {
    return null;
  }
}

export async function setCachedBanners(data: HomeBannersResponse): Promise<void> {
  try {
    const envelope: CacheEnvelope<HomeBannersResponse> = {
      savedAt: Date.now(),
      data,
    };
    await AsyncStorage.setItem(BANNERS_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Non-blocking cache write failure
  }
}

export async function getHomeBanners(options?: RequestOptions): Promise<HomeBannersResponse> {
  try {
    const { data } = await apiClient.get<HomeBannersResponse>('/home/banners', {
      correlationId: options?.correlationId,
    });
    if (data && Array.isArray(data.banners)) {
      await setCachedBanners(data);
      return data;
    }
    throw new Error('Invalid banners response');
  } catch {
    const cached = await getCachedBanners();
    if (cached) {
      return cached;
    }
    return BUNDLED_FALLBACK_BANNER;
  }
}

export async function getHomeSummary(
  sports?: string[],
  options?: RequestOptions,
): Promise<HomeSummaryResponse> {
  const params: Record<string, string> = {};
  if (sports && sports.length > 0) {
    params.sports = sports.join(',');
  }
  const { data } = await apiClient.get<HomeSummaryResponse>('/home/summary', {
    params,
    correlationId: options?.correlationId,
  });
  return data;
}

export async function getCachedMenu(): Promise<HomeMenuResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(MENU_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
      // Old format without savedAt counts as expired
      return null;
    }
    const age = Date.now() - parsed.savedAt;
    if (age > MENU_CACHE_TTL_MS || age < 0) {
      return null;
    }
    return parsed.data as HomeMenuResponse;
  } catch {
    return null;
  }
}

export async function setCachedMenu(data: HomeMenuResponse): Promise<void> {
  try {
    const envelope: CacheEnvelope<HomeMenuResponse> = {
      savedAt: Date.now(),
      data,
    };
    await AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Non-blocking cache write failure
  }
}

export async function getHomeMenu(options?: RequestOptions): Promise<HomeMenuResponse | null> {
  try {
    const { data } = await apiClient.get<HomeMenuResponse>('/home/menu', {
      correlationId: options?.correlationId,
    });
    if (data && typeof data.active_groups === 'number') {
      await setCachedMenu(data);
      return data;
    }
    throw new Error('Invalid menu response');
  } catch {
    return await getCachedMenu();
  }
}

export interface LegalLinksResponse {
  terms_url: string;
  privacy_url: string;
  terms_version?: string;
}

export async function getCachedLegalLinks(): Promise<LegalLinksResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGAL_LINKS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
      // Old format without savedAt counts as expired
      return null;
    }
    const age = Date.now() - parsed.savedAt;
    if (age > LEGAL_LINKS_CACHE_TTL_MS || age < 0) {
      return null;
    }
    return parsed.data as LegalLinksResponse;
  } catch {
    return null;
  }
}

export async function setCachedLegalLinks(data: LegalLinksResponse): Promise<void> {
  try {
    const envelope: CacheEnvelope<LegalLinksResponse> = {
      savedAt: Date.now(),
      data,
    };
    await AsyncStorage.setItem(LEGAL_LINKS_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Non-blocking cache write failure
  }
}

/**
 * Public legal links endpoint (DES-MEETUP-ADDENDUM-social-login AD-9).
 * Returns terms_url, privacy_url, and terms_version.
 * Caches in AsyncStorage with a 7-day maximum age; uses the cache only when the live call fails.
 */
export async function getLegalLinks(options?: RequestOptions): Promise<LegalLinksResponse | null> {
  try {
    const { data } = await apiClient.get<LegalLinksResponse>('/home/legal-links', {
      correlationId: options?.correlationId,
    });
    if (data && (typeof data.terms_url === 'string' || typeof data.privacy_url === 'string')) {
      await setCachedLegalLinks(data);
      return data;
    }
    throw new Error('Invalid legal links response');
  } catch {
    return await getCachedLegalLinks();
  }
}

/**
 * Helper to get the active terms version:
 * Returns the version from the live or cached legal-links response;
 * if none is available or it is empty, returns appConfig.json terms_version as the offline default.
 */
export async function getTermsVersion(options?: RequestOptions): Promise<string> {
  try {
    const links = await getLegalLinks(options);
    if (links?.terms_version && links.terms_version.trim().length > 0) {
      return links.terms_version.trim();
    }
  } catch {
    // Non-blocking fallback
  }
  return (appConfig as { terms_version?: string }).terms_version || '';
}

export interface HomeUpcomingResponse {
  total: number;
  window_days: number;
  items: Event[];
}

/**
 * Fetch upcoming games (DES-MEETUP-ADDENDUM-closure-report AD-8, DES-MEETUP-ADDENDUM-dashboard AD-20).
 * Server-computed rolling window. No sport filtering.
 */
export async function getUpcoming(options?: RequestOptions): Promise<HomeUpcomingResponse> {
  const { data } = await apiClient.get<{ total: number; window_days: number; items: EventApiItem[] }>(
    '/home/upcoming',
    {
      correlationId: options?.correlationId,
    },
  );
  return {
    total: data.total,
    window_days: data.window_days,
    items: Array.isArray(data.items) ? data.items.map(mapEventApiItem) : [],
  };
}


/**
 * `GET /home/court-booking` (tournament-experience AD-T2, te-b1): the active booking providers in order. An empty list
 * means the Home block and the tournament Overview block are not rendered. A failed call also renders nothing (no
 * cache: the block is optional and carries no user data). Items without an https link are dropped here.
 */
export async function getCourtBooking(options?: RequestOptions): Promise<CourtProvider[]> {
  const { data } = await apiClient.get<{ items?: CourtProvider[] }>('/home/court-booking', {
    correlationId: options?.correlationId,
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter(item => item && typeof item.booking_url === 'string' && /^https:\/\/\S+$/.test(item.booking_url));
}
