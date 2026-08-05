#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, Uint, B256, U256},
    alloy_sol_types::sol,
    prelude::*,
    stylus_core::{calls::context::Call, log},
};

const ACTIVE: u8 = 1;
const ATTENDED: u8 = 2;

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

sol! {
    #[derive(Debug)]
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
}

#[derive(SolidityError, Debug)]
pub enum Error {
    MintUpError(MintUpError),
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
        bool exists;
        bool sales_enabled;
        bool transfers_enabled;
        bool cancelled;
    }

    pub struct PassData {
        address owner;
        bool attended;
        bytes32 event_id;
    }

    #[entrypoint]
    pub struct MintUpEventPass {
        address administrator;
        bool paused;
        bool entered;
        uint64 next_pass_id;
        address usdc;
        mapping(bytes32 => EventData) events;
        mapping(uint64 => PassData) passes;
    }
}

#[public]
impl MintUpEventPass {
    #[constructor]
    pub fn constructor(
        &mut self,
        administrator: Address,
        usdc: Address,
        paused: bool,
    ) -> Result<(), Error> {
        if administrator.is_zero() || usdc.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        self.administrator.set(administrator);
        self.usdc.set(usdc);
        self.paused.set(paused);
        self.next_pass_id.set(U64::from(1));
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
        sales_enabled: bool,
        transfers_enabled: bool,
        check_in_operator: Address,
    ) -> Result<(), Error> {
        self.only_admin()?;
        if event_id.is_zero()
            || revenue_recipient.is_zero()
            || check_in_operator.is_zero()
            || price == 0
            || maximum_supply == 0
            || sale_start >= sale_end
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
        event.exists.set(true);
        event.sales_enabled.set(sales_enabled);
        event.transfers_enabled.set(transfers_enabled);
        log(
            self.vm(),
            EventRegistered {
                event_id,
                revenue_recipient,
                check_in_operator,
            },
        );
        Ok(())
    }

    pub fn set_event_sales(&mut self, event_id: B256, enabled: bool) -> Result<(), Error> {
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
        self.only_admin()?;
        self.require_event_live(event_id)?;
        let mut event = self.events.setter(event_id);
        event.cancelled.set(true);
        event.sales_enabled.set(false);
        log(self.vm(), EventCancelled { event_id });
        Ok(())
    }

