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
        "0xf39bd183bca15a79599ee4783f567411d84717d46951e9c0f83bf6d0a56dff59"
      ],
    },
  },
};