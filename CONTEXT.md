# Mint Up Passes

Mint Up Passes lets visitors acquire admission for Mint Up events without crypto tooling.

## Language

**Event Pass**:
A buyer-facing admission credential for one Event, corresponding to one Issued Event Ticket acquired in one Ticket Order. It is the only purchase term buyers see.
_Avoid_: Ticket, NFT, token, Ticket Order, Issued Event Ticket

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
The original Event Pass price held until the Event begins. If the Event is cancelled before then, the current holder can receive the full original price; otherwise, the organizer receives the price minus Mint Up's fee. The displayed price remains the buyer's total.
_Avoid_: Escrow, smart contract balance, revenue recipient, UserOperation, transaction hash, Paymaster, gas sponsorship
