// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BountyEscrow is ReentrancyGuard {
    struct Bounty {
        address funder;
        uint256 amount;
        uint256 deadline;
        address winner;
        bool paid;
        bool refunded;
    }

    mapping(uint256 => Bounty) public bounties;
    address public admin;
    address public pendingAdmin;

    uint256 public constant MIN_DEADLINE_OFFSET = 1 days;
    uint256 public constant MAX_DEADLINE_OFFSET = 90 days;

    event BountyFunded(uint256 indexed bountyId, address indexed funder, uint256 amount, uint256 deadline);
    event BountyPaid(uint256 indexed bountyId, address indexed winner, uint256 amount);
    event BountySplit(uint256 indexed bountyId, address[] recipients, uint256[] amounts);
    event BountyRefunded(uint256 indexed bountyId, address indexed funder, uint256 amount);
    event AdminTransferProposed(address indexed newAdmin);
    event AdminTransferAccepted(address indexed newAdmin);

    error NotAdmin();
    error NotFunder();
    error BountyAlreadyFunded();
    error BountyNotFunded();
    error BountyAlreadySettled();
    error DeadlineOutOfRange();
    error DeadlineNotReached();
    error DeadlineReached();
    error NoValueSent();
    error InvalidRecipients();
    error AmountMismatch();
    error TransferFailed();
    error NotPendingAdmin();
    error ZeroAddress();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
    }

    function fundBounty(uint256 bountyId, uint256 deadline) external payable {
        if (msg.value == 0) revert NoValueSent();
        Bounty storage b = bounties[bountyId];
        if (b.funder != address(0)) revert BountyAlreadyFunded();
        if (deadline < block.timestamp + MIN_DEADLINE_OFFSET) revert DeadlineOutOfRange();
        if (deadline > block.timestamp + MAX_DEADLINE_OFFSET) revert DeadlineOutOfRange();

        b.funder = msg.sender;
        b.amount = msg.value;
        b.deadline = deadline;

        emit BountyFunded(bountyId, msg.sender, msg.value, deadline);
    }

    function payWinner(uint256 bountyId, address winner) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();
        if (msg.sender != b.funder && msg.sender != admin) revert NotFunder();
        if (winner == address(0)) revert ZeroAddress();
        if (block.timestamp > b.deadline) revert DeadlineReached();

        b.winner = winner;
        b.paid = true;

        (bool ok,) = winner.call{value: b.amount}("");
        if (!ok) revert TransferFailed();

        emit BountyPaid(bountyId, winner, b.amount);
    }

    function withdraw(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();
        if (msg.sender != b.funder) revert NotFunder();
        if (block.timestamp <= b.deadline) revert DeadlineNotReached();

        b.refunded = true;

        (bool ok,) = b.funder.call{value: b.amount}("");
        if (!ok) revert TransferFailed();

        emit BountyRefunded(bountyId, b.funder, b.amount);
    }

    function adminPay(uint256 bountyId, address[] calldata recipients, uint256[] calldata amounts)
        external
        nonReentrant
        onlyAdmin
    {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();
        if (recipients.length == 0 || recipients.length != amounts.length) revert InvalidRecipients();

        uint256 total;
        for (uint256 i; i < amounts.length; ++i) {
            total += amounts[i];
        }
        if (total != b.amount) revert AmountMismatch();

        b.paid = true;
        b.winner = recipients[0];

        for (uint256 i; i < recipients.length; ++i) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            (bool ok,) = recipients[i].call{value: amounts[i]}("");
            if (!ok) revert TransferFailed();
        }

        emit BountySplit(bountyId, recipients, amounts);
    }

    function adminRefund(uint256 bountyId) external nonReentrant onlyAdmin {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();

        b.refunded = true;

        (bool ok,) = b.funder.call{value: b.amount}("");
        if (!ok) revert TransferFailed();

        emit BountyRefunded(bountyId, b.funder, b.amount);
    }

    function getBounties(uint256[] calldata bountyIds) external view returns (Bounty[] memory) {
        Bounty[] memory result = new Bounty[](bountyIds.length);
        for (uint256 i; i < bountyIds.length; ++i) {
            result[i] = bounties[bountyIds[i]];
        }
        return result;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferProposed(newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferAccepted(msg.sender);
    }
}
