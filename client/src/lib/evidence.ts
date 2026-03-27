import { ethers } from "ethers";

export type EvidencePayload = {
  version: 1;
  text?: string;
  images?: string[]; // data URLs (base64) - stored locally only
  createdAt: string;
};

export function buildEvidencePayload(text: string, images: string[]): EvidencePayload {
  const normalizedText = text.trim();
  const normalizedImages = images.filter(Boolean);

  const payload: EvidencePayload = {
    version: 1,
    createdAt: new Date().toISOString(),
  };

  if (normalizedText) payload.text = normalizedText;
  if (normalizedImages.length) payload.images = normalizedImages;

  return payload;
}

export function hashEvidencePayload(payload: EvidencePayload): string {
  // Deterministic hash of the JSON payload (keccak256 over UTF-8 bytes).
  // Only the hash is sent on-chain; the raw payload stays in local app state.
  const json = JSON.stringify(payload);
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}

export function jobIdToUint256(jobId: string): bigint {
  const trimmed = jobId.trim();
  if (/^\d+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  // If current UI job ids are non-numeric (nanoid), coerce deterministically
  // into a uint256 value so ethers doesn't throw during BigNumberish parsing.
  // NOTE: This does not guarantee it matches the on-chain job id unless the
  // app is already using the same mapping.
  const hashHex = ethers.keccak256(ethers.toUtf8Bytes(trimmed)); // 0x...
  return BigInt(hashHex);
}

