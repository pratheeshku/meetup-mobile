# Agent Enhancement Report — 2026-10-06

## 1. Parallel Backend Contracts and Graceful Degradation in Client State

### What Happened
During implementation of Shuttlr Home v2, backend endpoints such as `GET /home/banners` and `GET /home/summary` are being developed in parallel and are not yet deployed to the remote backend (`https://meetups.duckdns.org`). The mobile client needed to interface with these new contracts without failing at runtime or blocking the application from loading existing data.

### Why It Matters Generally
Mobile applications consuming active APIs must decouple network availability of freshly drafted endpoints from client stability. When endpoints are developed in parallel across teams, client-side resource loaders must provide cached or local fallback calculations that match the intended server contract semantics so that the UI can function seamlessly whether the endpoint is live, degraded, or offline.

### Suggested Addition
In the Developer Agent Shared Instructions under **Contract Verification**:
> When implementing features where backend endpoints are specified as "in development in parallel", always provide defensive fallback logic (local aggregation or deterministic bundled defaults) and persistent offline/last-known-good caching so that 404/500/network failures do not crash the view or blank screen components.

---

## 2. Token Type Consistency Across Design Tokens and StyleSheet

### What Happened
In React Native, typography objects in design token definitions often vary in shape (e.g. `caption` might be defined while `captionBold` is omitted in favour of `{ ...typography.caption, fontWeight: '700' }`). Using non-existent token helper keys led to compilation errors during `tsc --noEmit`.

### Why It Matters Generally
Strict TypeScript compilation checks catch discrepancies between expected styling utility members and actual definitions. Relying on assumed token naming patterns rather than directly verifying the exported properties of token dictionaries increases iteration cycles.

### Suggested Addition
Under **Pre-code gates (Gate 2)**:
> When styling components using local design tokens (`typography`, `dashRadius`, `colors`), inspect the exported interface directly rather than inferring standard suffixes (`*Bold`, `*Large`).

---

## 3. Responsive Banner Aspect Ratio Calculations on Heterogeneous Viewports

### What Happened
In mobile carousels receiving promotional assets with specified aspect ratios (e.g. 3:1), hardcoding a fixed height (e.g. `height: 140`) results in vertical cropping or letterboxing across varying phone and tablet display widths. Calculating `bannerHeight = Math.round(containerWidth / 3)` and pairing with `aspectRatio: 3` guarantees the asset fills the content width completely without distortion or cutoffs.

### Why It Matters Generally
Banner images designed with a fixed aspect ratio across screen widths should never use static pixel heights when the container width varies with the device screen. Deriving container height dynamically from container width preserves image fidelity across all devices.

### Suggested Addition
Under **Fidelity rules**:
> When a design specifies an exact aspect ratio for an asset across all viewports without a width cap, derive height dynamically from the measured container width (`width / aspect_ratio`) rather than fixing a pixel height.

