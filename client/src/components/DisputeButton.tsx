import { getContract } from "@/lib/blockchain";

// Helper (not a page): can be used by other UI blocks if needed.
export async function raiseDispute(
  jobId: bigint,
  evidenceHash: string
): Promise<void> {
  const contract = await getContract();
  if (!contract) throw new Error("Contract unavailable");

  const tx = await contract.raiseDispute(jobId, evidenceHash);
  await tx.wait();
}