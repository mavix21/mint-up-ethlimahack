# Expose Event Passes as ERC-721 collectibles

Each Event Pass will also be an ERC-721 token with standard ownership, transfer events, interface discovery, and an IPFS metadata URI so external collection tools can index it. OpenZeppelin Stylus remains the ownership implementation, Event Pass lifecycle restrictions still govern every transfer path, and Mint Up pins the Event image and metadata through Pinata before Event registration; this external compatibility does not introduce NFT terminology into the buyer experience.
