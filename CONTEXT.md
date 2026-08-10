# Mint Up Passes

Mint Up Passes lets visitors acquire admission for Mint Up events without crypto tooling.

## Language

**Event Pass**:
A buyer-facing admission credential for one Event, corresponding to one Issued Event Ticket acquired in one Ticket Order. It is the only purchase term buyers see.
_Avoid_: Ticket, NFT, token, Ticket Order, Issued Event Ticket

**Event Pass Collectible**:
The standards-compatible public representation of an Event Pass for external collection tools. It shares the Event Pass's ownership and lifecycle, but cannot be approved, transferred, or sold outside Mint Up; NFT and token terminology remain outside the buyer experience.
_Avoid_: Separate NFT, second pass, buyer-facing token

**Event Pass Offer**:
One Event Pass option currently offered for an Event, with its effective USDC price, remaining capacity, and sale window as seen on the pass detail.
_Avoid_: Event Ticket Type, price phase, availability window

**Secure your passes**:
The action that protects Event Pass ownership with the device's Face ID or fingerprint. No seed phrase, wallet app, or private key is exposed.
_Avoid_: Create wallet, Create passkey, Create smart account, Kernel, EntryPoint

**Get Pass**:
The primary buyer action that starts or confirms acquiring one Event Pass after sign-in and Face ID, including any inline preparation.
_Avoid_: Purchase, Mint, Buy ticket, Approve, Sponsor

**Protected payment**:
The original USDC price paid for an Event Pass and held until the Event begins. It can be returned to the current holder if the Event is cancelled before then, even after a resale.
_Avoid_: Escrow, smart contract balance, guaranteed refund after the Event begins

**Pass transfer**:
A free handoff of an active Event Pass to another registered Mint Up user identified by email.
_Avoid_: Token transfer, wallet address, resale

**Pass resale**:
A private sale in which an Event Pass holder chooses a registered Mint Up user and a USDC price for that user to accept. Payment and ownership change together; resale proceeds are not a Protected payment.
_Avoid_: Marketplace listing, NFT sale, secondary-market transaction

**Pass refund**:
The return, requested by the current Event Pass holder, of the original Protected payment after its Event is cancelled. A resale price does not change its amount.
_Avoid_: Claim, token withdrawal, contract call
