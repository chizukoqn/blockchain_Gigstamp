import { getContract as getContractFromContractJs } from "./contract";

declare global {
  interface Window {
    ethereum?: any;
  }
}

let cachedAccount: string | null = null;

export const connectWallet = async (): Promise<string | null> => {
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return null;
  }

  try {
    // Support Sepolia + common local Ganache chain IDs.
    // Sepolia chainId = 11155111 = 0xaa36a7
    // Ganache chainId can be 1337 (0x539) or 5777 (0x1691) depending on setup.
    const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
    const GANACHE_CHAIN_ID_HEX = "0x539";
    const GANACHE_ALT_CHAIN_ID_HEX = "0x1691";
    const currentChainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    const normalizedChainId = String(currentChainId).toLowerCase();
    const isSepolia = normalizedChainId === SEPOLIA_CHAIN_ID_HEX.toLowerCase();
    const isGanache = normalizedChainId === GANACHE_CHAIN_ID_HEX.toLowerCase();
    const isGanacheAlt =
      normalizedChainId === GANACHE_ALT_CHAIN_ID_HEX.toLowerCase();

    // Only allow known networks. Do not auto-switch networks here.
    if (!isSepolia && !isGanache && !isGanacheAlt) {
      alert(
        `Unsupported network (${normalizedChainId}). Please switch MetaMask to Sepolia (11155111) or Ganache (1337/5777).`
      );
      return null;
    }

    // Avoid repeated MetaMask popups: check existing connections first.
    const existingAccounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    if (Array.isArray(existingAccounts) && existingAccounts.length > 0) {
      cachedAccount = existingAccounts[0];
      return cachedAccount;
    }

    const requestedAccounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    cachedAccount =
      Array.isArray(requestedAccounts) && requestedAccounts.length > 0
        ? requestedAccounts[0]
        : null;
    return cachedAccount;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const getContract = async () => {
  // Keep connectWallet() for the UI, but delegate contract creation to the
  // dedicated helper that uses injected ABI/address.
  if (!cachedAccount) {
    cachedAccount = await connectWallet();
  }

  try {
    return await getContractFromContractJs();
  } catch (err) {
    console.error(err);
    return null;
  }
};