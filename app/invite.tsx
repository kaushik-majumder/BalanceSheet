/**
 * Route alias for `/invite?email=...` app-links.
 *
 * The invite email link points at https://<host>/invite?email=<encoded>.
 * Expo Router maps the path `/invite` to this file directly when it
 * auto-handles a deep link on cold-start — much more reliable than
 * AuthContext's manual `Linking.getInitialURL()` interception (which
 * has timing + URL-polyfill quirks across Android versions). The
 * actual screen logic lives in `app/invite-finish.tsx`; this just
 * forwards the email along.
 */
import React from 'react';
import InviteFinishScreen from './invite-finish';

export default function InviteRouteAlias() {
  return <InviteFinishScreen />;
}
