export const bountyEscrowAbi = [
  {
    type: "function",
    name: "fundBounty",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "payWinner",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "bounties",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "funder", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "paid", type: "bool" },
      { name: "refunded", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBounties",
    inputs: [{ name: "bountyIds", type: "uint256[]" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "funder", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "winner", type: "address" },
          { name: "paid", type: "bool" },
          { name: "refunded", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
