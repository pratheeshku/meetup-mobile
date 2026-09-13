/** Auth Stack route params (§4.2 — Sign In, Register). */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

/** Home tab's nested stack route params (§4.3 — Events feed, Event Detail). */
export type HomeStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
};
