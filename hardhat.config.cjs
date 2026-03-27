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
        "0x835ca1112dcdb04bc94c76626b3d0dbc48dba48f39a78142ab10a2b15d7e9ea0"
      ],
    },
  },
};