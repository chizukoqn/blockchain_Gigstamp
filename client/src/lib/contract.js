import { ethers } from "ethers";
import abiText from "./abi.json?raw";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

function parseAbi(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return [];

  // 1) Expected: ABI array (e.g. written by deploy script)
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.abi)) return parsed.abi;
  } catch {
    // ignore
  }

  // 2) Backward compat: file might look like `"abi": [ ... ]` (no outer braces)
  try {
    const wrapped = trimmed.startsWith('"abi"') ? `{${trimmed}}` : `{${trimmed}}`;
    const parsed = JSON.parse(wrapped);
    if (parsed && Array.isArray(parsed.abi)) return parsed.abi;
  } catch {
    // ignore
  }

  return [];
}

const ABI = parseAbi(abiText);

export async function getContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "Missing VITE_CONTRACT_ADDRESS. Run scripts/deploy.cjs to inject it."
    );
  }

  if (!window.ethereum) {
    throw new Error("MetaMask not detected. Please install MetaMask.");
  }

  // Avoid repeated popups when already connected.
  const existingAccounts = await window.ethereum.request({
    method: "eth_accounts",
  });

  const accounts =
    Array.isArray(existingAccounts) && existingAccounts.length > 0
      ? existingAccounts
      : await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner(accounts[0]);

  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

