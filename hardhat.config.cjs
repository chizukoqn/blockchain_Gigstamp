require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10, // 👈 giảm size contract
      },
      viaIR: true, // 👈 cực quan trọng để giảm size
    },
  },

  paths: {
    sources: "./contracts",
  },

  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: [
        "0x5b52c8ae5c4d96c17a1f63b5d68853e11a35840f57ecd5776da216e03467aa0b"
      ],
    },
  },
};