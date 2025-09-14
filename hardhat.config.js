require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      // Fork mainnet for testing with real contracts
      // forking: {
      //   url: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
      // },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78`,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
      gas: 8000000,
      // Zama FHE Contract addresses for Sepolia
      fhevm: {
        executor: "0x848B0066793BcC60346Da1F49049357399B8D595",
        acl: "0x687820221192C5B662b25367F70076A37bc79b6c",
        hcuLimit: "0x594BB474275918AF9609814E68C61B1587c5F838",
        kmsVerifier: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
        inputVerifier: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
        decryptionOracle: "0xa02Cda4Ca3a71D7C46997716F4283aa851C28812",
        decryptionAddress: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
        inputVerificationAddress: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
        relayerUrl: "https://relayer.testnet.zama.cloud"
      }
    },
    zama_devnet: {
      url: "https://devnet.zama.ai",
      chainId: 8009,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      // Add your Etherscan API key here for contract verification
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};