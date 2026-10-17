# As-built requirements (mobile): Components

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MCMP-nn`. Owner assigns version and status.
Design: [design/components.md](../design/components.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MCMP-01 | All colours, spacing and type come from theme tokens. | `theme/tokens.ts`; components |
| AB-MCMP-02 | Icon-plus-text rows use fixed-size boxes. | convention in `icons/`, rows |
| AB-MCMP-03 | Section errors are shown inline with a retry; one failed section does not blank a screen. | `ErrorView`, `InlineError`, `useResource` |
| AB-MCMP-04 | A game or group card shows status, schedule, location and sport; avatar images resolve from the configured bucket. | `EventCard`, `GroupCard`, `avatar.ts` |
| AB-MCMP-05 | The venue picker searches the catalogue by sport, shows details, and offers an Others entry. | `components/venue` |
| AB-MCMP-06 | Sport icons come from a bundled glyph set keyed by the backend manifest. | `icons/sportGlyphs.tsx` |
| AB-MCMP-07 | The app-wide update gate blocks the app when required and lets it through on any check failure. | `ForceUpdateGate` |

## Not evidenced in code (owner decision needed)
- Component-level accessibility labels policy.
- Storybook or visual regression coverage.
