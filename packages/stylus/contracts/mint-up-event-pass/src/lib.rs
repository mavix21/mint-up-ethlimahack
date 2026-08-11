#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

extern crate alloc;

use alloc::{
    string::{String, ToString},
    vec,
    vec::Vec,
};
use cid::Cid;
use openzeppelin_stylus::{
    token::erc721::{
        self,
        extensions::{Erc721Metadata, Erc721UriStorage, IErc721Metadata},
        Erc721, IErc721,
    },
    utils::{
        cryptography::{ecdsa, eip712::IEip712},
        introspection::erc165::IErc165,
    },
};
use stylus_sdk::{
    abi::Bytes,
    alloy_primitives::{aliases::B32, keccak256, Address, Uint, B256, U256},
    alloy_sol_types::{sol, SolType},
    prelude::*,
    stylus_core::{calls::context::Call, log},
};

const ACTIVE: u8 = 1;
const ATTENDED: u8 = 2;
const MAX_AUTHORIZATION_LIFETIME: u64 = 300;
const PRIMARY_FEE_BPS: u16 = 500;
const RESALE_FEE_BPS: u16 = 900;

type U32 = Uint<32, 1>;
type U64 = Uint<64, 1>;

const UNAUTHORIZED: u8 = 1;
const INVALID_INPUT: u8 = 2;
const EVENT_NOT_FOUND: u8 = 3;
const EVENT_EXISTS: u8 = 4;
const EVENT_CANCELLED: u8 = 5;
const SALES_CLOSED: u8 = 6;
const OUTSIDE_SALE_WINDOW: u8 = 7;
const SOLD_OUT: u8 = 8;
const PASS_NOT_FOUND: u8 = 9;
const NOT_PASS_OWNER: u8 = 10;
const TRANSFERS_DISABLED: u8 = 11;
const PASS_NOT_ACTIVE: u8 = 12;
const WRONG_EVENT: u8 = 13;
const PAYMENT_FAILED: u8 = 14;
const PAUSED: u8 = 15;
const REENTRANCY: u8 = 16;
const ID_OVERFLOW: u8 = 17;
const MOVEMENT_RESTRICTED: u8 = 18;
const INVALID_AUTHORIZATION: u8 = 19;
const AUTHORIZATION_EXPIRED: u8 = 20;
const AUTHORIZATION_USED: u8 = 21;
const CANCELLATION_CLOSED: u8 = 22;
const REFUND_UNAVAILABLE: u8 = 23;
const REFUND_ALREADY_CLAIMED: u8 = 24;
const ACCOUNTING_ERROR: u8 = 25;
const RELEASE_NOT_READY: u8 = 26;
const FUNDS_ALREADY_RELEASED: u8 = 27;
const RESALE_OFFER_NOT_FOUND: u8 = 28;
const RESALE_UNAVAILABLE: u8 = 29;
const NOT_DESIGNATED_BUYER: u8 = 30;

type AuthorizationHashTuple = sol! {
    tuple(bytes32, bytes32, address, uint64, address, uint256, uint256, uint64, uint64)
};

sol! {
    #[derive(Debug)]
    error MintUpError(uint8 code);

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
    event EventPassResaleOffered(
        uint64 indexed pass_id,
        address indexed seller,
        address indexed designated_buyer,
        uint256 price
    );
    event EventPassResaleOfferCancelled(uint64 indexed pass_id, address indexed seller);
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
}

#[derive(SolidityError, Debug)]
pub enum Error {
    MintUpError(MintUpError),
    InvalidOwner(erc721::ERC721InvalidOwner),
    NonexistentToken(erc721::ERC721NonexistentToken),
    IncorrectOwner(erc721::ERC721IncorrectOwner),
    InvalidSender(erc721::ERC721InvalidSender),
    InvalidReceiver(erc721::ERC721InvalidReceiver),
    InvalidReceiverWithReason(erc721::InvalidReceiverWithReason),
    InsufficientApproval(erc721::ERC721InsufficientApproval),
    InvalidApprover(erc721::ERC721InvalidApprover),
    InvalidOperator(erc721::ERC721InvalidOperator),
}

impl From<erc721::Error> for Error {
    fn from(value: erc721::Error) -> Self {
        match value {
            erc721::Error::InvalidOwner(err) => Self::InvalidOwner(err),
            erc721::Error::NonexistentToken(err) => Self::NonexistentToken(err),
            erc721::Error::IncorrectOwner(err) => Self::IncorrectOwner(err),
            erc721::Error::InvalidSender(err) => Self::InvalidSender(err),
            erc721::Error::InvalidReceiver(err) => Self::InvalidReceiver(err),
            erc721::Error::InvalidReceiverWithReason(err) => Self::InvalidReceiverWithReason(err),
            erc721::Error::InsufficientApproval(err) => Self::InsufficientApproval(err),
            erc721::Error::InvalidApprover(err) => Self::InvalidApprover(err),
            erc721::Error::InvalidOperator(err) => Self::InvalidOperator(err),
        }
    }
}

fn error(code: u8) -> Error {
    Error::MintUpError(MintUpError { code })
}

sol_storage! {
    pub struct EventData {
        address revenue_recipient;
        address check_in_operator;
        uint64 price;
        uint32 maximum_supply;
        uint32 issued_supply;
        uint64 sale_start;
        uint64 sale_end;
        uint64 funds_release_at;
        uint256 protected_balance;
        bool exists;
        bool sales_enabled;
        bool transfers_enabled;
        bool cancelled;
        bool funds_released;
        string metadata_uri;
    }

    pub struct PassData {
        bool attended;
        bool refunded;
        uint64 original_price;
        bytes32 event_id;
    }

    pub struct ResaleOffer {
        address seller;
        address designated_buyer;
        uint256 price;
        uint64 pause_generation;
    }

    pub struct PublicResaleListing {
        address seller;
        uint256 price;
        uint64 pause_generation;
    }

    #[entrypoint]
    pub struct MintUpEventPass {
        address administrator;
        address authorization_signer;
        address fee_recipient;
        bool paused;
        bool entered;
        uint64 pause_generation;
        uint64 next_pass_id;
        address usdc;
        mapping(bytes32 => EventData) events;
        mapping(uint64 => PassData) passes;
        mapping(uint64 => ResaleOffer) resale_offers;
        mapping(uint64 => PublicResaleListing) public_resale_listings;
        mapping(uint256 => bool) used_authorizations;
        Erc721 erc721;
        Erc721Metadata metadata;
        Erc721UriStorage token_uris;
    }
}

