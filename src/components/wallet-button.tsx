"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useCallback } from "react";

export function WalletButton() {
  const { address, isConnected } = useAccount();

  const syncWallet = useCallback(async (addr: string) => {
    try {
      await fetch("/api/v1/users/me/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr.toLowerCase() }),
      });
    } catch {
      // Silent fail — wallet sync is best-effort
    }
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      syncWallet(address);
    }
  }, [isConnected, address, syncWallet]);

  return (
    <ConnectButton
      chainStatus="icon"
      accountStatus="avatar"
      showBalance={false}
    />
  );
}
