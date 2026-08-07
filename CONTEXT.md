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

**Paid directly to organizer**:
The one-line payment disclosure that the USDC amount goes directly to the Event's revenue recipient with no escrow or guaranteed refund. Full recipient and refund details live in a collapsed Details disclosure, not in the primary flow.
_Avoid_: Revenue recipient, UserOperation, Transaction hash, Paymaster, gas sponsorship, no escrow paragraph