#[public]
impl MintUpEventPass {
    #[constructor]
    pub fn constructor(
        &mut self,
        administrator: Address,
        usdc: Address,
        authorization_signer: Address,
        fee_recipient: Address,
        paused: bool,
    ) -> Result<(), Error> {
        if administrator.is_zero()
            || usdc.is_zero()
            || authorization_signer.is_zero()
            || fee_recipient.is_zero()
            || authorization_signer == administrator
            || authorization_signer == usdc
        {
            return Err(error(INVALID_INPUT));
        }
        self.administrator.set(administrator);
        self.usdc.set(usdc);
        self.authorization_signer.set(authorization_signer);
        self.fee_recipient.set(fee_recipient);
        self.paused.set(paused);
        self.next_pass_id.set(U64::from(1));
        self.metadata
            .constructor("Mint Up Event Pass".to_string(), "MUEP".to_string());
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn register_event(
        &mut self,
        event_id: B256,
        revenue_recipient: Address,
        price: u64,
        maximum_supply: u32,
        sale_start: u64,
        sale_end: u64,
        funds_release_at: u64,
        sales_enabled: bool,
        transfers_enabled: bool,
        check_in_operator: Address,
        metadata_uri: String,
    ) -> Result<(), Error> {
        self.not_entered()?;
        self.only_admin()?;
        if event_id.is_zero()
            || revenue_recipient.is_zero()
            || check_in_operator.is_zero()
            || price == 0
            || maximum_supply == 0
            || sale_start >= sale_end
            || sale_end > funds_release_at
            || !valid_ipfs_uri(&metadata_uri)
        {
            return Err(error(INVALID_INPUT));
        }
        if self.events.getter(event_id).exists.get() {
            return Err(error(EVENT_EXISTS));
        }

        let mut event = self.events.setter(event_id);
        event.revenue_recipient.set(revenue_recipient);
        event.check_in_operator.set(check_in_operator);
        event.price.set(U64::from(price));
        event.maximum_supply.set(U32::from(maximum_supply));
        event.sale_start.set(U64::from(sale_start));
        event.sale_end.set(U64::from(sale_end));
        event.funds_release_at.set(U64::from(funds_release_at));
        event.exists.set(true);
        event.sales_enabled.set(sales_enabled);
        event.transfers_enabled.set(transfers_enabled);
        event.metadata_uri.set_str(metadata_uri);
        log(
            self.vm(),
            EventRegistered {
                event_id,
                revenue_recipient,
                check_in_operator,
                funds_release_at,
            },
        );
        Ok(())
    }

    pub fn set_event_sales(&mut self, event_id: B256, enabled: bool) -> Result<(), Error> {
        self.not_entered()?;
        self.only_admin()?;
        self.require_event_live(event_id)?;
        self.events.setter(event_id).sales_enabled.set(enabled);
        log(self.vm(), EventSalesStatusChanged { event_id, enabled });
        Ok(())
    }

    pub fn set_check_in_operator(
        &mut self,
        event_id: B256,
        operator: Address,
    ) -> Result<(), Error> {
        self.not_entered()?;
        self.only_admin()?;
        if operator.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        self.require_event_live(event_id)?;
        self.events.setter(event_id).check_in_operator.set(operator);
        log(self.vm(), CheckInOperatorChanged { event_id, operator });
        Ok(())
    }

    pub fn cancel_event(&mut self, event_id: B256) -> Result<(), Error> {
        self.not_entered()?;
        self.only_admin()?;
        self.require_event_live(event_id)?;
        if self.vm().block_timestamp()
            >= self
                .events
                .getter(event_id)
                .funds_release_at
                .get()
                .to::<u64>()
        {
            return Err(error(CANCELLATION_CLOSED));
        }
        let mut event = self.events.setter(event_id);
        event.cancelled.set(true);
        event.sales_enabled.set(false);
        log(self.vm(), EventCancelled { event_id });
        Ok(())
    }

    pub fn set_paused(&mut self, paused: bool) -> Result<(), Error> {
        self.not_entered()?;
        self.only_admin()?;
        if paused && !self.paused.get() {
            let next_generation = self
                .pause_generation
                .get()
                .to::<u64>()
                .checked_add(1)
                .ok_or_else(|| error(ACCOUNTING_ERROR))?;
            self.pause_generation.set(U64::from(next_generation));
        }
        self.paused.set(paused);
        log(self.vm(), ContractPaused { paused });
        Ok(())
    }

    pub fn purchase(&mut self, event_id: B256) -> Result<u64, Error> {
        self.not_paused()?;
        if self.entered.get() {
            return Err(error(REENTRANCY));
        }

        let buyer = self.vm().msg_sender();
        if buyer.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        let now = self.vm().block_timestamp();
        let event = self.events.getter(event_id);
        if !event.exists.get() {
            return Err(error(EVENT_NOT_FOUND));
        }
        if event.cancelled.get() {
            return Err(error(EVENT_CANCELLED));
        }
        if !event.sales_enabled.get() {
            return Err(error(SALES_CLOSED));
        }
        if now < event.sale_start.get().to::<u64>() || now >= event.sale_end.get().to::<u64>() {
            return Err(error(OUTSIDE_SALE_WINDOW));
        }
        let issued_supply = event.issued_supply.get().to::<u32>();
        if issued_supply >= event.maximum_supply.get().to::<u32>() {
            return Err(error(SOLD_OUT));
        }
        let price = event.price.get().to::<u64>();
        let metadata_uri = event.metadata_uri.get_string();
        drop(event);

        let pass_id = self.next_pass_id.get().to::<u64>();
        let next_pass_id = pass_id.checked_add(1).ok_or_else(|| error(ID_OVERFLOW))?;
        let call = transfer_from_data(buyer, self.vm().contract_address(), price);
        if !self.strict_usdc_call(&call) {
            return Err(error(PAYMENT_FAILED));
        }

        let mut event = self.events.setter(event_id);
        let protected_balance = event.protected_balance.get();
        let next_protected_balance = protected_balance
            .checked_add(U256::from(price))
            .ok_or_else(|| error(ACCOUNTING_ERROR))?;
        event.issued_supply.set(U32::from(issued_supply + 1));
        event.protected_balance.set(next_protected_balance);
        drop(event);
        self.next_pass_id.set(U64::from(next_pass_id));
        let mut pass = self.passes.setter(U64::from(pass_id));
        pass.event_id.set(event_id);
        pass.original_price.set(U64::from(price));
        drop(pass);
        let token_id = U256::from(pass_id);
        self.erc721._mint(buyer, token_id)?;
        self.token_uris._set_token_uri(token_id, metadata_uri);
        log(
            self.vm(),
            EventPassPurchased {
                pass_id,
                event_id,
                buyer,
            },
        );
        Ok(pass_id)
    }

    pub fn claim_refund(&mut self, pass_id: u64) -> Result<(), Error> {
        self.not_paused()?;
        if self.entered.get() {
            return Err(error(REENTRANCY));
        }

        let token_id = U256::from(pass_id);
        let owner = self
            .erc721
            .owner_of(token_id)
            .map_err(|_| error(PASS_NOT_FOUND))?;
        if owner != self.vm().msg_sender() {
            return Err(error(NOT_PASS_OWNER));
        }
        let pass = self.passes.getter(U64::from(pass_id));
        if pass.refunded.get() {
            return Err(error(REFUND_ALREADY_CLAIMED));
        }
        let event_id = pass.event_id.get();
        let amount = pass.original_price.get().to::<u64>();
        drop(pass);
        let event = self.events.getter(event_id);
        if !event.cancelled.get() {
            return Err(error(REFUND_UNAVAILABLE));
        }
        let remaining = event
            .protected_balance
            .get()
            .checked_sub(U256::from(amount))
            .ok_or_else(|| error(ACCOUNTING_ERROR))?;
        drop(event);

        if !self.strict_usdc_call(&transfer_data(owner, U256::from(amount))) {
            return Err(error(PAYMENT_FAILED));
        }

        self.passes.setter(U64::from(pass_id)).refunded.set(true);
        self.events
            .setter(event_id)
            .protected_balance
            .set(remaining);
        log(
            self.vm(),
            EventPassRefunded {
                pass_id,
                event_id,
                recipient: owner,
                amount,
            },
        );
        Ok(())
    }

    pub fn release_funds(&mut self, event_id: B256) -> Result<(), Error> {
        self.not_paused()?;
        if self.entered.get() {
            return Err(error(REENTRANCY));
        }

        let event = self.events.getter(event_id);
        if !event.exists.get() {
            return Err(error(EVENT_NOT_FOUND));
        }
        if event.cancelled.get() {
            return Err(error(EVENT_CANCELLED));
        }
        if event.funds_released.get() {
            return Err(error(FUNDS_ALREADY_RELEASED));
        }
        if self.vm().block_timestamp() < event.funds_release_at.get().to::<u64>() {
            return Err(error(RELEASE_NOT_READY));
        }

        let protected_balance = event.protected_balance.get();
        let revenue_recipient = event.revenue_recipient.get();
        let fee_recipient = self.fee_recipient.get();
        drop(event);
        let fee_amount = basis_points(protected_balance, PRIMARY_FEE_BPS);
        let revenue_amount = protected_balance - fee_amount;

        if !self.strict_usdc_call(&transfer_data(revenue_recipient, revenue_amount))
            || !self.strict_usdc_call(&transfer_data(fee_recipient, fee_amount))
        {
            return Err(error(PAYMENT_FAILED));
        }

        let mut event = self.events.setter(event_id);
        event.protected_balance.set(U256::ZERO);
        event.funds_released.set(true);
        log(
            self.vm(),
            EventFundsReleased {
                event_id,
                revenue_recipient,
                fee_recipient,
                revenue_amount,
                fee_amount,
            },
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn transfer_pass(
        &mut self,
        pass_id: u64,
        to: Address,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_entered()?;
        if to.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        let sender = self.vm().msg_sender();
        let token_id = U256::from(pass_id);
        let (previous_owner, event_id) = self.require_transferable(token_id)?;
        if previous_owner != sender {
            return Err(error(NOT_PASS_OWNER));
        }
        if to == previous_owner {
            return Err(error(INVALID_INPUT));
        }
        self.validate_authorization(
            Self::transfer_operation_hash(),
            sender,
            pass_id,
            to,
            U256::ZERO,
            nonce,
            issued_at,
            deadline,
            v,
            r,
            s,
        )?;
        self.record_authorization(
            Self::transfer_operation_hash(),
            sender,
            nonce,
            pass_id,
            to,
            U256::ZERO,
        );
        self.clear_resale_offer(pass_id);
        self.clear_public_resale_listing(pass_id);
        self.erc721._transfer(previous_owner, to, token_id)?;
        self.log_pass_transfer(token_id, previous_owner, to, event_id);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_resale_offer(
        &mut self,
        pass_id: u64,
        designated_buyer: Address,
        price: U256,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_entered()?;
        if designated_buyer.is_zero() || price.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        let seller = self.vm().msg_sender();
        let (owner, _) = self.require_resale_eligible(pass_id)?;
        if owner != seller {
            return Err(error(NOT_PASS_OWNER));
        }
        if designated_buyer == seller {
            return Err(error(INVALID_INPUT));
        }
        let operation = Self::create_resale_offer_operation_hash();
        self.validate_authorization(
            operation,
            seller,
            pass_id,
            designated_buyer,
            price,
            nonce,
            issued_at,
            deadline,
            v,
            r,
            s,
        )?;
        self.record_authorization(operation, seller, nonce, pass_id, designated_buyer, price);

        let mut offer = self.resale_offers.setter(U64::from(pass_id));
        offer.seller.set(seller);
        offer.designated_buyer.set(designated_buyer);
        offer.price.set(price);
        offer.pause_generation.set(self.pause_generation.get());
        log(
            self.vm(),
            EventPassResaleOffered {
                pass_id,
                seller,
                designated_buyer,
                price,
            },
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn cancel_resale_offer(
        &mut self,
        pass_id: u64,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_entered()?;
        let seller = self.vm().msg_sender();
        let (owner, _) = self.require_resale_eligible(pass_id)?;
        if owner != seller {
            return Err(error(NOT_PASS_OWNER));
        }
        if self
            .resale_offers
            .getter(U64::from(pass_id))
            .seller
            .get()
            .is_zero()
        {
            return Err(error(RESALE_OFFER_NOT_FOUND));
        }
        let operation = Self::cancel_resale_offer_operation_hash();
        self.validate_authorization(
            operation,
            seller,
            pass_id,
            Address::ZERO,
            U256::ZERO,
            nonce,
            issued_at,
            deadline,
            v,
            r,
            s,
        )?;
        self.record_authorization(operation, seller, nonce, pass_id, Address::ZERO, U256::ZERO);

        self.clear_resale_offer(pass_id);
        log(self.vm(), EventPassResaleOfferCancelled { pass_id, seller });
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn purchase_resale(
        &mut self,
        pass_id: u64,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_paused()?;
        if self.entered.get() {
            return Err(error(REENTRANCY));
        }

        let buyer = self.vm().msg_sender();
        let offer = self.resale_offers.getter(U64::from(pass_id));
        let seller = offer.seller.get();
        if seller.is_zero() {
            return Err(error(RESALE_OFFER_NOT_FOUND));
        }
        let designated_buyer = offer.designated_buyer.get();
        let price = offer.price.get();
        let offer_pause_generation = offer.pause_generation.get();
        drop(offer);
        if buyer != designated_buyer {
            return Err(error(NOT_DESIGNATED_BUYER));
        }
        if offer_pause_generation != self.pause_generation.get() {
            return Err(error(RESALE_UNAVAILABLE));
        }
        let (current_owner, event_id) = self.require_resale_eligible(pass_id)?;
        if current_owner != seller {
            return Err(error(RESALE_UNAVAILABLE));
        }
        let operation = Self::purchase_resale_operation_hash();
        self.validate_authorization(
            operation, buyer, pass_id, seller, price, nonce, issued_at, deadline, v, r, s,
        )?;

        let fee_amount = basis_points(price, RESALE_FEE_BPS);
        let seller_amount = price - fee_amount;
        if !self.strict_usdc_call(&transfer_from_data_u256(
            buyer,
            self.vm().contract_address(),
            price,
        )) || !self.strict_usdc_call(&transfer_data(seller, seller_amount))
            || !self.strict_usdc_call(&transfer_data(self.fee_recipient.get(), fee_amount))
        {
            return Err(error(PAYMENT_FAILED));
        }
        self.record_authorization(operation, buyer, nonce, pass_id, seller, price);

        self.clear_resale_offer(pass_id);
        self.clear_public_resale_listing(pass_id);
        self.erc721._transfer(seller, buyer, U256::from(pass_id))?;
        self.log_pass_transfer(U256::from(pass_id), seller, buyer, event_id);
        log(
            self.vm(),
            EventPassResold {
                pass_id,
                seller,
                buyer,
                price,
                seller_amount,
                fee_amount,
            },
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_public_resale_listing(
        &mut self,
        pass_id: u64,
        price: U256,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_entered()?;
        if price.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        let seller = self.vm().msg_sender();
        let (owner, _) = self.require_resale_eligible(pass_id)?;
        if owner != seller {
            return Err(error(NOT_PASS_OWNER));
        }
        let protected_payment = U256::from(
            self.passes
                .getter(U64::from(pass_id))
                .original_price
                .get()
                .to::<u64>(),
        );
        if price > protected_payment {
            return Err(error(INVALID_INPUT));
        }
        let operation = Self::create_public_resale_listing_operation_hash();
        self.validate_authorization(
            operation,
            seller,
            pass_id,
            Address::ZERO,
            price,
            nonce,
            issued_at,
            deadline,
            v,
            r,
            s,
        )?;
        self.record_authorization(operation, seller, nonce, pass_id, Address::ZERO, price);

        let mut listing = self.public_resale_listings.setter(U64::from(pass_id));
        listing.seller.set(seller);
        listing.price.set(price);
        listing.pause_generation.set(self.pause_generation.get());
        log(
            self.vm(),
            EventPassPublicResaleListed {
                pass_id,
                seller,
                price,
            },
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn cancel_public_resale_listing(
        &mut self,
        pass_id: u64,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_entered()?;
        let seller = self.vm().msg_sender();
        let (owner, _) = self.require_resale_eligible(pass_id)?;
        if owner != seller {
            return Err(error(NOT_PASS_OWNER));
        }
        if self
            .public_resale_listings
            .getter(U64::from(pass_id))
            .seller
            .get()
            .is_zero()
        {
            return Err(error(RESALE_OFFER_NOT_FOUND));
        }
        let operation = Self::cancel_public_resale_listing_operation_hash();
        self.validate_authorization(
            operation,
            seller,
            pass_id,
            Address::ZERO,
            U256::ZERO,
            nonce,
            issued_at,
            deadline,
            v,
            r,
            s,
        )?;
        self.record_authorization(operation, seller, nonce, pass_id, Address::ZERO, U256::ZERO);
        self.clear_public_resale_listing(pass_id);
        log(
            self.vm(),
            EventPassPublicResaleCancelled { pass_id, seller },
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn purchase_public_resale(
        &mut self,
        pass_id: u64,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        self.not_paused()?;
        if self.entered.get() {
            return Err(error(REENTRANCY));
        }
        let buyer = self.vm().msg_sender();
        let listing = self.public_resale_listings.getter(U64::from(pass_id));
        let seller = listing.seller.get();
        if seller.is_zero() {
            return Err(error(RESALE_OFFER_NOT_FOUND));
        }
        let price = listing.price.get();
        let listing_pause_generation = listing.pause_generation.get();
        drop(listing);
        if buyer == seller {
            return Err(error(INVALID_INPUT));
        }
        if listing_pause_generation != self.pause_generation.get() {
            return Err(error(RESALE_UNAVAILABLE));
        }
        let (current_owner, event_id) = self.require_resale_eligible(pass_id)?;
        if current_owner != seller {
            return Err(error(RESALE_UNAVAILABLE));
        }
        let operation = Self::purchase_public_resale_operation_hash();
        self.validate_authorization(
            operation, buyer, pass_id, seller, price, nonce, issued_at, deadline, v, r, s,
        )?;

        let fee_amount = basis_points(price, RESALE_FEE_BPS);
        let seller_amount = price - fee_amount;
        if !self.strict_usdc_call(&transfer_from_data_u256(
            buyer,
            self.vm().contract_address(),
            price,
        )) || !self.strict_usdc_call(&transfer_data(seller, seller_amount))
            || !self.strict_usdc_call(&transfer_data(self.fee_recipient.get(), fee_amount))
        {
            return Err(error(PAYMENT_FAILED));
        }
        self.record_authorization(operation, buyer, nonce, pass_id, seller, price);
        self.clear_public_resale_listing(pass_id);
        self.clear_resale_offer(pass_id);
        self.erc721._transfer(seller, buyer, U256::from(pass_id))?;
        self.log_pass_transfer(U256::from(pass_id), seller, buyer, event_id);
        log(
            self.vm(),
            EventPassResold {
                pass_id,
                seller,
                buyer,
                price,
                seller_amount,
                fee_amount,
            },
        );
        Ok(())
    }

    pub fn public_resale_listing(&self, pass_id: u64) -> Result<(Address, U256, bool), Error> {
        self.erc721
            .owner_of(U256::from(pass_id))
            .map_err(|_| error(PASS_NOT_FOUND))?;
        let listing = self.public_resale_listings.getter(U64::from(pass_id));
        let seller = listing.seller.get();
        let price = listing.price.get();
        let listing_pause_generation = listing.pause_generation.get();
        drop(listing);
        Ok((
            seller,
            price,
            !seller.is_zero()
                && listing_pause_generation == self.pause_generation.get()
                && self.resale_is_eligible(pass_id, seller),
        ))
    }

    pub fn resale_offer(&self, pass_id: u64) -> Result<(Address, Address, U256, bool), Error> {
        self.erc721
            .owner_of(U256::from(pass_id))
            .map_err(|_| error(PASS_NOT_FOUND))?;
        let offer = self.resale_offers.getter(U64::from(pass_id));
        let seller = offer.seller.get();
        let designated_buyer = offer.designated_buyer.get();
        let price = offer.price.get();
        let offer_pause_generation = offer.pause_generation.get();
        drop(offer);
        Ok((
            seller,
            designated_buyer,
            price,
            !seller.is_zero()
                && offer_pause_generation == self.pause_generation.get()
                && self.resale_is_eligible(pass_id, seller),
        ))
    }

    pub fn check_in(&mut self, event_id: B256, pass_id: u64) -> Result<(), Error> {
        self.not_entered()?;
        self.not_paused()?;
        let sender = self.vm().msg_sender();
        let event = self.events.getter(event_id);
        if !event.exists.get() {
            return Err(error(EVENT_NOT_FOUND));
        }
        if event.cancelled.get() {
            return Err(error(EVENT_CANCELLED));
        }
        if event.check_in_operator.get() != sender {
            return Err(error(UNAUTHORIZED));
        }
        drop(event);

        let pass = self.passes.getter(U64::from(pass_id));
        let attendee = self
            .erc721
            .owner_of(U256::from(pass_id))
            .map_err(|_| error(PASS_NOT_FOUND))?;
        if pass.event_id.get() != event_id {
            return Err(error(WRONG_EVENT));
        }
        if pass.attended.get() {
            return Err(error(PASS_NOT_ACTIVE));
        }
        drop(pass);

        self.clear_resale_offer(pass_id);
        self.clear_public_resale_listing(pass_id);
        self.passes.setter(U64::from(pass_id)).attended.set(true);
        log(
            self.vm(),
            EventPassCheckedIn {
                pass_id,
                event_id,
                attendee,
            },
        );
        Ok(())
    }

    pub fn config(&self) -> (Address, Address, Address, Address, u16, u16, bool) {
        (
            self.administrator.get(),
            self.usdc.get(),
            self.authorization_signer.get(),
            self.fee_recipient.get(),
            PRIMARY_FEE_BPS,
            RESALE_FEE_BPS,
            self.paused.get(),
        )
    }

    pub fn event_protection_info(&self, event_id: B256) -> Result<(u64, U256, bool, bool), Error> {
        let event = self.events.getter(event_id);
        if !event.exists.get() {
            return Err(error(EVENT_NOT_FOUND));
        }
        Ok((
            event.funds_release_at.get().to::<u64>(),
            event.protected_balance.get(),
            event.cancelled.get(),
            event.funds_released.get(),
        ))
    }

    pub fn pass_refund_info(&self, pass_id: u64) -> Result<(u64, bool, bool), Error> {
        self.erc721
            .owner_of(U256::from(pass_id))
            .map_err(|_| error(PASS_NOT_FOUND))?;
        let pass = self.passes.getter(U64::from(pass_id));
        let original_price = pass.original_price.get().to::<u64>();
        let refunded = pass.refunded.get();
        let event_id = pass.event_id.get();
        drop(pass);
        Ok((
            original_price,
            refunded,
            !refunded && self.events.getter(event_id).cancelled.get(),
        ))
    }

    #[allow(clippy::type_complexity)]
    pub fn event_info(
        &self,
        event_id: B256,
    ) -> Result<(Address, u64, u32, u32, u64, u64, bool, bool, bool, Address), Error> {
        let event = self.events.getter(event_id);
        if !event.exists.get() {
            return Err(error(EVENT_NOT_FOUND));
        }
        Ok((
            event.revenue_recipient.get(),
            event.price.get().to::<u64>(),
            event.maximum_supply.get().to::<u32>(),
            event.issued_supply.get().to::<u32>(),
            event.sale_start.get().to::<u64>(),
            event.sale_end.get().to::<u64>(),
            event.sales_enabled.get(),
            event.transfers_enabled.get(),
            event.cancelled.get(),
            event.check_in_operator.get(),
        ))
    }

    pub fn pass_info(&self, pass_id: u64) -> Result<(Address, B256, u8, bool), Error> {
        let pass = self.passes.getter(U64::from(pass_id));
        let owner = self
            .erc721
            .owner_of(U256::from(pass_id))
            .map_err(|_| error(PASS_NOT_FOUND))?;
        let event_id = pass.event_id.get();
        let state = if pass.attended.get() {
            ATTENDED
        } else {
            ACTIVE
        };
        drop(pass);
        Ok((
            owner,
            event_id,
            state,
            state == ACTIVE && self.event_valid(event_id),
        ))
    }

    pub fn is_valid_for_check_in(&self, pass_id: u64) -> bool {
        let pass = self.passes.getter(U64::from(pass_id));
        let event_id = pass.event_id.get();
        let active =
            self.erc721._owner_of(U256::from(pass_id)) != Address::ZERO && !pass.attended.get();
        drop(pass);
        active && self.event_valid(event_id)
    }

    pub fn transfer_operation(&self) -> B256 {
        Self::transfer_operation_hash()
    }

    pub fn create_resale_offer_operation(&self) -> B256 {
        Self::create_resale_offer_operation_hash()
    }

    pub fn cancel_resale_offer_operation(&self) -> B256 {
        Self::cancel_resale_offer_operation_hash()
    }

    pub fn purchase_resale_operation(&self) -> B256 {
        Self::purchase_resale_operation_hash()
    }

    pub fn create_public_resale_listing_operation(&self) -> B256 {
        Self::create_public_resale_listing_operation_hash()
    }

    pub fn cancel_public_resale_listing_operation(&self) -> B256 {
        Self::cancel_public_resale_listing_operation_hash()
    }

    pub fn purchase_public_resale_operation(&self) -> B256 {
        Self::purchase_public_resale_operation_hash()
    }

    #[allow(clippy::too_many_arguments)]
    pub fn authorization_digest(
        &self,
        operation: B256,
        caller: Address,
        pass_id: u64,
        recipient: Address,
        amount: U256,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
    ) -> B256 {
        let type_hash = keccak256(
            "MintUpAuthorization(bytes32 operation,address caller,uint64 passId,address recipient,uint256 amount,uint256 nonce,uint64 issuedAt,uint64 deadline)",
        );
        let struct_hash = keccak256(AuthorizationHashTuple::abi_encode(&(
            type_hash, operation, caller, pass_id, recipient, amount, nonce, issued_at, deadline,
        )));
        self.hash_typed_data_v4(struct_hash)
    }

    pub fn authorization_used(&self, nonce: U256) -> bool {
        self.used_authorizations.get(nonce)
    }

    pub fn supports_interface(&self, interface_id: B32) -> bool {
        <Self as IErc165>::supports_interface(self, interface_id)
    }

    pub fn name(&self) -> String {
        <Self as IErc721Metadata>::name(self)
    }

    pub fn symbol(&self) -> String {
        <Self as IErc721Metadata>::symbol(self)
    }

    #[selector(name = "tokenURI")]
    pub fn token_uri(&self, token_id: U256) -> Result<String, Error> {
        <Self as IErc721Metadata>::token_uri(self, token_id)
    }

    pub fn balance_of(&self, owner: Address) -> Result<U256, Error> {
        <Self as IErc721>::balance_of(self, owner)
    }

    pub fn owner_of(&self, token_id: U256) -> Result<Address, Error> {
        <Self as IErc721>::owner_of(self, token_id)
    }

    pub fn safe_transfer_from(
        &mut self,
        from: Address,
        to: Address,
        token_id: U256,
    ) -> Result<(), Error> {
        <Self as IErc721>::safe_transfer_from(self, from, to, token_id)
    }

    #[selector(name = "safeTransferFrom")]
    pub fn safe_transfer_from_with_data(
        &mut self,
        from: Address,
        to: Address,
        token_id: U256,
        data: Bytes,
    ) -> Result<(), Error> {
        <Self as IErc721>::safe_transfer_from_with_data(self, from, to, token_id, data)
    }

    pub fn transfer_from(
        &mut self,
        from: Address,
        to: Address,
        token_id: U256,
    ) -> Result<(), Error> {
        <Self as IErc721>::transfer_from(self, from, to, token_id)
    }

    pub fn approve(&mut self, to: Address, token_id: U256) -> Result<(), Error> {
        <Self as IErc721>::approve(self, to, token_id)
    }

    pub fn set_approval_for_all(&mut self, operator: Address, approved: bool) -> Result<(), Error> {
        <Self as IErc721>::set_approval_for_all(self, operator, approved)
    }

    pub fn get_approved(&self, token_id: U256) -> Result<Address, Error> {
        <Self as IErc721>::get_approved(self, token_id)
    }

    pub fn is_approved_for_all(&self, owner: Address, operator: Address) -> bool {
        <Self as IErc721>::is_approved_for_all(self, owner, operator)
    }
}

impl IErc721 for MintUpEventPass {
    type Error = Error;

    fn balance_of(&self, owner: Address) -> Result<U256, Self::Error> {
        self.erc721.balance_of(owner).map_err(Into::into)
    }

    fn owner_of(&self, token_id: U256) -> Result<Address, Self::Error> {
        self.erc721.owner_of(token_id).map_err(Into::into)
    }

    fn safe_transfer_from(
        &mut self,
        from: Address,
        to: Address,
        token_id: U256,
    ) -> Result<(), Self::Error> {
        <Self as IErc721>::safe_transfer_from_with_data(self, from, to, token_id, vec![].into())
    }

    fn safe_transfer_from_with_data(
        &mut self,
        _from: Address,
        _to: Address,
        _token_id: U256,
        _data: Bytes,
    ) -> Result<(), Self::Error> {
        Err(error(MOVEMENT_RESTRICTED))
    }

    fn transfer_from(
        &mut self,
        _from: Address,
        _to: Address,
        _token_id: U256,
    ) -> Result<(), Self::Error> {
        Err(error(MOVEMENT_RESTRICTED))
    }

    fn approve(&mut self, _to: Address, _token_id: U256) -> Result<(), Self::Error> {
        Err(error(MOVEMENT_RESTRICTED))
    }

    fn set_approval_for_all(
        &mut self,
        _operator: Address,
        _approved: bool,
    ) -> Result<(), Self::Error> {
        Err(error(MOVEMENT_RESTRICTED))
    }

    fn get_approved(&self, token_id: U256) -> Result<Address, Self::Error> {
        self.erc721.get_approved(token_id).map_err(Into::into)
    }

    fn is_approved_for_all(&self, owner: Address, operator: Address) -> bool {
        self.erc721.is_approved_for_all(owner, operator)
    }
}

impl IErc721Metadata for MintUpEventPass {
    type Error = Error;

    fn name(&self) -> String {
        self.metadata.name()
    }

    fn symbol(&self) -> String {
        self.metadata.symbol()
    }

    fn token_uri(&self, token_id: U256) -> Result<String, Self::Error> {
        self.token_uris
            .token_uri(token_id, &self.erc721, &self.metadata)
            .map_err(Into::into)
    }
}

impl IEip712 for MintUpEventPass {
    const NAME: &'static str = "Mint Up";
    const VERSION: &'static str = "1";
}

impl IErc165 for MintUpEventPass {
    fn supports_interface(&self, interface_id: B32) -> bool {
        interface_id == <Self as IErc165>::interface_id()
            || interface_id == <Self as IErc721>::interface_id()
            || interface_id == <Self as IErc721Metadata>::interface_id()
    }
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
    use stylus_sdk::testing::TestVM;

    const START: u64 = 100;
    const END: u64 = 200;
    const RELEASE: u64 = 300;
    const PRICE: u64 = 25_000_000;
    const METADATA_URI: &str =
        "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/event.json";

    fn address(byte: u8) -> Address {
        Address::from([byte; 20])
    }

    fn event_id(byte: u8) -> B256 {
        B256::from([byte; 32])
    }

    fn setup() -> (TestVM, MintUpEventPass) {
        let vm = TestVM::default();
        test_host::install(&vm);
        vm.set_sender(address(1));
        let mut contract = MintUpEventPass::from(&vm);
        contract
            .constructor(address(1), address(2), address(5), address(9), false)
            .unwrap();
        (vm, contract)
    }

    fn register(
        contract: &mut MintUpEventPass,
        id: B256,
        supply: u32,
        transfers: bool,
        operator: Address,
    ) {
        contract
            .register_event(
                id,
                address(3),
                PRICE,
                supply,
                START,
                END,
                RELEASE,
                true,
                transfers,
                operator,
                METADATA_URI.into(),
            )
            .unwrap();
    }

    fn payment_data(vm: &TestVM, buyer: Address) -> Vec<u8> {
        transfer_from_data(buyer, vm.contract_address(), PRICE).to_vec()
    }

    fn mock_payment(vm: &TestVM, buyer: Address, response: Result<Vec<u8>, Vec<u8>>) {
        vm.mock_call(address(2), payment_data(vm, buyer), response);
    }

    fn mock_refund(vm: &TestVM, recipient: Address, response: Result<Vec<u8>, Vec<u8>>) {
        vm.mock_call(
            address(2),
            transfer_data(recipient, U256::from(PRICE)).to_vec(),
            response,
        );
    }

    fn mock_release(
        vm: &TestVM,
        revenue_amount: U256,
        fee_amount: U256,
        revenue_response: Result<Vec<u8>, Vec<u8>>,
        fee_response: Result<Vec<u8>, Vec<u8>>,
    ) {
        vm.mock_call(
            address(2),
            transfer_data(address(3), revenue_amount).to_vec(),
            revenue_response,
        );
        vm.mock_call(
            address(2),
            transfer_data(address(9), fee_amount).to_vec(),
            fee_response,
        );
    }

    fn true_word() -> Vec<u8> {
        let mut word = vec![0; 32];
        word[31] = 1;
        word
    }

    fn assert_error<T>(result: Result<T, Error>, expected: u8) {
        match result {
            Err(Error::MintUpError(MintUpError { code })) => assert_eq!(code, expected),
            _ => panic!("unexpected result"),
        }
    }

    fn buy(vm: &TestVM, contract: &mut MintUpEventPass, id: B256, buyer: Address) -> u64 {
        vm.set_sender(buyer);
        vm.set_block_timestamp(150);
        mock_payment(vm, buyer, Ok(true_word()));
        contract.purchase(id).unwrap()
    }

    fn topic_address(value: Address) -> B256 {
        let mut topic = [0; 32];
        topic[12..].copy_from_slice(value.as_slice());
        B256::from(topic)
    }

    fn topic_u256(value: U256) -> B256 {
        B256::from(value.to_be_bytes::<32>())
    }

    fn mock_authorization(
        vm: &TestVM,
        contract: &MintUpEventPass,
        caller: Address,
        pass_id: u64,
        recipient: Address,
        nonce: U256,
        deadline: u64,
    ) -> (u8, B256, B256) {
        mock_action_authorization(
            vm,
            contract,
            contract.transfer_operation(),
            caller,
            pass_id,
            recipient,
            U256::ZERO,
            nonce,
            150,
            deadline,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn mock_action_authorization(
        vm: &TestVM,
        contract: &MintUpEventPass,
        operation: B256,
        caller: Address,
        pass_id: u64,
        recipient: Address,
        amount: U256,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
    ) -> (u8, B256, B256) {
        let v = 27;
        let r = B256::with_last_byte(11);
        let s = B256::with_last_byte(12);
        let digest = contract.authorization_digest(
            operation, caller, pass_id, recipient, amount, nonce, issued_at, deadline,
        );
        let mut calldata = vec![0; 128];
        calldata[..32].copy_from_slice(digest.as_slice());
        calldata[63] = v;
        calldata[64..96].copy_from_slice(r.as_slice());
        calldata[96..].copy_from_slice(s.as_slice());
        let mut recovered = vec![0; 32];
        recovered[12..].copy_from_slice(address(5).as_slice());
        vm.mock_static_call(
            openzeppelin_stylus::utils::cryptography::ecdsa::ECRECOVER_ADDR,
            calldata,
            Ok(recovered),
        );
        (v, r, s)
    }

    fn authorized_create_offer(
        vm: &TestVM,
        contract: &mut MintUpEventPass,
        pass_id: u64,
        buyer: Address,
        price: U256,
        nonce: u64,
    ) -> Result<(), Error> {
        let seller = vm.msg_sender();
        let nonce = U256::from(nonce);
        let issued_at = vm.block_timestamp();
        let deadline = issued_at + 30;
        let (v, r, s) = mock_action_authorization(
            vm,
            contract,
            contract.create_resale_offer_operation(),
            seller,
            pass_id,
            buyer,
            price,
            nonce,
            issued_at,
            deadline,
        );
        contract.create_resale_offer(pass_id, buyer, price, nonce, issued_at, deadline, v, r, s)
    }

    fn authorized_cancel_offer(
        vm: &TestVM,
        contract: &mut MintUpEventPass,
        pass_id: u64,
        nonce: u64,
    ) -> Result<(), Error> {
        let seller = vm.msg_sender();
        let nonce = U256::from(nonce);
        let issued_at = vm.block_timestamp();
        let deadline = issued_at + 30;
        let (v, r, s) = mock_action_authorization(
            vm,
            contract,
            contract.cancel_resale_offer_operation(),
            seller,
            pass_id,
            Address::ZERO,
            U256::ZERO,
            nonce,
            issued_at,
            deadline,
        );
        contract.cancel_resale_offer(pass_id, nonce, issued_at, deadline, v, r, s)
    }

    fn authorized_purchase_resale(
        vm: &TestVM,
        contract: &mut MintUpEventPass,
        pass_id: u64,
        nonce: u64,
    ) -> Result<(), Error> {
        let buyer = vm.msg_sender();
        let (seller, _, price, _) = contract.resale_offer(pass_id)?;
        let nonce = U256::from(nonce);
        let issued_at = vm.block_timestamp();
        let deadline = issued_at + 30;
        let (v, r, s) = mock_action_authorization(
            vm,
            contract,
            contract.purchase_resale_operation(),
            buyer,
            pass_id,
            seller,
            price,
            nonce,
            issued_at,
            deadline,
        );
        contract.purchase_resale(pass_id, nonce, issued_at, deadline, v, r, s)
    }

    fn authorized_create_public_listing(
        vm: &TestVM,
        contract: &mut MintUpEventPass,
        pass_id: u64,
        price: U256,
        nonce: u64,
    ) -> Result<(), Error> {
        let seller = vm.msg_sender();
        let nonce = U256::from(nonce);
        let issued_at = vm.block_timestamp();
        let deadline = issued_at + 30;
        let (v, r, s) = mock_action_authorization(
            vm,
            contract,
            contract.create_public_resale_listing_operation(),
            seller,
            pass_id,
            Address::ZERO,
            price,
            nonce,
            issued_at,
            deadline,
        );
        contract.create_public_resale_listing(pass_id, price, nonce, issued_at, deadline, v, r, s)
    }

    fn authorized_purchase_public_resale(
        vm: &TestVM,
        contract: &mut MintUpEventPass,
        pass_id: u64,
        nonce: u64,
    ) -> Result<(), Error> {
        let buyer = vm.msg_sender();
        let (seller, price, _) = contract.public_resale_listing(pass_id)?;
        let nonce = U256::from(nonce);
        let issued_at = vm.block_timestamp();
        let deadline = issued_at + 30;
        let (v, r, s) = mock_action_authorization(
            vm,
            contract,
            contract.purchase_public_resale_operation(),
            buyer,
            pass_id,
            seller,
            price,
            nonce,
            issued_at,
            deadline,
        );
        contract.purchase_public_resale(pass_id, nonce, issued_at, deadline, v, r, s)
    }

    fn mock_public_resale_payment(vm: &TestVM, buyer: Address, seller: Address, price: U256) {
        let fee_amount = basis_points(price, RESALE_FEE_BPS);
        for calldata in [
            transfer_from_data_u256(buyer, vm.contract_address(), price).to_vec(),
            transfer_data(seller, price - fee_amount).to_vec(),
            transfer_data(address(9), fee_amount).to_vec(),
        ] {
            vm.mock_call(address(2), calldata, Ok(true_word()));
        }
    }

    fn authorized_cancel_public_listing(
        vm: &TestVM,
        contract: &mut MintUpEventPass,
        pass_id: u64,
        nonce: u64,
    ) -> Result<(), Error> {
        let seller = vm.msg_sender();
        let nonce = U256::from(nonce);
        let issued_at = vm.block_timestamp();
        let deadline = issued_at + 30;
        let (v, r, s) = mock_action_authorization(
            vm,
            contract,
            contract.cancel_public_resale_listing_operation(),
            seller,
            pass_id,
            Address::ZERO,
            U256::ZERO,
            nonce,
            issued_at,
            deadline,
        );
        contract.cancel_public_resale_listing(pass_id, nonce, issued_at, deadline, v, r, s)
    }

    #[test]
    fn constructor_and_event_administration_are_restricted() {
        let (vm, mut contract) = setup();
        assert_eq!(
            contract.config(),
            (
                address(1),
                address(2),
                address(5),
                address(9),
                500,
                900,
                false
            )
        );

        vm.set_sender(address(9));
        assert_error(
            contract.register_event(
                event_id(1),
                address(3),
                PRICE,
                1,
                START,
                END,
                RELEASE,
                true,
                true,
                address(4),
                METADATA_URI.into(),
            ),
            UNAUTHORIZED,
        );

        vm.set_sender(address(1));
        register(&mut contract, event_id(1), 2, true, address(4));
        assert_error(
            contract.register_event(
                event_id(1),
                address(3),
                PRICE,
                2,
                START,
                END,
                RELEASE,
                true,
                true,
                address(4),
                METADATA_URI.into(),
            ),
            EVENT_EXISTS,
        );
        assert_error(
            contract.register_event(
                event_id(2),
                Address::ZERO,
                PRICE,
                2,
                START,
                END,
                RELEASE,
                true,
                true,
                address(4),
                METADATA_URI.into(),
            ),
            INVALID_INPUT,
        );
    }

    #[test]
    fn constructor_and_registration_fix_protection_configuration() {
        let (vm, mut contract) = setup();
        let id = event_id(7);

        assert_eq!(
            contract.config(),
            (
                address(1),
                address(2),
                address(5),
                address(9),
                500,
                900,
                false
            )
        );
        register(&mut contract, id, 1, true, address(4));
        assert_eq!(
            contract.event_protection_info(id).unwrap(),
            (RELEASE, U256::ZERO, false, false)
        );

        assert_error(
            contract.register_event(
                event_id(8),
                address(3),
                PRICE,
                1,
                START,
                END,
                END - 1,
                true,
                true,
                address(4),
                METADATA_URI.into(),
            ),
            INVALID_INPUT,
        );

        let mut invalid = MintUpEventPass::from(&vm);
        assert_error(
            invalid.constructor(address(1), address(2), address(5), Address::ZERO, false),
            INVALID_INPUT,
        );
    }

    #[test]
    fn constructor_requires_a_distinct_mint_up_authorization_signer() {
        for signer in [Address::ZERO, address(1), address(2)] {
            let vm = TestVM::default();
            test_host::install(&vm);
            vm.set_sender(address(1));
            let mut contract = MintUpEventPass::from(&vm);

            assert_error(
                contract.constructor(address(1), address(2), signer, address(9), false),
                INVALID_INPUT,
            );
        }
    }

    #[test]
    fn exposes_erc721_collection_and_metadata_interfaces() {
        let (_, contract) = setup();

        assert_eq!(contract.name(), "Mint Up Event Pass");
        assert_eq!(contract.symbol(), "MUEP");
        assert!(contract.supports_interface(0x01ffc9a7_u32.into()));
        assert!(contract.supports_interface(0x80ac58cd_u32.into()));
        assert!(contract.supports_interface(0x5b5e139f_u32.into()));
        assert!(!contract.supports_interface(0x12345678_u32.into()));
    }

    #[test]
    fn event_registration_requires_public_ipfs_metadata() {
        let (_, mut contract) = setup();

        for metadata_uri in [
            "",
            "https://example.com/event.json",
            "ipfs://",
            "ipfs:///event.json",
            "ipfs://bad cid/event.json",
            "ipfs://hello/event.json",
        ] {
            assert_error(
                contract.register_event(
                    event_id(9),
                    address(3),
                    PRICE,
                    1,
                    START,
                    END,
                    RELEASE,
                    true,
                    true,
                    address(4),
                    metadata_uri.into(),
                ),
                INVALID_INPUT,
            );
        }
    }

    #[test]
    fn purchase_mints_erc721_with_pass_id_uri_balance_and_transfer_event() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let buyer = address(6);
        register(&mut contract, id, 1, true, address(4));
        vm.clear_mocks();

        let pass_id = buy(&vm, &mut contract, id, buyer);

        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), buyer);
        assert_eq!(contract.balance_of(buyer).unwrap(), U256::from(1));
        assert_eq!(
            contract.token_uri(U256::from(pass_id)).unwrap(),
            METADATA_URI
        );
        assert!(matches!(
            contract.token_uri(U256::from(999)),
            Err(Error::NonexistentToken(_))
        ));
        let transfer = vm
            .get_emitted_logs()
            .into_iter()
            .find(|(topics, _)| {
                topics.first()
                    == Some(&stylus_sdk::alloy_primitives::keccak256(
                        "Transfer(address,address,uint256)",
                    ))
            })
            .expect("purchase should emit the ERC-721 Transfer event");
        assert_eq!(
            transfer.0,
            vec![
                stylus_sdk::alloy_primitives::keccak256("Transfer(address,address,uint256)"),
                B256::ZERO,
                topic_address(buyer),
                topic_u256(U256::from(pass_id)),
            ]
        );
    }

    #[test]
    fn direct_erc721_movements_are_blocked_by_mint_up_policy() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let owner = address(6);
        let operator = address(7);
        let recipient = address(8);
        register(&mut contract, id, 1, true, address(4));
        let token_id = U256::from(buy(&vm, &mut contract, id, owner));

        for result in [
            contract.approve(operator, token_id),
            contract.set_approval_for_all(operator, true),
            contract.transfer_from(owner, recipient, token_id),
            contract.safe_transfer_from(owner, recipient, token_id),
            contract.safe_transfer_from_with_data(owner, recipient, token_id, vec![1].into()),
        ] {
            assert_error(result, MOVEMENT_RESTRICTED);
        }
        assert_eq!(contract.owner_of(token_id).unwrap(), owner);
        assert_eq!(contract.get_approved(token_id).unwrap(), Address::ZERO);
        assert!(!contract.is_approved_for_all(owner, operator));

        vm.set_sender(operator);
        assert_error(
            contract.transfer_from(owner, recipient, token_id),
            MOVEMENT_RESTRICTED,
        );
    }

    #[test]
    fn exact_mint_up_authorization_transfers_once_and_emits_evidence() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let owner = address(6);
        let recipient = address(8);
        let nonce = U256::from(42);
        let deadline = 180;
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, owner);
        let (v, r, s) =
            mock_authorization(&vm, &contract, owner, pass_id, recipient, nonce, deadline);
        vm.clear_mocks();
        mock_authorization(&vm, &contract, owner, pass_id, recipient, nonce, deadline);

        contract
            .transfer_pass(pass_id, recipient, nonce, 150, deadline, v, r, s)
            .unwrap();

        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), recipient);
        assert!(contract.authorization_used(nonce));
        let logs = vm.get_emitted_logs();
        assert!(logs.iter().any(|(topics, _)| {
            topics[0]
                == stylus_sdk::alloy_primitives::keccak256("Transfer(address,address,uint256)")
        }));
        let authorization = logs
            .iter()
            .find(|(topics, _)| {
                topics[0]
                    == stylus_sdk::alloy_primitives::keccak256(
                        "MintUpAuthorizationUsed(bytes32,address,uint256,uint64,address,uint256)",
                    )
            })
            .expect("authorized transfer should emit Mint Up evidence");
        assert_eq!(
            authorization.0,
            vec![
                stylus_sdk::alloy_primitives::keccak256(
                    "MintUpAuthorizationUsed(bytes32,address,uint256,uint64,address,uint256)",
                ),
                contract.transfer_operation(),
                topic_address(owner),
                topic_u256(nonce),
            ]
        );
        let mut expected_data = vec![0; 96];
        expected_data[..32].copy_from_slice(&U256::from(pass_id).to_be_bytes::<32>());
        expected_data[44..64].copy_from_slice(recipient.as_slice());
        assert_eq!(authorization.1, expected_data);

        vm.set_sender(recipient);
        assert_error(
            contract.transfer_pass(pass_id, owner, nonce, 150, deadline, v, r, s),
            AUTHORIZATION_USED,
        );
    }

    #[test]
    fn authorization_rejects_tampering_expiry_and_the_wrong_caller() {
        let cases = ["recipient", "nonce", "issued_at", "deadline", "caller"];
        for case in cases {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            let owner = address(6);
            let recipient = address(8);
            let nonce = U256::from(42);
            let deadline = 180;
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, owner);
            let (v, r, s) =
                mock_authorization(&vm, &contract, owner, pass_id, recipient, nonce, deadline);

            let attempted_recipient = if case == "recipient" {
                address(9)
            } else {
                recipient
            };
            let attempted_nonce = if case == "nonce" {
                nonce + U256::from(1)
            } else {
                nonce
            };
            let attempted_deadline = if case == "deadline" {
                deadline + 1
            } else {
                deadline
            };
            let attempted_issued_at = if case == "issued_at" { 149 } else { 150 };
            if case == "caller" {
                vm.set_sender(address(7));
                assert_error(
                    contract.transfer_pass(
                        pass_id,
                        attempted_recipient,
                        attempted_nonce,
                        attempted_issued_at,
                        attempted_deadline,
                        v,
                        r,
                        s,
                    ),
                    NOT_PASS_OWNER,
                );
            } else {
                assert_error(
                    contract.transfer_pass(
                        pass_id,
                        attempted_recipient,
                        attempted_nonce,
                        attempted_issued_at,
                        attempted_deadline,
                        v,
                        r,
                        s,
                    ),
                    INVALID_AUTHORIZATION,
                );
            }
            assert!(!contract.authorization_used(attempted_nonce));
            assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), owner);
        }

        let (vm, mut contract) = setup();
        let id = event_id(2);
        let owner = address(6);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, owner);
        let nonce = U256::from(7);
        let deadline = 149;
        let (v, r, s) =
            mock_authorization(&vm, &contract, owner, pass_id, address(8), nonce, deadline);
        assert_error(
            contract.transfer_pass(pass_id, address(8), nonce, 150, deadline, v, r, s),
            AUTHORIZATION_EXPIRED,
        );
        assert!(!contract.authorization_used(nonce));

        vm.set_block_timestamp(150);
        assert_error(
            contract.transfer_pass(pass_id, address(8), U256::from(8), 150, 451, v, r, s),
            INVALID_AUTHORIZATION,
        );
    }

    #[test]
    fn authorization_is_bound_to_chain_contract_operation_and_amount() {
        for domain in ["chain", "contract"] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            let owner = address(6);
            let recipient = address(8);
            let nonce = U256::from(9);
            let deadline = 180;
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, owner);
            let (v, r, s) =
                mock_authorization(&vm, &contract, owner, pass_id, recipient, nonce, deadline);
            if domain == "chain" {
                vm.set_chain_id(99_999);
            } else {
                vm.set_contract_address(address(10));
            }

            assert_error(
                contract.transfer_pass(pass_id, recipient, nonce, 150, deadline, v, r, s),
                INVALID_AUTHORIZATION,
            );
            assert!(!contract.authorization_used(nonce));
        }

        let (_, contract) = setup();
        let operation = contract.transfer_operation();
        let digest = contract.authorization_digest(
            operation,
            address(6),
            1,
            address(8),
            U256::ZERO,
            U256::from(1),
            150,
            180,
        );
        assert_ne!(
            digest,
            contract.authorization_digest(
                event_id(99),
                address(6),
                1,
                address(8),
                U256::ZERO,
                U256::from(1),
                150,
                180,
            )
        );
        assert_ne!(
            digest,
            contract.authorization_digest(
                operation,
                address(7),
                1,
                address(8),
                U256::ZERO,
                U256::from(1),
                150,
                180,
            )
        );
        assert_ne!(
            digest,
            contract.authorization_digest(
                operation,
                address(6),
                2,
                address(8),
                U256::ZERO,
                U256::from(1),
                150,
                180,
            )
        );
        assert_ne!(
            digest,
            contract.authorization_digest(
                operation,
                address(6),
                1,
                address(8),
                U256::from(1),
                U256::from(1),
                150,
                180,
            )
        );
        assert_ne!(
            digest,
            contract.authorization_digest(
                operation,
                address(6),
                1,
                address(8),
                U256::ZERO,
                U256::from(1),
                149,
                180,
            )
        );
    }

    #[test]
    fn purchase_pays_exact_price_then_issues_unique_pass() {
        let (vm, mut contract) = setup();
        let first_event = event_id(1);
        let second_event = event_id(2);
        register(&mut contract, first_event, 2, true, address(4));
        register(&mut contract, second_event, 1, true, address(5));

        let first = buy(&vm, &mut contract, first_event, address(6));
        let second = buy(&vm, &mut contract, second_event, address(7));
        assert_eq!((first, second), (1, 2));
        assert_eq!(
            contract.pass_info(first).unwrap(),
            (address(6), first_event, ACTIVE, true)
        );
        assert_eq!(contract.event_info(first_event).unwrap().3, 1);
        assert_eq!(contract.event_info(second_event).unwrap().3, 1);
        assert_eq!(
            contract.event_protection_info(first_event).unwrap(),
            (RELEASE, U256::from(PRICE), false, false)
        );
        assert_eq!(
            contract.event_protection_info(second_event).unwrap(),
            (RELEASE, U256::from(PRICE), false, false)
        );
        assert_eq!(
            contract.pass_refund_info(first).unwrap(),
            (PRICE, false, false)
        );

        vm.set_sender(address(8));
        vm.set_block_timestamp(150);
        mock_payment(&vm, address(8), Ok(true_word()));
        assert_error(contract.purchase(second_event), SOLD_OUT);
    }

    #[test]
    fn resale_actions_reject_missing_mint_up_authorization() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let owner = address(6);
        let buyer = address(7);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, owner);

