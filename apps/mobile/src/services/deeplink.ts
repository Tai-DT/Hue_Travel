// ============================================
// Deep Linking — Handle URL schemes
// ============================================
// Schema: huetravel://
// URLs:
//   huetravel://booking/:id
//   huetravel://experience/:id
//   huetravel://chat/:roomId
//   https://huetravel.vn/booking/:id (universal link)
// ============================================

import * as Linking from 'expo-linking';

export type DeepLinkRoute =
  | { type: 'booking'; id: string }
  | { type: 'experience'; id: string }
  | { type: 'chat'; roomId: string }
  | { type: 'profile' }
  | { type: 'unknown'; url: string };

const PREFIX = Linking.createURL('/');

/**
 * Parse a deep link URL into a structured route
 */
export function parseDeepLink(url: string): DeepLinkRoute | null {
  if (!url) return null;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path || '';
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'booking' && segments[1]) {
      return { type: 'booking', id: segments[1] };
    }
    if (segments[0] === 'experience' && segments[1]) {
      return { type: 'experience', id: segments[1] };
    }
    if (segments[0] === 'chat' && segments[1]) {
      return { type: 'chat', roomId: segments[1] };
    }
    if (segments[0] === 'profile') {
      return { type: 'profile' };
    }

    // Check query params (e.g., huetravel://?booking_id=xxx)
    const queryBooking = parsed.queryParams?.booking_id;
    if (queryBooking) {
      return { type: 'booking', id: String(queryBooking) };
    }

    const queryExperience = parsed.queryParams?.experience_id;
    if (queryExperience) {
      return { type: 'experience', id: String(queryExperience) };
    }

    return { type: 'unknown', url };
  } catch {
    return null;
  }
}

/**
 * Create a shareable deep link URL
 */
export function createBookingLink(bookingId: string): string {
  return `huetravel://booking/${bookingId}`;
}

export function createExperienceLink(experienceId: string): string {
  return `huetravel://experience/${experienceId}`;
}

/**
 * Get the initial URL that opened the app (cold start)
 */
export async function getInitialDeepLink(): Promise<DeepLinkRoute | null> {
  const url = await Linking.getInitialURL();
  if (!url) return null;
  return parseDeepLink(url);
}

/**
 * Subscribe to incoming deep links (warm start / background)
 * Returns cleanup function
 */
export function onDeepLink(callback: (route: DeepLinkRoute) => void): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    const route = parseDeepLink(event.url);
    if (route) callback(route);
  });

  return () => subscription.remove();
}

export { PREFIX };
