/**
 * Renders the "no longer available" notice (`navigation/accessNotice.ts`) with
 * the existing `Toast`. Mounted once, at the root, so it survives the detail
 * screen that raised it closing.
 */
import React, { useSyncExternalStore } from 'react';

import Toast from './Toast';
import { useT } from '../labels/LabelsContext';
import {
  clearAccessNotice,
  isAccessNoticeShowing,
  subscribeToAccessNotice,
} from '../navigation/accessNotice';

export default function AccessNoticeToast(): React.JSX.Element {
  const t = useT();
  const showing = useSyncExternalStore(subscribeToAccessNotice, isAccessNoticeShowing);
  return (
    <Toast
      message={showing ? t('mob.access.no_longer_available') : null}
      onDismiss={clearAccessNotice}
    />
  );
}
