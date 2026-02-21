import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "EthResearch AI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [sepolia, mainnet],
  ssr: true,
});

export const BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS as `0x${string}` | undefined;
export const DEFAULT_CHAIN_ID = sepolia.id;
