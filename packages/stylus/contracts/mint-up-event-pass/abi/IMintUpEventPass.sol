// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IMintUpEventPass {
    error MintUpError(uint8 code);
    error ERC721InvalidOwner(address owner);
    error ERC721NonexistentToken(uint256 token_id);
    error ERC721IncorrectOwner(address sender, uint256 token_id, address owner);
    error ERC721InvalidSender(address sender);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InsufficientApproval(address operator, uint256 token_id);
    error ERC721InvalidApprover(address approver);
    error ERC721InvalidOperator(address operator);
    error InvalidReceiverWithReason(string reason);

    event Transfer(address indexed from, address indexed to, uint256 indexed token_id);
    event Approval(address indexed owner, address indexed approved, uint256 indexed token_id);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MetadataUpdate(uint256 token_id);
    event BatchMetadataUpdate(uint256 from_token_id, uint256 to_token_id);

    event EventRegistered(
        bytes32 indexed event_id,
        address indexed revenue_recipient,
        address indexed check_in_operator,
        uint64 funds_release_at
    );
    event EventSalesStatusChanged(bytes32 indexed event_id, bool enabled);
    event EventCancelled(bytes32 indexed event_id);
    event CheckInOperatorChanged(bytes32 indexed event_id, address indexed operator);
    event EventPassPurchased(
        uint64 indexed pass_id,
        bytes32 indexed event_id,
        address indexed buyer
    );
    event EventPassTransferred(
        uint64 indexed pass_id,
        address indexed previous_owner,
        address indexed new_owner,
        bytes32 event_id
    );
    event EventPassCheckedIn(
        uint64 indexed pass_id,
        bytes32 indexed event_id,
        address indexed attendee
    );
    event EventPassRefunded(
        uint64 indexed pass_id,
        bytes32 indexed event_id,
        address indexed recipient,
        uint64 amount
    );
    event EventFundsReleased(
        bytes32 indexed event_id,
        address indexed revenue_recipient,
        address indexed fee_recipient,
        uint256 revenue_amount,
        uint256 fee_amount
    );
    event EventPassPublicResaleListed(
        uint64 indexed pass_id,
        address indexed seller,
        uint256 price
    );
    event EventPassPublicResaleCancelled(uint64 indexed pass_id, address indexed seller);
    event EventPassResold(
        uint64 indexed pass_id,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 seller_amount,
        uint256 fee_amount
    );
    event ContractPaused(bool paused);
    event MintUpAuthorizationUsed(
        bytes32 indexed operation,
        address indexed caller,
        uint256 indexed nonce,
        uint64 pass_id,
        address recipient,
        uint256 amount
    );

    function registerEvent(
        bytes32 event_id,
        address revenue_recipient,
        uint64 price,
        uint32 maximum_supply,
        uint64 sale_start,
        uint64 sale_end,
        uint64 funds_release_at,
        bool sales_enabled,
        bool transfers_enabled,
        address check_in_operator,
        string calldata metadata_uri
    ) external;

    function setEventSales(bytes32 event_id, bool enabled) external;
    function setCheckInOperator(bytes32 event_id, address operator) external;
    function cancelEvent(bytes32 event_id) external;
    function setPaused(bool paused) external;
    function purchase(bytes32 event_id) external returns (uint64 pass_id);
    function claimRefund(uint64 pass_id) external;
    function releaseFunds(bytes32 event_id) external;
    function createPublicResaleListing(
        uint64 pass_id,
        uint256 price,
        uint256 nonce,
        uint64 issued_at,
        uint64 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function cancelPublicResaleListing(
        uint64 pass_id,
        uint256 nonce,
        uint64 issued_at,
        uint64 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function purchasePublicResale(
        uint64 pass_id,
        uint256 nonce,
        uint64 issued_at,
        uint64 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function transferPass(
        uint64 pass_id,
        address to,
        uint256 nonce,
        uint64 issued_at,
        uint64 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function checkIn(bytes32 event_id, uint64 pass_id) external;

    function config()
        external
        view
        returns (
            address administrator,
            address usdc,
            address authorization_signer,
            address fee_recipient,
            uint16 primary_fee_bps,
            uint16 resale_fee_bps,
            bool paused
        );

    function eventProtectionInfo(bytes32 event_id)
        external
        view
        returns (
            uint64 funds_release_at,
            uint256 protected_balance,
            bool cancelled,
            bool funds_released
        );

    function passRefundInfo(uint64 pass_id)
        external
        view
        returns (uint64 original_price, bool refunded, bool refund_available);

    function publicResaleListing(uint64 pass_id)
        external
        view
        returns (address seller, uint256 price, bool eligible);

    function transferOperation() external view returns (bytes32);
    function createPublicResaleListingOperation() external view returns (bytes32);
    function cancelPublicResaleListingOperation() external view returns (bytes32);
    function purchasePublicResaleOperation() external view returns (bytes32);
    function authorizationDigest(
        bytes32 operation,
        address caller,
        uint64 pass_id,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint64 issued_at,
        uint64 deadline
    ) external view returns (bytes32);
    function authorizationUsed(uint256 nonce) external view returns (bool);

    function eventInfo(bytes32 event_id)
        external
        view
        returns (
            address revenue_recipient,
            uint64 price,
            uint32 maximum_supply,
            uint32 issued_supply,
            uint64 sale_start,
            uint64 sale_end,
            bool sales_enabled,
            bool transfers_enabled,
            bool cancelled,
            address check_in_operator
        );

    function passInfo(uint64 pass_id)
        external
        view
        returns (address owner, bytes32 event_id, uint8 state, bool valid_for_check_in);

    function isValidForCheckIn(uint64 pass_id) external view returns (bool);

    function supportsInterface(bytes4 interface_id) external view returns (bool);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 token_id) external view returns (string memory);
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 token_id) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 token_id) external;
    function safeTransferFrom(address from, address to, uint256 token_id, bytes calldata data) external;
    function transferFrom(address from, address to, uint256 token_id) external;
    function approve(address to, uint256 token_id) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 token_id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