    pub fn set_paused(&mut self, paused: bool) -> Result<(), Error> {
        self.only_admin()?;
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
        let recipient = event.revenue_recipient.get();
        let price = event.price.get().to::<u64>();
        drop(event);

        let pass_id = self.next_pass_id.get().to::<u64>();
        let next_pass_id = pass_id.checked_add(1).ok_or_else(|| error(ID_OVERFLOW))?;
        let call = transfer_from_data(buyer, recipient, price);
        self.entered.set(true);
        let result = self.vm().call(&Call::new(), self.usdc.get(), &call);
        self.entered.set(false);
        let paid = result.is_ok_and(|data| {
            data.len() == 32 && data[..31].iter().all(|byte| *byte == 0) && data[31] == 1
        });
        if !paid {
            return Err(error(PAYMENT_FAILED));
        }

        self.events
            .setter(event_id)
            .issued_supply
            .set(U32::from(issued_supply + 1));
        self.next_pass_id.set(U64::from(next_pass_id));
        let mut pass = self.passes.setter(U64::from(pass_id));
        pass.owner.set(buyer);
        pass.event_id.set(event_id);
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

    pub fn transfer_pass(&mut self, pass_id: u64, to: Address) -> Result<(), Error> {
        self.not_paused()?;
        if to.is_zero() {
            return Err(error(INVALID_INPUT));
        }
        let sender = self.vm().msg_sender();
        let pass = self.passes.getter(U64::from(pass_id));
        let previous_owner = pass.owner.get();
        if previous_owner.is_zero() {
            return Err(error(PASS_NOT_FOUND));
        }
        if previous_owner != sender {
            return Err(error(NOT_PASS_OWNER));
        }
        if to == previous_owner {
            return Err(error(INVALID_INPUT));
        }
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
        drop(event);

        self.passes.setter(U64::from(pass_id)).owner.set(to);
        log(
            self.vm(),
            EventPassTransferred {
                pass_id,
                previous_owner,
                new_owner: to,
                event_id,
            },
        );
        Ok(())
    }

    pub fn check_in(&mut self, event_id: B256, pass_id: u64) -> Result<(), Error> {
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
        let attendee = pass.owner.get();
        if attendee.is_zero() {
            return Err(error(PASS_NOT_FOUND));
        }
        if pass.event_id.get() != event_id {
            return Err(error(WRONG_EVENT));
        }
        if pass.attended.get() {
            return Err(error(PASS_NOT_ACTIVE));
        }
        drop(pass);

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

    pub fn config(&self) -> (Address, Address, bool) {
        (self.administrator.get(), self.usdc.get(), self.paused.get())
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
        let owner = pass.owner.get();
        if owner.is_zero() {
            return Err(error(PASS_NOT_FOUND));
        }
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
        let active = !pass.owner.get().is_zero() && !pass.attended.get();
        drop(pass);
        active && self.event_valid(event_id)
    }
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
    use stylus_sdk::testing::TestVM;

    const START: u64 = 100;
    const END: u64 = 200;
    const PRICE: u64 = 25_000_000;

    fn address(byte: u8) -> Address {
        Address::from([byte; 20])
    }

    fn event_id(byte: u8) -> B256 {
        B256::from([byte; 32])
    }

    fn setup() -> (TestVM, MintUpEventPass) {
        let vm = TestVM::default();
        vm.set_sender(address(1));
        let mut contract = MintUpEventPass::from(&vm);
        contract.constructor(address(1), address(2), false).unwrap();
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
                true,
                transfers,
                operator,
            )
            .unwrap();
    }

    fn payment_data(buyer: Address) -> Vec<u8> {
        transfer_from_data(buyer, address(3), PRICE).to_vec()
    }

    fn mock_payment(vm: &TestVM, buyer: Address, response: Result<Vec<u8>, Vec<u8>>) {
        vm.mock_call(address(2), payment_data(buyer), response);
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

    #[test]
    fn constructor_and_event_administration_are_restricted() {
        let (vm, mut contract) = setup();
        assert_eq!(contract.config(), (address(1), address(2), false));

        vm.set_sender(address(9));
        assert_error(
            contract.register_event(
                event_id(1),
                address(3),
                PRICE,
                1,
                START,
                END,
                true,
                true,
                address(4),
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
                true,
                true,
                address(4),
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
                true,
                true,
                address(4),
            ),
            INVALID_INPUT,
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

        vm.set_sender(address(8));
        vm.set_block_timestamp(150);
        mock_payment(&vm, address(8), Ok(true_word()));
        assert_error(contract.purchase(second_event), SOLD_OUT);
    }

    #[test]
    fn failed_usdc_responses_never_issue() {
        for response in [Ok(vec![0; 32]), Ok(vec![1]), Err(vec![0xff])] {
            let (vm, mut contract) = setup();
            let id = event_id(1);
            register(&mut contract, id, 1, true, address(4));
            vm.set_sender(address(6));
            vm.set_block_timestamp(150);
            mock_payment(&vm, address(6), response);

            assert_error(contract.purchase(id), PAYMENT_FAILED);
            assert_eq!(contract.event_info(id).unwrap().3, 0);
            assert_error(contract.pass_info(1), PASS_NOT_FOUND);
        }
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
        assert_error(contract.transfer_pass(pass_id, address(8)), NOT_PASS_OWNER);
        vm.set_sender(address(6));
        contract.transfer_pass(pass_id, address(7)).unwrap();
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
        assert_error(contract.transfer_pass(pass_id, address(8)), PASS_NOT_ACTIVE);
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
        assert_error(contract.transfer_pass(pass_id, address(7)), EVENT_CANCELLED);
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
            contract.transfer_pass(pass_id, address(7)),
            TRANSFERS_DISABLED,
        );

        vm.set_sender(address(1));
        contract.set_paused(true).unwrap();
        vm.set_sender(address(6));
        assert_error(contract.transfer_pass(pass_id, address(7)), PAUSED);
        vm.set_sender(address(4));
        assert_error(contract.check_in(id, pass_id), PAUSED);
        assert!(!contract.is_valid_for_check_in(pass_id));
    }
}

impl MintUpEventPass {
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
}

fn transfer_from_data(from: Address, to: Address, amount: u64) -> [u8; 100] {
    let mut data = [0; 100];
    data[..4].copy_from_slice(&[0x23, 0xb8, 0x72, 0xdd]);
    data[16..36].copy_from_slice(from.as_slice());
    data[48..68].copy_from_slice(to.as_slice());
    data[68..].copy_from_slice(&U256::from(amount).to_be_bytes::<32>());
    data
}
