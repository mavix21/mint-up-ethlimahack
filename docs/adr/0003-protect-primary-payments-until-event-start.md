# Protect primary payments until the Event begins

Primary Event Pass payments remain in the contract until the Event's configured start, replacing the earlier direct-to-organizer flow. Before that timestamp Mint Up may cancel the Event and the current holder may request the full original price; otherwise anyone may trigger a one-time release that sends 95% to the organizer and 5% to Mint Up. This pull-based refund avoids iterating over every pass while preserving a deterministic protection deadline.
