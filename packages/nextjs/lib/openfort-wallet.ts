type OpenfortAccount = {
  accountType: string;
  address: string;
  chainType: string;
};

export function selectOpenfortEoa(
  accounts: OpenfortAccount[],
  registeredAddress?: string,
) {
  const evmAccounts = accounts.filter(
    account =>
      account.chainType === "EVM" &&
      account.accountType === "Externally Owned Account",
  );
  if (!registeredAddress) return evmAccounts[0];
  return (
    evmAccounts.find(
      account =>
        account.address.toLowerCase() === registeredAddress.toLowerCase(),
    ) ?? evmAccounts[0]
  );
}
