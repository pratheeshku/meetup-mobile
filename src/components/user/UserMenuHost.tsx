/**
 * Mounted once at the root (next to `AccessNoticeToast`): serves every `useUserMenu` request with
 * one `UserMenuSheet`, and shows the outcome toast ("Done" or the server's message) after the
 * sheet has closed.
 */
import React from 'react';

import { useUserMenuEngine } from '../../hooks/useUserMenuEngine';
import Toast from '../Toast';
import UserMenuSheet from './UserMenuSheet';

export default function UserMenuHost(): React.JSX.Element {
  const engine = useUserMenuEngine();
  return (
    <>
      <UserMenuSheet engine={engine} />
      <Toast message={engine.toast} onDismiss={engine.dismissToast} />
    </>
  );
}
