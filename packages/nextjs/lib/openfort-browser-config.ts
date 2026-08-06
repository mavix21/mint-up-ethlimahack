export type OpenfortBrowserConfig = {
  publishableKey: string;
  shieldPublishableKey: string;
  recoveryEndpoint?: string;
  feeSponsorshipId?: string;
};

export function resolveOpenfortBrowserConfig({
  publishableKey,
  shieldPublishableKey,
  recoveryEndpoint,
  feeSponsorshipId,
}: {
  publishableKey?: string;
  shieldPublishableKey?: string;
  recoveryEndpoint?: string;
  feeSponsorshipId?: string;
}): OpenfortBrowserConfig | null {
  if (!publishableKey || !shieldPublishableKey) return null;
  return {
    publishableKey,
    shieldPublishableKey,
    recoveryEndpoint: recoveryEndpoint || undefined,
    feeSponsorshipId: feeSponsorshipId || undefined,
  };
}
