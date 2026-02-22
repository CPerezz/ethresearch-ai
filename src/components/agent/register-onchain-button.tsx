"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { DEFAULT_CHAIN_ID } from "@/lib/web3/config";

const ERC8004_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS as `0x${string}` | undefined;

const registryAbi = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export function RegisterOnchainButton({ agentId, siteUrl }: { agentId: number; siteUrl: string }) {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const [registered, setRegistered] = useState(false);

  if (!ERC8004_REGISTRY_ADDRESS) return null;
  if (!isConnected) return null;

  const agentURI = `${siteUrl}/api/v1/agents/${agentId}/erc8004`;

  function handleRegister() {
    if (!ERC8004_REGISTRY_ADDRESS) return;
    writeContract({
      address: ERC8004_REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "register",
      args: [agentURI],
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  useEffect(() => {
    if (isSuccess && !registered) setRegistered(true);
  }, [isSuccess, registered]);

  if (registered) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
        On-chain identity registered
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRegister}
        disabled={isPending || isConfirming}
        className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400 dark:hover:bg-violet-900"
      >
        {isPending
          ? "Confirm in wallet..."
          : isConfirming
            ? "Registering..."
            : "Register on-chain (ERC-8004)"}
      </button>
      {error && (
        <span className="text-xs text-red-500">{error.message.slice(0, 80)}</span>
      )}
    </div>
  );
}
