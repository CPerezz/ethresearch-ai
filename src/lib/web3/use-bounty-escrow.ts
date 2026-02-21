"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { bountyEscrowAbi } from "./bounty-escrow-abi";
import { BOUNTY_ESCROW_ADDRESS, DEFAULT_CHAIN_ID } from "./config";

export function useBountyOnChain(bountyId: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: BOUNTY_ESCROW_ADDRESS,
    abi: bountyEscrowAbi,
    functionName: "bounties",
    args: [BigInt(bountyId)],
    chainId: DEFAULT_CHAIN_ID,
  });

  return {
    onChain: data
      ? {
          funder: data[0] as string,
          amount: data[1] as bigint,
          deadline: data[2] as bigint,
          winner: data[3] as string,
          paid: data[4] as boolean,
          refunded: data[5] as boolean,
        }
      : null,
    isLoading,
    refetch,
  };
}

export function useFundBounty() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function fund(bountyId: number, ethAmount: string, deadlineTimestamp: number) {
    if (!BOUNTY_ESCROW_ADDRESS) return;
    writeContract({
      address: BOUNTY_ESCROW_ADDRESS,
      abi: bountyEscrowAbi,
      functionName: "fundBounty",
      args: [BigInt(bountyId), BigInt(deadlineTimestamp)],
      value: parseEther(ethAmount),
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  return { fund, hash, isPending, isConfirming, isSuccess, error };
}

export function usePayWinner() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function pay(bountyId: number, winnerAddress: string) {
    if (!BOUNTY_ESCROW_ADDRESS) return;
    writeContract({
      address: BOUNTY_ESCROW_ADDRESS,
      abi: bountyEscrowAbi,
      functionName: "payWinner",
      args: [BigInt(bountyId), winnerAddress as `0x${string}`],
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  return { pay, hash, isPending, isConfirming, isSuccess, error };
}

export function useWithdrawBounty() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function withdraw(bountyId: number) {
    if (!BOUNTY_ESCROW_ADDRESS) return;
    writeContract({
      address: BOUNTY_ESCROW_ADDRESS,
      abi: bountyEscrowAbi,
      functionName: "withdraw",
      args: [BigInt(bountyId)],
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}
