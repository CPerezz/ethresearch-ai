// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";

contract BountyEscrowTest is Test {
    BountyEscrow public escrow;
    address public admin = makeAddr("admin");
    address public funder = makeAddr("funder");
    address public winner = makeAddr("winner");
    address public other = makeAddr("other");

    uint256 constant BOUNTY_ID = 42;
    uint256 constant AMOUNT = 1 ether;

    function setUp() public {
        escrow = new BountyEscrow(admin);
        vm.deal(funder, 10 ether);
        vm.deal(admin, 10 ether);
    }

    function test_constructor_setsAdmin() public view {
        assertEq(escrow.admin(), admin);
    }

    function test_constructor_revertZeroAddress() public {
        vm.expectRevert(BountyEscrow.ZeroAddress.selector);
        new BountyEscrow(address(0));
    }

    function test_fundBounty_success() public {
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);

        (address f, uint256 a, uint256 d, address w, bool p, bool r) = escrow.bounties(BOUNTY_ID);
        assertEq(f, funder);
        assertEq(a, AMOUNT);
        assertEq(d, deadline);
        assertEq(w, address(0));
        assertFalse(p);
        assertFalse(r);
    }

    function test_fundBounty_emitsEvent() public {
        uint256 deadline = block.timestamp + 7 days;
        vm.expectEmit(true, true, false, true);
        emit BountyEscrow.BountyFunded(BOUNTY_ID, funder, AMOUNT, deadline);
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);
    }

    function test_fundBounty_revertNoValue() public {
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NoValueSent.selector);
        escrow.fundBounty{value: 0}(BOUNTY_ID, block.timestamp + 7 days);
    }

    function test_fundBounty_revertAlreadyFunded() public {
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);

        vm.prank(other);
        vm.deal(other, 1 ether);
        vm.expectRevert(BountyEscrow.BountyAlreadyFunded.selector);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);
    }

    function test_fundBounty_revertDeadlineTooSoon() public {
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineOutOfRange.selector);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, block.timestamp + 1 hours);
    }

    function test_fundBounty_revertDeadlineTooFar() public {
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineOutOfRange.selector);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, block.timestamp + 91 days);
    }

    function test_payWinner_byFunder() public {
        _fundBounty();
        uint256 balBefore = winner.balance;

        vm.prank(funder);
        escrow.payWinner(BOUNTY_ID, winner);

        assertEq(winner.balance, balBefore + AMOUNT);
        (, , , address w, bool p,) = escrow.bounties(BOUNTY_ID);
        assertEq(w, winner);
        assertTrue(p);
    }

    function test_payWinner_byAdmin() public {
        _fundBounty();

        vm.prank(admin);
        escrow.payWinner(BOUNTY_ID, winner);

        (, , , address w, bool p,) = escrow.bounties(BOUNTY_ID);
        assertEq(w, winner);
        assertTrue(p);
    }

    function test_payWinner_revertNotFunderOrAdmin() public {
        _fundBounty();
        vm.prank(other);
        vm.expectRevert(BountyEscrow.NotFunder.selector);
        escrow.payWinner(BOUNTY_ID, winner);
    }

    function test_payWinner_revertAlreadyPaid() public {
        _fundBounty();
        vm.prank(funder);
        escrow.payWinner(BOUNTY_ID, winner);

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.BountyAlreadySettled.selector);
        escrow.payWinner(BOUNTY_ID, winner);
    }

    function test_payWinner_revertAfterDeadline() public {
        _fundBounty();
        vm.warp(block.timestamp + 8 days);

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineReached.selector);
        escrow.payWinner(BOUNTY_ID, winner);
    }

    function test_payWinner_revertZeroAddress() public {
        _fundBounty();
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.ZeroAddress.selector);
        escrow.payWinner(BOUNTY_ID, address(0));
    }

    function test_withdraw_afterDeadline() public {
        _fundBounty();
        vm.warp(block.timestamp + 8 days);

        uint256 balBefore = funder.balance;
        vm.prank(funder);
        escrow.withdraw(BOUNTY_ID);

        assertEq(funder.balance, balBefore + AMOUNT);
        (, , , , , bool r) = escrow.bounties(BOUNTY_ID);
        assertTrue(r);
    }

    function test_withdraw_revertBeforeDeadline() public {
        _fundBounty();
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineNotReached.selector);
        escrow.withdraw(BOUNTY_ID);
    }

    function test_withdraw_revertNotFunder() public {
        _fundBounty();
        vm.warp(block.timestamp + 8 days);
        vm.prank(other);
        vm.expectRevert(BountyEscrow.NotFunder.selector);
        escrow.withdraw(BOUNTY_ID);
    }

    function test_adminPay_split() public {
        _fundBounty();
        address[] memory recipients = new address[](2);
        recipients[0] = winner;
        recipients[1] = other;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.6 ether;
        amounts[1] = 0.4 ether;

        vm.prank(admin);
        escrow.adminPay(BOUNTY_ID, recipients, amounts);

        assertEq(winner.balance, 0.6 ether);
        assertEq(other.balance, 0.4 ether);
        (, , , , bool p,) = escrow.bounties(BOUNTY_ID);
        assertTrue(p);
    }

    function test_adminPay_revertNotAdmin() public {
        _fundBounty();
        address[] memory r = new address[](1);
        r[0] = winner;
        uint256[] memory a = new uint256[](1);
        a[0] = AMOUNT;

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NotAdmin.selector);
        escrow.adminPay(BOUNTY_ID, r, a);
    }

    function test_adminPay_revertAmountMismatch() public {
        _fundBounty();
        address[] memory r = new address[](1);
        r[0] = winner;
        uint256[] memory a = new uint256[](1);
        a[0] = 0.5 ether;

        vm.prank(admin);
        vm.expectRevert(BountyEscrow.AmountMismatch.selector);
        escrow.adminPay(BOUNTY_ID, r, a);
    }

    function test_adminRefund_success() public {
        _fundBounty();
        uint256 balBefore = funder.balance;

        vm.prank(admin);
        escrow.adminRefund(BOUNTY_ID);

        assertEq(funder.balance, balBefore + AMOUNT);
    }

    function test_adminRefund_revertNotAdmin() public {
        _fundBounty();
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NotAdmin.selector);
        escrow.adminRefund(BOUNTY_ID);
    }

    function test_getBounties_batch() public {
        _fundBounty();
        uint256 deadline2 = block.timestamp + 14 days;
        vm.prank(funder);
        escrow.fundBounty{value: 0.5 ether}(99, deadline2);

        uint256[] memory ids = new uint256[](2);
        ids[0] = BOUNTY_ID;
        ids[1] = 99;
        BountyEscrow.Bounty[] memory result = escrow.getBounties(ids);

        assertEq(result.length, 2);
        assertEq(result[0].amount, AMOUNT);
        assertEq(result[1].amount, 0.5 ether);
    }

    function test_transferAdmin_twoStep() public {
        vm.prank(admin);
        escrow.transferAdmin(other);
        assertEq(escrow.pendingAdmin(), other);
        assertEq(escrow.admin(), admin);

        vm.prank(other);
        escrow.acceptAdmin();
        assertEq(escrow.admin(), other);
        assertEq(escrow.pendingAdmin(), address(0));
    }

    function test_acceptAdmin_revertNotPending() public {
        vm.prank(admin);
        escrow.transferAdmin(other);

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NotPendingAdmin.selector);
        escrow.acceptAdmin();
    }

    function _fundBounty() internal {
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);
    }
}
