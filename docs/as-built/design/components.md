# As-built design: mobile components (`src/components`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/components.md](../requirements/components.md) · [screens](screens.md) · [labels_theme_diagnostics](labels_theme_diagnostics.md) (tokens)

## Purpose
84 files (about 16.2k lines): design-system primitives, feature widgets, icon sets.

## Inventory
| Group | Files | Notes |
|---|---|---|
| Primitives (`src/components/`) | Button, Card, Badge, TextField, NumberField, DropdownField, DateTimePickerField, OptionChips, SegmentedSwitch, SelectableCard, TextLink, EmptyState, ErrorView, InlineError, LoadingView, Toast, ScreenContainer, KeyboardAwareScreen, WizardHeader, WizardFooter, IconBadge, UserAvatar | styled only with theme tokens; no business logic |
| Feature widgets (`src/components/`) | EventCard, GroupCard, GameStatusPill, GroupMultiSelect, GroupNamesRow, UserSearchPicker, ShareActionSheet, SkillRequirementPicker, MobileNumberCard/Input, NotificationBanner/Card/PreferencesList, ProfileStatsStrip, SessionCheckRetry, ForceUpdateGate, TournamentsListContent, WipStrip, HeaderAddButton | |
| `home/` | BannerCarousel (522), DashboardBanner, CreateGameCard, DrawerMenu (892), GameRow, GroupRow, HomeTabTiles, HomeTopBar, NextGameCard, SectionParts, ShortcutTiles, SportChipsRow, UnifiedCard (779) | two generations of Home UI coexist ("Home v2" and the dashboard addendum) |
| `venue/` | VenuePicker (700), VenueDetailCard (799), OthersVenueModal (449), VenueIcons, logMapFailure | catalogue search, selection, Others entry, detail |
| `skills/` | SportPicker, LevelPerSportCard, LevelSegmentedControl, LevelDots, LevelPill, MySportRow, SkillLevelFlow, SportLevelSheet, BottomSheet, levels | used by Profile and onboarding |
| `tournament/` | TournamentInvitationBanner, TournamentInvitePanel (411) | driven by server fields such as `my_invitation_status` |
| `onboarding/` | SkillsStep, NotificationsStep, MobileNumberStep, StepFooter | |
| `auth/`, `groups/` | SocialTermsNotice, DeleteGroupSheet | |
| `icons/` | ActionIcons, DashboardIcons, HomeV2Icons, RegistryIcons, SharedIcons, NotificationIcon, sportGlyphs (1,174) | SVG via `react-native-svg`; sport glyphs are a checked-in copy of the backend icon manifest |

## Conventions observed
Theme tokens only (`src/theme/tokens.ts`, `dashboardTheme.ts`); fixed-size boxes for icon-plus-text rows; text via labels; images through `FastImage`; avatars resolved by `utils/avatar.ts` against `ENV.AVATAR_BUCKET_BASE_URL`.

## Drift and findings
- 🟡 MEDIUM Parallel component generations for Home (`UnifiedCard`, `BannerCarousel`, `HomeTabTiles` vs `DashboardBanner`, `GameRow`, `GroupRow`, `NextGameCard`, `ShortcutTiles`) and three icon registries; which are live depends on screen wiring (`HomeScreen` uses both families). Candidates for consolidation; not verified as dead code in this pass.
- 🟡 MEDIUM Very large components (`DrawerMenu` 892, `VenueDetailCard` 799, `UnifiedCard` 779, `VenuePicker` 700).
- 🟢 LOW Sport icon keys and glyphs are a checked-in copy of the backend manifest at commit b1c9d27; a test asserts each key has a glyph, but nothing detects backend manifest drift.
