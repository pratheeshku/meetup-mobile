# DRAFT, NOT POSTED. For https://github.com/react-native-datetimepicker/datetimepicker/issues/new

Fill every TODO before posting. Search existing issues for "iOS 27" first.

---

**Title:** [iOS] display="spinner" wheels invisible on iPhone 16 / iOS 27.0.1 (still touchable, ticks audible)

## Environment
- `@react-native-community/datetimepicker`: 9.2.1
- react-native: 0.86.3 (bare workflow, not Expo)
- Architecture: TODO (Fabric/new arch on or off)
- Failing device: iPhone 16, iOS 27.0.1
- Working device: iPad, iOS TODO (owner to confirm the iPad's iOS version)
- Build: TestFlight / release build 34 (TODO: confirm; also whether a debug build reproduces)
- Dark Mode: off (not related)

## Description
With `display="spinner"` the picker occupies its space and responds to touch: the owner can feel the wheel and hear the selection ticks, but nothing is drawn. The same build on an iPad shows the picker correctly. Reproduces for `mode="date"` and `mode="time"`.

## Minimal usage
```tsx
import React, {useState} from 'react';
import {View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Repro() {
  const [value, setValue] = useState(new Date());
  return (
    <View style={{flex: 1, justifyContent: 'center', backgroundColor: '#fff'}}>
      <DateTimePicker
        value={value}
        mode="date"
        display="spinner"
        onChange={(_e, d) => d && setValue(d)}
      />
    </View>
  );
}
```
TODO: confirm this exact snippet reproduces in a clean app; the failing report comes from a full app where the picker is in a modal and inline in a screen.

## Expected
Spinner wheels are visible.

## Actual
Nothing visible on iPhone 16 / iOS 27.0.1; the control still scrolls and ticks.

## Already checked
- Not Dark Mode.
- iPad works with the same build.
- Changelog 9.0.0 to 9.2.1 and the open issues list show no iOS 26/27 entry (searched 2026-10-19, first results page only).

## Workaround attempts
- TODO: result of setting `themeVariant="light"` and an explicit `textColor` (shipped in our app as an experiment; outcome pending TestFlight).
- TODO: whether `display="inline"` or `"compact"` renders on the same device.