        assert_error(
            contract.create_resale_offer(
                pass_id,
                buyer,
                U256::from(30_000_000),
                U256::from(1),
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            INVALID_AUTHORIZATION,
        );
        authorized_create_offer(
            &vm,
            &mut contract,
            pass_id,
            buyer,
            U256::from(30_000_000),
            2,
        )
        .unwrap();
        assert_error(
            contract.cancel_resale_offer(
                pass_id,
                U256::from(3),
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            INVALID_AUTHORIZATION,
        );
        vm.set_sender(buyer);
        assert_error(
            contract.purchase_resale(pass_id, U256::from(4), 150, 180, 27, B256::ZERO, B256::ZERO),
            INVALID_AUTHORIZATION,
        );
    }

    #[test]
    fn resale_authorization_binds_action_recipient_price_and_nonce() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let owner = address(6);
        let buyer = address(7);
        let other_buyer = address(8);
        let price = U256::from(30_000_000);
        let nonce = U256::from(1);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, owner);
        let (v, r, s) = mock_action_authorization(
            &vm,
            &contract,
            contract.create_resale_offer_operation(),
            owner,
            pass_id,
            buyer,
            price,
            nonce,
            150,
            180,
        );

        assert_error(
            contract.create_resale_offer(pass_id, other_buyer, price, nonce, 150, 180, v, r, s),
            INVALID_AUTHORIZATION,
        );
        assert_error(
            contract.create_resale_offer(
                pass_id,
                buyer,
                price + U256::from(1),
                nonce,
                150,
                180,
                v,
                r,
                s,
            ),
            INVALID_AUTHORIZATION,
        );
        contract
            .create_resale_offer(pass_id, buyer, price, nonce, 150, 180, v, r, s)
            .unwrap();
        assert!(contract.authorization_used(nonce));
        assert_error(
            contract.create_resale_offer(pass_id, buyer, price, nonce, 150, 180, v, r, s),
            AUTHORIZATION_USED,
        );
        let cancel_nonce = U256::from(2);
        let (cancel_v, cancel_r, cancel_s) = mock_action_authorization(
            &vm,
            &contract,
            contract.cancel_resale_offer_operation(),
            owner,
            pass_id,
            Address::ZERO,
            U256::ZERO,
            cancel_nonce,
            150,
            180,
        );
        assert_error(
            contract.create_resale_offer(
                pass_id,
                buyer,
                price,
                cancel_nonce,
                150,
                180,
                cancel_v,
                cancel_r,
                cancel_s,
            ),
            INVALID_AUTHORIZATION,
        );
        contract
            .cancel_resale_offer(
                pass_id,
                cancel_nonce,
                150,
                180,
                cancel_v,
                cancel_r,
                cancel_s,
            )
            .unwrap();
        assert!(contract.authorization_used(cancel_nonce));
        assert_ne!(
            contract.create_resale_offer_operation(),
            contract.cancel_resale_offer_operation(),
        );
        assert_ne!(
            contract.create_resale_offer_operation(),
            contract.purchase_resale_operation(),
        );
    }

    #[test]
    fn owner_creates_replaces_and_withdraws_one_private_resale_offer() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let owner = address(6);
        let first_buyer = address(7);
        let second_buyer = address(8);
        let first_price = U256::from(30_000_000);
        let second_price = U256::from(40_000_000);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, owner);

        vm.set_sender(first_buyer);
        assert_error(
            authorized_create_offer(&vm, &mut contract, pass_id, first_buyer, first_price, 1),
            NOT_PASS_OWNER,
        );
        vm.set_sender(owner);
        assert_error(
            authorized_create_offer(&vm, &mut contract, pass_id, owner, first_price, 1),
            INVALID_INPUT,
        );
        assert_error(
            authorized_create_offer(&vm, &mut contract, pass_id, first_buyer, U256::ZERO, 1),
            INVALID_INPUT,
        );

        authorized_create_offer(&vm, &mut contract, pass_id, first_buyer, first_price, 1).unwrap();
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (owner, first_buyer, first_price, true)
        );

        authorized_create_offer(&vm, &mut contract, pass_id, second_buyer, second_price, 2)
            .unwrap();
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (owner, second_buyer, second_price, true)
        );

        authorized_cancel_offer(&vm, &mut contract, pass_id, 3).unwrap();
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (Address::ZERO, Address::ZERO, U256::ZERO, false)
        );
        assert_error(
            authorized_cancel_offer(&vm, &mut contract, pass_id, 4),
            RESALE_OFFER_NOT_FOUND,
        );
    }

    #[test]
    fn owner_creates_and_replaces_one_public_listing_within_protected_payment() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);

        assert_error(
            authorized_create_public_listing(&vm, &mut contract, pass_id, U256::ZERO, 1),
            INVALID_INPUT,
        );
        assert_error(
            authorized_create_public_listing(
                &vm,
                &mut contract,
                pass_id,
                U256::from(PRICE) + U256::from(1),
                1,
            ),
            INVALID_INPUT,
        );
        authorized_create_public_listing(&vm, &mut contract, pass_id, U256::from(20_000_000), 1)
            .unwrap();
        authorized_create_public_listing(&vm, &mut contract, pass_id, U256::from(PRICE), 2)
            .unwrap();

        assert_eq!(
            contract.public_resale_listing(pass_id).unwrap(),
            (seller, U256::from(PRICE), true)
        );

        authorized_cancel_public_listing(&vm, &mut contract, pass_id, 3).unwrap();
        assert_eq!(
            contract.public_resale_listing(pass_id).unwrap(),
            (Address::ZERO, U256::ZERO, false)
        );
        assert_error(
            authorized_cancel_public_listing(&vm, &mut contract, pass_id, 4),
            RESALE_OFFER_NOT_FOUND,
        );
    }

    #[test]
    fn any_exactly_authorized_buyer_purchases_public_listing_with_91_9_conservation() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        let buyer = address(7);
        let other_buyer = address(8);
        let price = U256::from(20_000_001);
        let seller_amount = U256::from(18_200_001);
        let fee_amount = U256::from(1_800_000);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);
        authorized_create_public_listing(&vm, &mut contract, pass_id, price, 1).unwrap();

        vm.set_sender(other_buyer);
        let nonce = U256::from(2);
        let (v, r, s) = mock_action_authorization(
            &vm,
            &contract,
            contract.purchase_public_resale_operation(),
            buyer,
            pass_id,
            seller,
            price,
            nonce,
            150,
            180,
        );
        assert_error(
            contract.purchase_public_resale(pass_id, nonce, 150, 180, v, r, s),
            INVALID_AUTHORIZATION,
        );

        vm.set_sender(buyer);
        for (calldata, response) in [
            transfer_from_data_u256(buyer, vm.contract_address(), price).to_vec(),
            transfer_data(seller, seller_amount).to_vec(),
            transfer_data(address(9), fee_amount).to_vec(),
        ]
        .into_iter()
        .zip([Ok(true_word()), Ok(true_word()), Ok(true_word())])
        {
            vm.mock_call(address(2), calldata, response);
        }
        authorized_purchase_public_resale(&vm, &mut contract, pass_id, 2).unwrap();

        assert_eq!(seller_amount + fee_amount, price);
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), buyer);
        assert_eq!(
            contract.public_resale_listing(pass_id).unwrap(),
            (Address::ZERO, U256::ZERO, false)
        );
        assert_eq!(contract.pass_refund_info(pass_id).unwrap().0, PRICE);
    }

    #[test]
    fn first_confirmed_public_resale_purchase_wins_without_reserving_the_listing() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        let winner = address(7);
        let loser = address(8);
        let price = U256::from(20_000_000);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);
        authorized_create_public_listing(&vm, &mut contract, pass_id, price, 1).unwrap();

        vm.set_sender(winner);
        mock_public_resale_payment(&vm, winner, seller, price);
        authorized_purchase_public_resale(&vm, &mut contract, pass_id, 2).unwrap();

        vm.set_sender(loser);
        assert_error(
            authorized_purchase_public_resale(&vm, &mut contract, pass_id, 3),
            RESALE_OFFER_NOT_FOUND,
        );
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), winner);
        assert!(!contract.authorization_used(U256::from(3)));
    }

    #[test]
    fn lifecycle_changes_remove_public_listings_and_pause_requires_relisting() {
        for invalidation in ["start", "cancel", "pause", "check-in", "transfer"] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            let seller = address(6);
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, seller);
            authorized_create_public_listing(
                &vm,
                &mut contract,
                pass_id,
                U256::from(20_000_000),
                1,
            )
            .unwrap();

            match invalidation {
                "start" => vm.set_block_timestamp(RELEASE),
                "cancel" => {
                    vm.set_sender(address(1));
                    contract.cancel_event(id).unwrap();
                }
                "pause" => {
                    vm.set_sender(address(1));
                    contract.set_paused(true).unwrap();
                    contract.set_paused(false).unwrap();
                }
                "check-in" => {
                    vm.set_sender(address(4));
                    contract.check_in(id, pass_id).unwrap();
                }
                "transfer" => {
                    vm.set_sender(seller);
                    let recipient = address(7);
                    let nonce = U256::from(2);
                    let (v, r, s) =
                        mock_authorization(&vm, &contract, seller, pass_id, recipient, nonce, 180);
                    contract
                        .transfer_pass(pass_id, recipient, nonce, 150, 180, v, r, s)
                        .unwrap();
                }
                _ => unreachable!(),
            }

            assert!(!contract.public_resale_listing(pass_id).unwrap().2);
            vm.set_sender(address(8));
            assert!(authorized_purchase_public_resale(&vm, &mut contract, pass_id, 9).is_err());
            assert!(!contract.authorization_used(U256::from(9)));
            if invalidation == "pause" {
                vm.set_sender(seller);
                authorized_create_public_listing(
                    &vm,
                    &mut contract,
                    pass_id,
                    U256::from(20_000_000),
                    2,
                )
                .unwrap();
                assert!(contract.public_resale_listing(pass_id).unwrap().2);
            }
        }
    }

    #[test]
    fn failed_public_resale_payment_and_reentrancy_preserve_owner_and_listing() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        let buyer = address(7);
        let price = U256::from(20_000_000);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);
        authorized_create_public_listing(&vm, &mut contract, pass_id, price, 1).unwrap();
        vm.set_sender(buyer);
        vm.mock_call(
            address(2),
            transfer_from_data_u256(buyer, vm.contract_address(), price).to_vec(),
            Ok(vec![0; 32]),
        );

        assert_error(
            authorized_purchase_public_resale(&vm, &mut contract, pass_id, 2),
            PAYMENT_FAILED,
        );
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), seller);
        assert_eq!(
            contract.public_resale_listing(pass_id).unwrap(),
            (seller, price, true)
        );

        contract.entered.set(true);
        assert_error(
            authorized_purchase_public_resale(&vm, &mut contract, pass_id, 3),
            REENTRANCY,
        );
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), seller);
        assert_eq!(
            contract.public_resale_listing(pass_id).unwrap(),
            (seller, price, true)
        );
    }

    #[test]
    fn every_failed_public_resale_payment_leg_preserves_owner_and_listing() {
        for failed_leg in 0..3 {
            let (vm, mut contract) = setup();
            let id = event_id(failed_leg + 1);
            let seller = address(6);
            let buyer = address(7);
            let price = U256::from(20_000_000);
            let seller_amount = U256::from(18_200_000);
            let fee_amount = U256::from(1_800_000);
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, seller);
            authorized_create_public_listing(&vm, &mut contract, pass_id, price, 1).unwrap();
            vm.set_sender(buyer);
            for (leg, calldata) in [
                transfer_from_data_u256(buyer, vm.contract_address(), price).to_vec(),
                transfer_data(seller, seller_amount).to_vec(),
                transfer_data(address(9), fee_amount).to_vec(),
            ]
            .into_iter()
            .enumerate()
            {
                vm.mock_call(
                    address(2),
                    calldata,
                    if leg == usize::from(failed_leg) {
                        Ok(vec![0; 32])
                    } else {
                        Ok(true_word())
                    },
                );
            }

            assert_error(
                authorized_purchase_public_resale(&vm, &mut contract, pass_id, 2),
                PAYMENT_FAILED,
            );
            assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), seller);
            assert_eq!(
                contract.public_resale_listing(pass_id).unwrap(),
                (seller, price, true)
            );
            assert!(!contract.authorization_used(U256::from(2)));
        }
    }

    #[test]
    fn designated_buyer_accepts_for_exact_price_with_91_9_conservation() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        let buyer = address(7);
        let resale_price = U256::from(30_000_001);
        let fee_amount = U256::from(2_700_000);
        let seller_amount = U256::from(27_300_001);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);
        authorized_create_offer(&vm, &mut contract, pass_id, buyer, resale_price, 1).unwrap();

        assert_error(
            authorized_purchase_resale(&vm, &mut contract, pass_id, 2),
            NOT_DESIGNATED_BUYER,
        );
        vm.set_sender(buyer);
        vm.mock_call(
            address(2),
            transfer_from_data_u256(buyer, vm.contract_address(), resale_price).to_vec(),
            Ok(true_word()),
        );
        vm.mock_call(
            address(2),
            transfer_data(seller, seller_amount).to_vec(),
            Ok(true_word()),
        );
        vm.mock_call(
            address(2),
            transfer_data(address(9), fee_amount).to_vec(),
            Ok(true_word()),
        );

        authorized_purchase_resale(&vm, &mut contract, pass_id, 2).unwrap();

        assert_eq!(seller_amount + fee_amount, resale_price);
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), buyer);
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (Address::ZERO, Address::ZERO, U256::ZERO, false)
        );
        assert_eq!(
            contract.pass_refund_info(pass_id).unwrap(),
            (PRICE, false, false)
        );
        assert_error(
            authorized_purchase_resale(&vm, &mut contract, pass_id, 3),
            RESALE_OFFER_NOT_FOUND,
        );
        assert!(vm.get_emitted_logs().iter().any(|(topics, _)| {
            topics[0]
                == stylus_sdk::alloy_primitives::keccak256(
                    "EventPassResold(uint64,address,address,uint256,uint256,uint256)",
                )
        }));
    }

    #[test]
    fn resale_is_open_until_event_start_and_rounds_small_fees_down() {
        for (price, seller_amount, fee_amount) in [(1_u64, 1_u64, 0_u64), (11, 11, 0), (12, 11, 1)]
        {
            let (vm, mut contract) = setup();
            let id = event_id(price as u8);
            let seller = address(6);
            let buyer = address(7);
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, seller);
            let price = U256::from(price);
            authorized_create_offer(&vm, &mut contract, pass_id, buyer, price, 1).unwrap();
            vm.set_sender(buyer);
            vm.set_block_timestamp(RELEASE - 1);
            vm.mock_call(
                address(2),
                transfer_from_data_u256(buyer, vm.contract_address(), price).to_vec(),
                Ok(true_word()),
            );
            vm.mock_call(
                address(2),
                transfer_data(seller, U256::from(seller_amount)).to_vec(),
                Ok(true_word()),
            );
            vm.mock_call(
                address(2),
                transfer_data(address(9), U256::from(fee_amount)).to_vec(),
                Ok(true_word()),
            );

            authorized_purchase_resale(&vm, &mut contract, pass_id, 2).unwrap();

            assert_eq!(seller_amount + fee_amount, price.to::<u64>());
            assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), buyer);
        }
    }

    #[test]
    fn resale_accepts_the_maximum_price_without_fee_overflow() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        let buyer = address(7);
        let price = U256::MAX;
        let fee_amount =
            ((price - U256::from(35)) / U256::from(100)) * U256::from(9) + U256::from(3);
        let seller_amount = price - fee_amount;
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);
        authorized_create_offer(&vm, &mut contract, pass_id, buyer, price, 1).unwrap();
        vm.set_sender(buyer);
        vm.mock_call(
            address(2),
            transfer_from_data_u256(buyer, vm.contract_address(), price).to_vec(),
            Ok(true_word()),
        );
        vm.mock_call(
            address(2),
            transfer_data(seller, seller_amount).to_vec(),
            Ok(true_word()),
        );
        vm.mock_call(
            address(2),
            transfer_data(address(9), fee_amount).to_vec(),
            Ok(true_word()),
        );

        authorized_purchase_resale(&vm, &mut contract, pass_id, 2).unwrap();

        assert_eq!(seller_amount + fee_amount, price);
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), buyer);
    }

    #[test]
    fn free_transfer_and_check_in_clear_the_previous_owners_offer() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let owner = address(6);
        let recipient = address(7);
        let buyer = address(8);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, owner);
        authorized_create_offer(
            &vm,
            &mut contract,
            pass_id,
            buyer,
            U256::from(30_000_000),
            1,
        )
        .unwrap();
        let (v, r, s) = mock_authorization(
            &vm,
            &contract,
            owner,
            pass_id,
            recipient,
            U256::from(77),
            180,
        );

        contract
            .transfer_pass(pass_id, recipient, U256::from(77), 150, 180, v, r, s)
            .unwrap();
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (Address::ZERO, Address::ZERO, U256::ZERO, false)
        );

        vm.set_sender(recipient);
        authorized_create_offer(
            &vm,
            &mut contract,
            pass_id,
            buyer,
            U256::from(31_000_000),
            2,
        )
        .unwrap();
        vm.set_sender(address(4));
        contract.check_in(id, pass_id).unwrap();
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (Address::ZERO, Address::ZERO, U256::ZERO, false)
        );
    }

    #[test]
    fn event_start_cancellation_and_pause_permanently_stale_existing_offers() {
        for invalidation in ["start", "cancel", "pause"] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            let owner = address(6);
            let buyer = address(7);
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, owner);
            authorized_create_offer(
                &vm,
                &mut contract,
                pass_id,
                buyer,
                U256::from(30_000_000),
                1,
            )
            .unwrap();

            if invalidation == "start" {
                vm.set_block_timestamp(RELEASE);
            } else {
                vm.set_sender(address(1));
                if invalidation == "cancel" {
                    contract.cancel_event(id).unwrap();
                } else {
                    contract.set_paused(true).unwrap();
                    contract.set_paused(false).unwrap();
                }
            }

            assert!(!contract.resale_offer(pass_id).unwrap().3);
            vm.set_sender(buyer);
            assert_error(
                authorized_purchase_resale(&vm, &mut contract, pass_id, 2),
                RESALE_UNAVAILABLE,
            );
        }
    }

    #[test]
    fn failed_resale_payment_legs_preserve_owner_offer_and_original_price() {
        let invalid_responses = [
            Ok(vec![]),
            Ok(vec![0; 32]),
            Ok(vec![1]),
            Ok(vec![2; 32]),
            Ok(vec![0; 33]),
            Err(vec![0xff]),
        ];

        for failed_leg in 0..3 {
            for invalid_response in invalid_responses.clone() {
                let (vm, mut contract) = setup();
                let id = event_id(1);
                let seller = address(6);
                let buyer = address(7);
                let resale_price = U256::from(30_000_000);
                let seller_amount = U256::from(27_300_000);
                let fee_amount = U256::from(2_700_000);
                register(&mut contract, id, 1, true, address(4));
                let pass_id = buy(&vm, &mut contract, id, seller);
                authorized_create_offer(&vm, &mut contract, pass_id, buyer, resale_price, 1)
                    .unwrap();
                vm.set_sender(buyer);
                let responses = (0..3).map(|leg| {
                    if leg == failed_leg {
                        invalid_response.clone()
                    } else {
                        Ok(true_word())
                    }
                });
                for (calldata, response) in [
                    transfer_from_data_u256(buyer, vm.contract_address(), resale_price).to_vec(),
                    transfer_data(seller, seller_amount).to_vec(),
                    transfer_data(address(9), fee_amount).to_vec(),
                ]
                .into_iter()
                .zip(responses)
                {
                    vm.mock_call(address(2), calldata, response);
                }

                assert_error(
                    authorized_purchase_resale(&vm, &mut contract, pass_id, 2),
                    PAYMENT_FAILED,
                );
                assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), seller);
                assert_eq!(
                    contract.resale_offer(pass_id).unwrap(),
                    (seller, buyer, resale_price, true)
                );
                assert_eq!(
                    contract.pass_refund_info(pass_id).unwrap(),
                    (PRICE, false, false)
                );
            }
        }
    }

    #[test]
    fn resale_reentrancy_is_rejected_without_consuming_the_offer() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let seller = address(6);
        let buyer = address(7);
        let resale_price = U256::from(30_000_000);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, seller);
        authorized_create_offer(&vm, &mut contract, pass_id, buyer, resale_price, 1).unwrap();
        vm.set_sender(buyer);
        contract.entered.set(true);

        assert_error(
            authorized_purchase_resale(&vm, &mut contract, pass_id, 2),
            REENTRANCY,
        );
        vm.set_sender(address(4));
        assert_error(contract.check_in(id, pass_id), REENTRANCY);
        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), seller);
        assert_eq!(
            contract.resale_offer(pass_id).unwrap(),
            (seller, buyer, resale_price, true)
        );
    }

    #[test]
    fn failed_usdc_responses_never_issue() {
        for response in [
            Ok(vec![]),
            Ok(vec![0; 32]),
            Ok(vec![1]),
            Ok(vec![2; 32]),
            Ok(vec![0; 33]),
            Err(vec![0xff]),
        ] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            register(&mut contract, id, 1, true, address(4));
            vm.set_sender(address(6));
            vm.set_block_timestamp(150);
            mock_payment(&vm, address(6), response);

            assert_error(contract.purchase(id), PAYMENT_FAILED);
            assert_eq!(contract.event_info(id).unwrap().3, 0);
            assert_eq!(contract.event_protection_info(id).unwrap().1, U256::ZERO);
            assert_error(contract.pass_info(1), PASS_NOT_FOUND);
        }
    }

    #[test]
    fn cancellation_is_admin_only_and_strictly_before_release() {
        for timestamp in [RELEASE, RELEASE + 1] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            register(&mut contract, id, 1, true, address(4));
            vm.set_block_timestamp(timestamp);

            assert_error(contract.cancel_event(id), CANCELLATION_CLOSED);
            assert!(!contract.event_protection_info(id).unwrap().2);
        }

        let (vm, mut contract) = setup();
        let id = event_id(2);
        register(&mut contract, id, 1, true, address(4));
        vm.set_sender(address(6));
        vm.set_block_timestamp(RELEASE - 1);
        assert_error(contract.cancel_event(id), UNAUTHORIZED);
        vm.set_sender(address(1));
        contract.cancel_event(id).unwrap();
        assert!(contract.event_protection_info(id).unwrap().2);
    }

    #[test]
    fn refund_follows_transferred_checked_in_pass_and_preserves_history() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let buyer = address(6);
        let holder = address(7);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, buyer);
        let (v, r, s) =
            mock_authorization(&vm, &contract, buyer, pass_id, holder, U256::from(1), 180);
        contract
            .transfer_pass(pass_id, holder, U256::from(1), 150, 180, v, r, s)
            .unwrap();
        vm.set_sender(address(4));
        contract.check_in(id, pass_id).unwrap();
        vm.set_sender(address(1));
        contract.cancel_event(id).unwrap();

        vm.set_sender(buyer);
        assert_error(contract.claim_refund(pass_id), NOT_PASS_OWNER);
        vm.set_sender(holder);
        mock_refund(&vm, holder, Ok(true_word()));
        contract.claim_refund(pass_id).unwrap();

        assert_eq!(contract.owner_of(U256::from(pass_id)).unwrap(), holder);
        assert_eq!(contract.balance_of(holder).unwrap(), U256::from(1));
        assert_eq!(
            contract.token_uri(U256::from(pass_id)).unwrap(),
            METADATA_URI
        );
        assert_eq!(
            contract.pass_info(pass_id).unwrap(),
            (holder, id, ATTENDED, false)
        );
        assert_eq!(
            contract.pass_refund_info(pass_id).unwrap(),
            (PRICE, true, false)
        );
        assert_eq!(contract.event_protection_info(id).unwrap().1, U256::ZERO);
        assert_error(contract.claim_refund(pass_id), REFUND_ALREADY_CLAIMED);
        assert!(vm.get_emitted_logs().iter().any(|(topics, _)| {
            topics[0]
                == stylus_sdk::alloy_primitives::keccak256(
                    "EventPassRefunded(uint64,bytes32,address,uint64)",
                )
        }));
    }

    #[test]
    fn failed_and_paused_refunds_preserve_event_accounting_for_retry() {
        for response in [
            Ok(vec![]),
            Ok(vec![0; 32]),
            Ok(vec![1]),
            Ok(vec![0; 33]),
            Err(vec![0xff]),
        ] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            let buyer = address(6);
            register(&mut contract, id, 1, true, address(4));
            let pass_id = buy(&vm, &mut contract, id, buyer);
            vm.set_sender(address(1));
            contract.cancel_event(id).unwrap();
            contract.set_paused(true).unwrap();
            vm.set_sender(buyer);
            assert_error(contract.claim_refund(pass_id), PAUSED);
            vm.set_sender(address(1));
            contract.set_paused(false).unwrap();
            vm.set_sender(buyer);
            mock_refund(&vm, buyer, response);

            assert_error(contract.claim_refund(pass_id), PAYMENT_FAILED);
            assert_eq!(
                contract.pass_refund_info(pass_id).unwrap(),
                (PRICE, false, true)
            );
            assert_eq!(
                contract.event_protection_info(id).unwrap().1,
                U256::from(PRICE)
            );
        }
    }

    #[test]
    fn refund_only_consumes_its_events_protected_balance() {
        let (vm, mut contract) = setup();
        let first_event = event_id(1);
        let second_event = event_id(2);
        let buyer = address(6);
        register(&mut contract, first_event, 1, true, address(4));
        register(&mut contract, second_event, 1, true, address(4));
        let first_pass = buy(&vm, &mut contract, first_event, buyer);
        buy(&vm, &mut contract, second_event, buyer);
        vm.set_sender(address(1));
        contract.cancel_event(first_event).unwrap();
        vm.set_sender(buyer);
        mock_refund(&vm, buyer, Ok(true_word()));
        contract.claim_refund(first_pass).unwrap();

        assert_eq!(
            contract.event_protection_info(first_event).unwrap().1,
            U256::ZERO
        );
        assert_eq!(
            contract.event_protection_info(second_event).unwrap().1,
            U256::from(PRICE)
        );
    }

    #[test]
    fn refund_reentrancy_lock_prevents_duplicate_execution() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        let buyer = address(6);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, buyer);
        vm.set_sender(address(1));
        contract.cancel_event(id).unwrap();
        vm.set_sender(buyer);
        contract.entered.set(true);

        assert_error(contract.claim_refund(pass_id), REENTRANCY);
        assert_eq!(
            contract.pass_refund_info(pass_id).unwrap(),
            (PRICE, false, true)
        );
        assert_eq!(
            contract.event_protection_info(id).unwrap().1,
            U256::from(PRICE)
        );
    }

    #[test]
    fn anyone_releases_exact_protected_balance_at_release_time() {
        let (vm, mut contract) = setup();
        let id = event_id(3);
        register(&mut contract, id, 1, true, address(4));
        buy(&vm, &mut contract, id, address(6));
        let fee = U256::from(1_250_000);
        let revenue_amount = U256::from(23_750_000);

        vm.set_sender(address(8));
        vm.set_block_timestamp(RELEASE - 1);
        assert_error(contract.release_funds(id), RELEASE_NOT_READY);

        vm.set_block_timestamp(RELEASE);
        mock_release(&vm, revenue_amount, fee, Ok(true_word()), Ok(true_word()));
        contract.release_funds(id).unwrap();

        assert_eq!(
            contract.event_protection_info(id).unwrap(),
            (RELEASE, U256::ZERO, false, true)
        );
        assert_eq!(contract.event_info(id).unwrap().0, address(3));
        assert_eq!(contract.config().3, address(9));
        assert_error(contract.release_funds(id), FUNDS_ALREADY_RELEASED);
        let release = vm
            .get_emitted_logs()
            .into_iter()
            .find(|(topics, _)| {
                topics[0]
                    == stylus_sdk::alloy_primitives::keccak256(
                        "EventFundsReleased(bytes32,address,address,uint256,uint256)",
                    )
            })
            .expect("release should emit canonical settlement evidence");
        assert_eq!(
            release.0,
            vec![
                stylus_sdk::alloy_primitives::keccak256(
                    "EventFundsReleased(bytes32,address,address,uint256,uint256)",
                ),
                id,
                topic_address(address(3)),
                topic_address(address(9)),
            ]
        );
        let mut expected_data = vec![0; 64];
        expected_data[..32].copy_from_slice(&revenue_amount.to_be_bytes::<32>());
        expected_data[32..].copy_from_slice(&fee.to_be_bytes::<32>());
        assert_eq!(release.1, expected_data);
    }

    #[test]
    fn release_rounds_fee_down_and_preserves_small_balances() {
        for (balance, revenue_amount, fee) in [(1_u64, 1_u64, 0_u64), (19, 19, 0), (20, 19, 1)] {
            let (vm, mut contract) = setup();
            let id = event_id(balance as u8);
            contract
                .register_event(
                    id,
                    address(3),
                    balance,
                    1,
                    START,
                    END,
                    RELEASE,
                    true,
                    true,
                    address(4),
                    METADATA_URI.into(),
                )
                .unwrap();
            vm.set_sender(address(6));
            vm.set_block_timestamp(150);
            vm.mock_call(
                address(2),
                transfer_from_data(address(6), vm.contract_address(), balance).to_vec(),
                Ok(true_word()),
            );
            contract.purchase(id).unwrap();
            vm.set_block_timestamp(RELEASE);
            mock_release(
                &vm,
                U256::from(revenue_amount),
                U256::from(fee),
                Ok(true_word()),
                Ok(true_word()),
            );

            contract.release_funds(id).unwrap();
            assert_eq!(revenue_amount + fee, balance);
            assert_eq!(contract.event_protection_info(id).unwrap().1, U256::ZERO);
        }
    }

    #[test]
    fn failed_release_is_retryable_and_does_not_consume_another_event() {
        let (vm, mut contract) = setup();
        let first_event = event_id(3);
        let second_event = event_id(4);
        register(&mut contract, first_event, 1, true, address(4));
        register(&mut contract, second_event, 1, true, address(4));
        buy(&vm, &mut contract, first_event, address(6));
        buy(&vm, &mut contract, second_event, address(7));
        vm.set_block_timestamp(RELEASE);
        let fee = U256::from(1_250_000);
        let revenue_amount = U256::from(23_750_000);
        mock_release(&vm, revenue_amount, fee, Ok(true_word()), Ok(vec![0; 32]));

        assert_error(contract.release_funds(first_event), PAYMENT_FAILED);
        assert_eq!(
            contract.event_protection_info(first_event).unwrap(),
            (RELEASE, U256::from(PRICE), false, false)
        );
        assert_eq!(
            contract.event_protection_info(second_event).unwrap(),
            (RELEASE, U256::from(PRICE), false, false)
        );

        mock_release(&vm, revenue_amount, fee, Ok(true_word()), Ok(true_word()));
        contract.release_funds(first_event).unwrap();
        assert_eq!(
            contract.event_protection_info(first_event).unwrap().1,
            U256::ZERO
        );
        assert_eq!(
            contract.event_protection_info(second_event).unwrap().1,
            U256::from(PRICE)
        );
    }

    #[test]
    fn every_failed_release_leg_preserves_settlement_for_retry() {
        let invalid_responses = [
            Ok(vec![]),
            Ok(vec![0; 32]),
            Ok(vec![1]),
            Ok(vec![2; 32]),
            Ok(vec![0; 33]),
            Err(vec![0xff]),
        ];

        for fail_revenue_leg in [true, false] {
            for response in invalid_responses.clone() {
                let (vm, mut contract) = setup();
                let id = event_id(3);
                register(&mut contract, id, 1, true, address(4));
                buy(&vm, &mut contract, id, address(6));
                vm.set_block_timestamp(RELEASE);
                let success = Ok(true_word());
                let (revenue_response, fee_response) = if fail_revenue_leg {
                    (response, success)
                } else {
                    (success, response)
                };
                mock_release(
                    &vm,
                    U256::from(23_750_000),
                    U256::from(1_250_000),
                    revenue_response,
                    fee_response,
                );

                assert_error(contract.release_funds(id), PAYMENT_FAILED);
                assert_eq!(
                    contract.event_protection_info(id).unwrap(),
                    (RELEASE, U256::from(PRICE), false, false)
                );
            }
        }
    }

    #[test]
    fn cancelled_and_paused_releases_are_rejected() {
        let (vm, mut contract) = setup();
        let id = event_id(3);
        register(&mut contract, id, 1, true, address(4));
        buy(&vm, &mut contract, id, address(6));
        vm.set_sender(address(1));
        contract.cancel_event(id).unwrap();
        vm.set_block_timestamp(RELEASE);
        assert_error(contract.release_funds(id), EVENT_CANCELLED);

        let live_id = event_id(4);
        register(&mut contract, live_id, 1, true, address(4));
        buy(&vm, &mut contract, live_id, address(7));
        vm.set_sender(address(1));
        contract.set_paused(true).unwrap();
        assert_error(contract.release_funds(live_id), PAUSED);
        assert_eq!(
            contract.event_protection_info(live_id).unwrap().1,
            U256::from(PRICE)
        );
    }

    #[test]
    fn sale_guards_and_pause_block_purchases() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        register(&mut contract, id, 2, true, address(4));
        vm.set_sender(address(6));
        vm.set_block_timestamp(99);
        assert_error(contract.purchase(id), OUTSIDE_SALE_WINDOW);

        vm.set_block_timestamp(START);
        mock_payment(&vm, address(6), Ok(true_word()));
        contract.purchase(id).unwrap();

        vm.set_sender(address(7));
        vm.set_block_timestamp(END);
        assert_error(contract.purchase(id), OUTSIDE_SALE_WINDOW);

        vm.set_sender(address(1));
        contract.set_event_sales(id, false).unwrap();
        vm.set_sender(address(6));
        vm.set_block_timestamp(150);
        assert_error(contract.purchase(id), SALES_CLOSED);

        vm.set_sender(address(1));
        contract.set_event_sales(id, true).unwrap();
        contract.set_paused(true).unwrap();
        vm.set_sender(address(6));
        assert_error(contract.purchase(id), PAUSED);
    }

    #[test]
    fn purchase_reentrancy_lock_prevents_duplicate_execution() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        register(&mut contract, id, 1, true, address(4));
        vm.set_sender(address(6));
        vm.set_block_timestamp(150);
        contract.entered.set(true);

        assert_error(contract.purchase(id), REENTRANCY);
        assert_eq!(contract.event_info(id).unwrap().3, 0);
        assert_error(contract.pass_info(1), PASS_NOT_FOUND);
    }

    #[test]
    fn owner_transfer_and_check_in_complete_lifecycle() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        register(&mut contract, id, 1, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, address(6));

        vm.set_sender(address(7));
        assert_error(
            contract.transfer_pass(
                pass_id,
                address(8),
                U256::ZERO,
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            NOT_PASS_OWNER,
        );
        vm.set_sender(address(6));
        let (v, r, s) = mock_authorization(
            &vm,
            &contract,
            address(6),
            pass_id,
            address(7),
            U256::ZERO,
            180,
        );
        contract
            .transfer_pass(pass_id, address(7), U256::ZERO, 150, 180, v, r, s)
            .unwrap();
        assert_eq!(contract.pass_info(pass_id).unwrap().0, address(7));

        vm.set_sender(address(5));
        assert_error(contract.check_in(id, pass_id), UNAUTHORIZED);
        vm.set_sender(address(4));
        contract.check_in(id, pass_id).unwrap();
        assert_eq!(
            contract.pass_info(pass_id).unwrap(),
            (address(7), id, ATTENDED, false)
        );
        assert_error(contract.check_in(id, pass_id), PASS_NOT_ACTIVE);
        vm.set_sender(address(7));
        assert_error(
            contract.transfer_pass(
                pass_id,
                address(8),
                U256::from(1),
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            PASS_NOT_ACTIVE,
        );
    }

    #[test]
    fn operators_cannot_check_in_unrelated_event_passes() {
        let (vm, mut contract) = setup();
        let first_event = event_id(1);
        let second_event = event_id(2);
        register(&mut contract, first_event, 1, true, address(4));
        register(&mut contract, second_event, 1, true, address(5));
        let pass_id = buy(&vm, &mut contract, first_event, address(6));

        vm.set_sender(address(5));
        assert_error(contract.check_in(first_event, pass_id), UNAUTHORIZED);
        assert_error(contract.check_in(second_event, pass_id), WRONG_EVENT);
        assert!(contract.is_valid_for_check_in(pass_id));
    }

    #[test]
    fn cancellation_is_permanent_and_invalidates_existing_passes() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        register(&mut contract, id, 2, true, address(4));
        let pass_id = buy(&vm, &mut contract, id, address(6));

        vm.set_sender(address(1));
        contract.cancel_event(id).unwrap();
        assert!(!contract.is_valid_for_check_in(pass_id));
        assert_error(contract.set_event_sales(id, true), EVENT_CANCELLED);
        assert_error(contract.cancel_event(id), EVENT_CANCELLED);

        vm.set_sender(address(6));
        assert_error(
            contract.transfer_pass(
                pass_id,
                address(7),
                U256::ZERO,
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            EVENT_CANCELLED,
        );
        mock_payment(&vm, address(6), Ok(true_word()));
        assert_error(contract.purchase(id), EVENT_CANCELLED);
        vm.set_sender(address(4));
        assert_error(contract.check_in(id, pass_id), EVENT_CANCELLED);
    }

    #[test]
    fn disabled_transfers_and_emergency_pause_are_enforced() {
        let (vm, mut contract) = setup();
        let id = event_id(1);
        register(&mut contract, id, 1, false, address(4));
        let pass_id = buy(&vm, &mut contract, id, address(6));
        assert_error(
            contract.transfer_pass(
                pass_id,
                address(7),
                U256::ZERO,
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            TRANSFERS_DISABLED,
        );

        vm.set_sender(address(1));
        contract.set_paused(true).unwrap();
        vm.set_sender(address(6));
        assert_error(
            contract.transfer_pass(
                pass_id,
                address(7),
                U256::ZERO,
                150,
                180,
                27,
                B256::ZERO,
                B256::ZERO,
            ),
            PAUSED,
        );
        vm.set_sender(address(4));
        assert_error(contract.check_in(id, pass_id), PAUSED);
        assert!(!contract.is_valid_for_check_in(pass_id));
    }
}

impl MintUpEventPass {
    fn transfer_operation_hash() -> B256 {
        keccak256("TRANSFER_PASS")
    }

    fn create_resale_offer_operation_hash() -> B256 {
        keccak256("CREATE_RESALE_OFFER")
    }

    fn cancel_resale_offer_operation_hash() -> B256 {
        keccak256("CANCEL_RESALE_OFFER")
    }

    fn purchase_resale_operation_hash() -> B256 {
        keccak256("PURCHASE_RESALE")
    }

    fn create_public_resale_listing_operation_hash() -> B256 {
        keccak256("CREATE_PUBLIC_RESALE_LISTING")
    }

    fn cancel_public_resale_listing_operation_hash() -> B256 {
        keccak256("CANCEL_PUBLIC_RESALE_LISTING")
    }

    fn purchase_public_resale_operation_hash() -> B256 {
        keccak256("PURCHASE_PUBLIC_RESALE")
    }

    fn record_authorization(
        &mut self,
        operation: B256,
        caller: Address,
        nonce: U256,
        pass_id: u64,
        recipient: Address,
        amount: U256,
    ) {
        self.used_authorizations.setter(nonce).set(true);
        log(
            self.vm(),
            MintUpAuthorizationUsed {
                operation,
                caller,
                nonce,
                pass_id,
                recipient,
                amount,
            },
        );
    }

    fn strict_usdc_call(&mut self, calldata: &[u8]) -> bool {
        self.entered.set(true);
        let result = self.vm().call(&Call::new(), self.usdc.get(), calldata);
        self.entered.set(false);
        result.is_ok_and(|data| {
            data.len() == 32 && data[..31].iter().all(|byte| *byte == 0) && data[31] == 1
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn validate_authorization(
        &self,
        operation: B256,
        caller: Address,
        pass_id: u64,
        recipient: Address,
        amount: U256,
        nonce: U256,
        issued_at: u64,
        deadline: u64,
        v: u8,
        r: B256,
        s: B256,
    ) -> Result<(), Error> {
        let now = self.vm().block_timestamp();
        if now > deadline {
            return Err(error(AUTHORIZATION_EXPIRED));
        }
        if issued_at > now
            || deadline < issued_at
            || deadline - issued_at > MAX_AUTHORIZATION_LIFETIME
        {
            return Err(error(INVALID_AUTHORIZATION));
        }
        if self.used_authorizations.get(nonce) {
            return Err(error(AUTHORIZATION_USED));
        }
        let digest = self.authorization_digest(
            operation, caller, pass_id, recipient, amount, nonce, issued_at, deadline,
        );
        let recovered =
            ecdsa::recover(self, digest, v, r, s).map_err(|_| error(INVALID_AUTHORIZATION))?;
        if recovered != self.authorization_signer.get() {
            return Err(error(INVALID_AUTHORIZATION));
        }
        Ok(())
    }

    fn only_admin(&self) -> Result<(), Error> {
        if self.vm().msg_sender() != self.administrator.get() {
            return Err(error(UNAUTHORIZED));
        }
        Ok(())
    }

    fn not_paused(&self) -> Result<(), Error> {
        if self.paused.get() {
            return Err(error(PAUSED));
        }
        Ok(())
    }

    fn not_entered(&self) -> Result<(), Error> {
        if self.entered.get() {
            return Err(error(REENTRANCY));
        }
        Ok(())
    }

    fn require_event_live(&self, event_id: B256) -> Result<(), Error> {
        let event = self.events.getter(event_id);
        if !event.exists.get() {
            return Err(error(EVENT_NOT_FOUND));
        }
        if event.cancelled.get() {
            return Err(error(EVENT_CANCELLED));
        }
        Ok(())
    }

    fn event_valid(&self, event_id: B256) -> bool {
        let event = self.events.getter(event_id);
        !self.paused.get() && event.exists.get() && !event.cancelled.get()
    }

    fn require_transferable(&self, token_id: U256) -> Result<(Address, B256), Error> {
        self.not_paused()?;
        let owner = self.erc721.owner_of(token_id)?;
        let pass_id = token_id.to::<u64>();
        let pass = self.passes.getter(U64::from(pass_id));
        if pass.attended.get() {
            return Err(error(PASS_NOT_ACTIVE));
        }
        let event_id = pass.event_id.get();
        drop(pass);
        let event = self.events.getter(event_id);
        if event.cancelled.get() {
            return Err(error(EVENT_CANCELLED));
        }
        if !event.transfers_enabled.get() {
            return Err(error(TRANSFERS_DISABLED));
        }
        Ok((owner, event_id))
    }

    fn require_resale_eligible(&self, pass_id: u64) -> Result<(Address, B256), Error> {
        self.not_paused()?;
        let owner = self
            .erc721
            .owner_of(U256::from(pass_id))
            .map_err(|_| error(PASS_NOT_FOUND))?;
        let pass = self.passes.getter(U64::from(pass_id));
        if pass.attended.get() || pass.refunded.get() {
            return Err(error(RESALE_UNAVAILABLE));
        }
        let event_id = pass.event_id.get();
        drop(pass);
        let event = self.events.getter(event_id);
        if event.cancelled.get()
            || !event.transfers_enabled.get()
            || self.vm().block_timestamp() >= event.funds_release_at.get().to::<u64>()
        {
            return Err(error(RESALE_UNAVAILABLE));
        }
        Ok((owner, event_id))
    }

    fn resale_is_eligible(&self, pass_id: u64, seller: Address) -> bool {
        self.require_resale_eligible(pass_id)
            .is_ok_and(|(owner, _)| owner == seller)
    }

    fn clear_resale_offer(&mut self, pass_id: u64) {
        let mut offer = self.resale_offers.setter(U64::from(pass_id));
        offer.seller.set(Address::ZERO);
        offer.designated_buyer.set(Address::ZERO);
        offer.price.set(U256::ZERO);
        offer.pause_generation.set(U64::ZERO);
    }

    fn clear_public_resale_listing(&mut self, pass_id: u64) {
        let mut listing = self.public_resale_listings.setter(U64::from(pass_id));
        listing.seller.set(Address::ZERO);
        listing.price.set(U256::ZERO);
        listing.pause_generation.set(U64::ZERO);
    }

    fn log_pass_transfer(
        &self,
        token_id: U256,
        previous_owner: Address,
        new_owner: Address,
        event_id: B256,
    ) {
        log(
            self.vm(),
            EventPassTransferred {
                pass_id: token_id.to::<u64>(),
                previous_owner,
                new_owner,
                event_id,
            },
        );
    }
}

fn valid_ipfs_uri(uri: &str) -> bool {
    uri.strip_prefix("ipfs://").is_some_and(|location| {
        let root = location.split('/').next().unwrap_or_default();
        Cid::try_from(root).is_ok() && !location.chars().any(char::is_whitespace)
    })
}

#[cfg(test)]
mod test_host {
    use std::{cell::RefCell, ptr, slice};

    use stylus_sdk::{
        alloy_primitives::Address,
        stylus_core::{host::AccountAccess, ChainAccess, MessageAccess},
        testing::TestVM,
    };

    thread_local! {
        static VM: RefCell<Option<TestVM>> = const { RefCell::new(None) };
        static RETURN_DATA: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    }

    pub fn install(vm: &TestVM) {
        VM.with(|current| *current.borrow_mut() = Some(vm.clone()));
        RETURN_DATA.with(|data| data.borrow_mut().clear());
    }

    #[no_mangle]
    unsafe extern "C" fn msg_sender(destination: *mut u8) {
        VM.with(|current| {
            let sender = current.borrow().as_ref().unwrap().msg_sender();
            ptr::copy_nonoverlapping(sender.as_ptr(), destination, 20);
        });
    }

    #[no_mangle]
    unsafe extern "C" fn chainid() -> u64 {
        VM.with(|current| current.borrow().as_ref().unwrap().chain_id())
    }

    #[no_mangle]
    unsafe extern "C" fn contract_address(destination: *mut u8) {
        VM.with(|current| {
            let address = current.borrow().as_ref().unwrap().contract_address();
            ptr::copy_nonoverlapping(address.as_ptr(), destination, 20);
        });
    }

    #[no_mangle]
    unsafe extern "C" fn emit_log(data: *const u8, len: usize, topics: usize) {
        let bytes = slice::from_raw_parts(data, len);
        VM.with(|current| {
            stylus_sdk::stylus_core::host::LogAccess::emit_log(
                current.borrow().as_ref().unwrap(),
                bytes,
                topics,
            );
        });
    }

    #[no_mangle]
    unsafe extern "C" fn account_code_size(address: *const u8) -> usize {
        let address = Address::from_slice(slice::from_raw_parts(address, 20));
        VM.with(|current| current.borrow().as_ref().unwrap().code_size(address))
    }

    #[no_mangle]
    unsafe extern "C" fn account_codehash(address: *const u8, destination: *mut u8) {
        let address = Address::from_slice(slice::from_raw_parts(address, 20));
        VM.with(|current| {
            let hash = current.borrow().as_ref().unwrap().code_hash(address);
            ptr::copy_nonoverlapping(hash.as_ptr(), destination, 32);
        });
    }

    #[no_mangle]
    unsafe extern "C" fn storage_flush_cache(_clear: bool) {}

    #[no_mangle]
    unsafe extern "C" fn call_contract(
        contract: *const u8,
        calldata: *const u8,
        calldata_len: usize,
        _value: *const u8,
        _gas: u64,
        return_data_len: *mut usize,
    ) -> u8 {
        let contract = Address::from_slice(slice::from_raw_parts(contract, 20));
        let calldata = slice::from_raw_parts(calldata, calldata_len).to_vec();
        let result = VM.with(|current| {
            current
                .borrow()
                .as_ref()
                .unwrap()
                .snapshot()
                .call_returns
                .get(&(contract, calldata))
                .cloned()
                .unwrap_or(Ok(Vec::new()))
        });
        let (status, data) = match result {
            Ok(data) => (0, data),
            Err(data) => (1, data),
        };
        *return_data_len = data.len();
        RETURN_DATA.with(|current| *current.borrow_mut() = data);
        status
    }

    #[no_mangle]
    unsafe extern "C" fn delegate_call_contract(
        _contract: *const u8,
        _calldata: *const u8,
        _calldata_len: usize,
        _gas: u64,
        return_data_len: *mut usize,
    ) -> u8 {
        *return_data_len = 0;
        1
    }

    #[no_mangle]
    unsafe extern "C" fn static_call_contract(
        contract: *const u8,
        calldata: *const u8,
        calldata_len: usize,
        _gas: u64,
        return_data_len: *mut usize,
    ) -> u8 {
        let contract = Address::from_slice(slice::from_raw_parts(contract, 20));
        let calldata = slice::from_raw_parts(calldata, calldata_len).to_vec();
        let result = VM.with(|current| {
            current
                .borrow()
                .as_ref()
                .unwrap()
                .snapshot()
                .static_call_returns
                .get(&(contract, calldata))
                .cloned()
                .unwrap_or_else(|| Ok(vec![0; 32]))
        });
        let (status, data) = match result {
            Ok(data) => (0, data),
            Err(data) => (1, data),
        };
        *return_data_len = data.len();
        RETURN_DATA.with(|current| *current.borrow_mut() = data);
        status
    }

    #[no_mangle]
    unsafe extern "C" fn return_data_size() -> usize {
        RETURN_DATA.with(|data| data.borrow().len())
    }

    #[no_mangle]
    unsafe extern "C" fn read_return_data(
        destination: *mut u8,
        offset: usize,
        size: usize,
    ) -> usize {
        RETURN_DATA.with(|data| {
            let data = data.borrow();
            let available = data.len().saturating_sub(offset).min(size);
            if available != 0 {
                ptr::copy_nonoverlapping(data.as_ptr().add(offset), destination, available);
            }
            available
        })
    }
}

fn transfer_from_data(from: Address, to: Address, amount: u64) -> [u8; 100] {
    transfer_from_data_u256(from, to, U256::from(amount))
}

fn transfer_from_data_u256(from: Address, to: Address, amount: U256) -> [u8; 100] {
    let mut data = [0; 100];
    data[..4].copy_from_slice(&[0x23, 0xb8, 0x72, 0xdd]);
    data[16..36].copy_from_slice(from.as_slice());
    data[48..68].copy_from_slice(to.as_slice());
    data[68..].copy_from_slice(&amount.to_be_bytes::<32>());
    data
}

fn basis_points(amount: U256, bps: u16) -> U256 {
    let denominator = U256::from(10_000);
    let bps = U256::from(bps);
    amount / denominator * bps + amount % denominator * bps / denominator
}

fn transfer_data(to: Address, amount: U256) -> [u8; 68] {
    let mut data = [0; 68];
    data[..4].copy_from_slice(&[0xa9, 0x05, 0x9c, 0xbb]);
    data[16..36].copy_from_slice(to.as_slice());
    data[36..].copy_from_slice(&amount.to_be_bytes::<32>());
    data
}
