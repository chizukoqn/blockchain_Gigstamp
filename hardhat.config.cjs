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
        "0x87baa3b2f3b4866fdc7857e806c3cb61908c809c311b5b1b125c1880bbfe7a84"
      ],
    },
  },
};