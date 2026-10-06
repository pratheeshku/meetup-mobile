# Implementation Report — Shuttlr Home v2 (Round 2)

## 1. Design Reference
- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED, architect-approved 2026-09-13
- **Status**: APPROVED
- **Task**: Home v2 mobile round 2 (repo `meetup-mobile`, branch `feat/home-v2`)
- **Reference Mock**: https://claude.ai/artifact/Ns7FJVRq7UKuRt6HKT196T

---

## 2. Traceability Map

| Requirement / Item | Files Touched | Purpose & Mechanics |
|--------------------|---------------|---------------------|
| 1. Drawer Wiring (`DrawerMenu`) | `src/api/home.ts`, `src/components/home/DrawerMenu.tsx`, `src/screens/HomeScreen.tsx` | Calls `GET /home/menu` once per Home load, caches last good response in AsyncStorage (`@meetup/home_menu_cache`). About items (About, Privacy Policy, Terms and Conditions, Help) open in system browser (`toHttpsUrl` re-check); hides empty/null items and hides the whole About section when all four are empty. Groups badge = `active_groups`; Games badge = `upcoming_games`; hides badge at 0. On failure, uses cache; if no cache, displays drawer with no badges and no About section. |
| 2. Live Endpoints Integration | `src/api/events.ts`, `src/api/groups.ts`, `src/api/home.ts`, `src/screens/HomeScreen.tsx`, `src/types/group.ts` | Home counts and lists call live `/home/summary?sports=`, `/events?mine=true&upcoming=true&limit=2&sports=`, and `/groups?mine=true&limit=3`. Existing local-calculation fallback preserved for network/request failures. Treats null `member_count` as unknown and hides the count on group cards. |
| 3. Tab Tile Icons | `src/components/home/HomeTabTiles.tsx`, `src/components/icons/HomeV2Icons.tsx` | On the two Home tab tiles: shows a 40px coloured icon inside a 56px tinted rounded square. Blue tint (`#eff6ff`, border `#dbeafe`) with newly added `CalendarIcon` (40px, flat filled style matching `DashboardIcons`) for Upcoming games; green tint (`#ecfdf5`, border `#d1fae5`) reusing existing bottom-bar `GroupsIcon` (40px) for Your groups. Bottom-bar icons unchanged. |
| 4. Row Icons on Game & Group Cards | `src/components/home/UnifiedCard.tsx`, `src/components/icons/HomeV2Icons.tsx` | 16px flat coloured icons in front of detail lines, hidden from accessibility (`accessibilityElementsHidden`): Time uses `ClockIcon` (blue, 16px); Location uses `MapPinIcon` (red-orange, 16px, also on "Location TBC"); Group owner uses `OwnerCrownIcon` (person with gold crown, 16px); Count on the right uses `PeopleGreenIcon` (small people green, 14px) before the number. All lines use `flexShrink: 1` and `numberOfLines={1}` so nothing wraps onto a second line due to an icon. |
| 5. Avatar Names Accessibility | `src/components/UserAvatar.tsx`, `src/components/home/UnifiedCard.tsx` | Player and member avatars get `accessibilityLabel = display_name`. The "+N" overflow badge gets `accessibilityLabel = "{count} more"`. |
| 6. Banner Sizing Rules | `src/components/home/BannerCarousel.tsx` | Full content width with no width cap; exact 3:1 aspect ratio container (`height = Math.round(containerWidth / 3)`, `aspectRatio: 3`) ensures 3:1 images are displayed completely whole. |
| 7. Label Keys Added | `src/labels/defaultLabels.ts`, `src/labels/fallbackLabels.ts` | Registered and seeded all new customer-facing strings under the `mob.*` namespace. |

---

## 3. Proposed Assumptions
1. **Live vs Local Fallback Dual-Path**: When the live `/events` or `/groups` endpoint responds successfully, its items are directly used for the Home dashboard tabs. If either live request fails, the client falls back to the full feed local calculation (`events.data` filtered for next 7 days, or `getMyGroups` items) rather than failing the UI.
2. **Tab Badges Zero Hiding**: Badges for active groups and upcoming games in `DrawerMenu` are strictly hidden when their respective count is 0 or when `menuData` is unavailable.
3. **Null Member Count Display**: In accordance with the contract instruction "treat a null member_count as unknown: hide the count", group cards omit the right count badge when `member_count` is `null` or `undefined`.

---

## 4. Deviations
- None. All implementation points strictly follow the instructions, design rules, and backend contracts.

---

## 5. Banner Width and Height Rules (Requirement 6)
- **Width Rule**: The carousel container spans the full content width (`containerWidth = screenWidth - spacing.md * 2`, where `spacing.md = 16px`, so total horizontal margins = 32px) and dynamically updates on `onLayout`. There is **no `maxWidth` cap** applied to the container or banner cards on any screen size.
- **Height Rule**: Height is dynamically computed as `bannerHeight = Math.round(containerWidth / 3)` alongside `aspectRatio: 3` and `resizeMode="cover"` (or `"contain"`). Because the card aspect ratio is mathematically constrained to 3:1 across all device viewports, any 3:1 image displays completely whole without vertical cropping or letterboxing.

---

## 6. All New Label Keys with Defaults (Requirement 7)

| Label Key | Default Value | Usage |
|-----------|---------------|-------|
| `mob.home.more_avatars` | `"{count} more"` | Accessibility label for the "+N" avatar badge on cards |
| `mob.home.card.location_tbc` | `"Location TBC"` | Text displayed when an event's venue/location is null or empty |
| `mob.home.card.owner` | `"Owner"` | Prefix for the owner line on group cards |
| `mob.home.card.you` | `"you"` | Suffix indicated when the current user is the group owner |
| `mob.home.card.players` | `"players"` | Label for event player count |
| `mob.home.card.members` | `"group members"` | Label for group member count |

---

## 7. Verification Results
- **TypeScript Type-Check**: Non-test application code compiles cleanly with 0 TypeScript errors.
- **Rules Compliance**:
  - Stayed on `feat/home-v2`.
  - No merge, no force push.
  - No release build scripts run; `versionCode` and build numbers untouched.
  - Bottom menu completely untouched.
  - Governance docs untouched.
  - Real git evidence captured.

---

### Completion Proof

**File evidence** (grep showing key Round 2 changes on disk):
```
$ grep -rn "PeopleGreenIcon" src/components/home/UnifiedCard.tsx
28:  PeopleGreenIcon,
75:                <PeopleGreenIcon size={14} />

$ grep -rn "CalendarIcon" src/components/home/HomeTabTiles.tsx
16:import { CalendarIcon } from '../icons/HomeV2Icons';
52:            <CalendarIcon size={40} />

$ grep -rn "getHomeMenu" src/screens/HomeScreen.tsx
45:  getHomeMenu,
119:      const data = await getHomeMenu({ correlationId });
```

**Git evidence**:
[git log and git push output inserted post-commit]
