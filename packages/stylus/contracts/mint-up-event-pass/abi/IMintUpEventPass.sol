// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IMintUpEventPass {
    error MintUpError(uint8 code);

    event EventRegistered(
        bytes32 indexed event_id,
        address indexed revenue_recipient,
        address indexed check_in_operator
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
    event ContractPaused(bool paused);

    function registerEvent(
        bytes32 event_id,
        address revenue_recipient,
        uint64 price,
        uint32 maximum_supply,
        uint64 sale_start,
        uint64 sale_end,
        bool sales_enabled,
        bool transfers_enabled,
        address check_in_operator
    ) external;

    function setEventSales(bytes32 event_id, bool enabled) external;
    function setCheckInOperator(bytes32 event_id, address operator) external;
    function cancelEvent(bytes32 event_id) external;
    function setPaused(bool paused) external;
    function purchase(bytes32 event_id) external returns (uint64 pass_id);
    function transferPass(uint64 pass_id, address to) external;
    function checkIn(bytes32 event_id, uint64 pass_id) external;

    function config()
        external
        view
        returns (address administrator, address usdc, bool paused);

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
}
