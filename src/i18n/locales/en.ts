const en = {
  themeLight: "Theme: Light",
  themeDark: "Theme: Dark",
  themeAuto: "Theme: Auto",
  refreshTip: "Double-click to refresh",
  clickToLoad: "Click refresh to load",
  storedLocally: "All data stored locally",
  highlightPaidTip: "Double-click to highlight paid",
  paid: "Paid",
  monthly: "Monthly",
  connectAccount: "Connect your account",
  signIn: "Sign in",
  renews: "Renews",
  daySuffix: "d",
  freePlan: "Free plan",
  active: "Active",
  notSubscribed: "Not subscribed",
  priceMo: "/mo",
  priceYr: "/yr",
};

export type LocaleMessages = Record<keyof typeof en, string>;
export default en;
