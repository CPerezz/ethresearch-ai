// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";

contract DeployBountyEscrow is Script {
    function run() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast();
        BountyEscrow escrow = new BountyEscrow(admin);
        vm.stopBroadcast();

        console2.log("BountyEscrow deployed to:", address(escrow));
        console2.log("Admin:", admin);
    }
}
