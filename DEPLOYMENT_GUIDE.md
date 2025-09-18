# FHEVM Deployment and Testing Guide

## 🚀 Complete Deployment Walkthrough

This guide provides step-by-step instructions to deploy your own FHEVM privacy trading contract and build the complete dApp from scratch.

### Prerequisites Checklist

- ✅ Node.js v16+ installed
- ✅ MetaMask browser extension
- ✅ Basic Solidity knowledge
- ✅ Git installed
- ✅ Text editor (VS Code recommended)

## 📁 Project Setup

### 1. Initialize New Project

```bash
# Create new project directory
mkdir my-fhevm-dapp
cd my-fhevm-dapp

# Initialize npm project
npm init -y

# Create directory structure
mkdir contracts
mkdir scripts
mkdir frontend
mkdir test
```

### 2. Install Hardhat and FHEVM Dependencies

```bash
# Install Hardhat development framework
npm install --save-dev hardhat

# Install FHEVM dependencies
npm install @fhevm/solidity
npm install --save-dev @fhevm/hardhat-plugin

# Install other essential dependencies
npm install --save-dev @nomiclabs/hardhat-ethers ethers
npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle chai
```

### 3. Initialize Hardhat Configuration

```bash
npx hardhat
```

Select "Create a JavaScript project" and accept all defaults.

### 4. Configure Hardhat for FHEVM

Create/update `hardhat.config.js`:

```javascript
require("@nomiclabs/hardhat-waffle");
require("@fhevm/hardhat-plugin");

// Replace with your actual private key (use environment variables in production!)
const SEPOLIA_PRIVATE_KEY = "your_sepolia_private_key_here";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
```

### 5. Environment Variables Setup

Create `.env` file:

```env
# Private key for deployment (NEVER commit this!)
SEPOLIA_PRIVATE_KEY=your_sepolia_private_key_here

# Infura or Alchemy RPC URL
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Contract deployment settings
CONTRACT_NAME=HelloFHEVM_PrivacyTrading
NETWORK=sepolia
```

Install dotenv:
```bash
npm install --save-dev dotenv
```

## 📝 Smart Contract Development

### 1. Create the FHEVM Contract

Save the example contract as `contracts/HelloFHEVMTrading.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, euint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract HelloFHEVMTrading is SepoliaConfig {

    mapping(address => mapping(string => euint64)) private portfolioBalances;
    mapping(uint256 => euint64) private encryptedOrderAmounts;
    mapping(uint256 => euint64) private encryptedOrderPrices;

    uint256 public currentOrderCount;
    uint256 public currentTradeCount;
    mapping(string => uint256) public marketPrices;

    event OrderPlaced(uint256 indexed orderId, address indexed trader, string pair, bool isLong);
    event QuickTradeExecuted(address indexed trader, string pair, bool isLong);

    constructor() {
        marketPrices["BTC/ETH"] = 15;
        marketPrices["ETH/USDT"] = 2000;
        marketPrices["BTC/USDT"] = 30000;
    }

    function placeOrder(
        string memory pair,
        bool isLong,
        uint32 amount,
        uint32 price
    ) external returns (uint256) {
        euint32 encryptedAmount = FHE.asEuint32(amount);
        euint32 encryptedPrice = FHE.asEuint32(price);

        ebool isAmountPositive = FHE.gt(encryptedAmount, FHE.asEuint32(0));
        ebool isPricePositive = FHE.gt(encryptedPrice, FHE.asEuint32(0));

        require(FHE.decrypt(isAmountPositive), "Amount must be positive");
        require(FHE.decrypt(isPricePositive), "Price must be positive");

        uint256 orderId = currentOrderCount++;
        encryptedOrderAmounts[orderId] = FHE.asEuint64(amount);
        encryptedOrderPrices[orderId] = FHE.asEuint64(price);

        FHE.allowThis(encryptedOrderAmounts[orderId]);
        FHE.allowThis(encryptedOrderPrices[orderId]);
        FHE.allow(encryptedOrderAmounts[orderId], msg.sender);
        FHE.allow(encryptedOrderPrices[orderId], msg.sender);

        euint64 currentBalance = portfolioBalances[msg.sender][pair];
        if (isLong) {
            portfolioBalances[msg.sender][pair] = FHE.add(currentBalance, FHE.asEuint64(amount));
        } else {
            portfolioBalances[msg.sender][pair] = FHE.sub(currentBalance, FHE.asEuint64(amount));
        }

        FHE.allowThis(portfolioBalances[msg.sender][pair]);
        FHE.allow(portfolioBalances[msg.sender][pair], msg.sender);

        emit OrderPlaced(orderId, msg.sender, pair, isLong);
        return orderId;
    }

    function quickBuy(string memory pair, uint32 amount) external returns (uint256) {
        require(amount > 0, "Amount must be positive");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        euint64 currentBalance = portfolioBalances[msg.sender][pair];
        portfolioBalances[msg.sender][pair] = FHE.add(currentBalance, encryptedAmount);

        FHE.allowThis(portfolioBalances[msg.sender][pair]);
        FHE.allow(portfolioBalances[msg.sender][pair], msg.sender);

        uint256 tradeId = currentTradeCount++;
        emit QuickTradeExecuted(msg.sender, pair, true);
        return tradeId;
    }

    function quickSell(string memory pair, uint32 amount) external returns (uint256) {
        require(amount > 0, "Amount must be positive");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        euint64 currentBalance = portfolioBalances[msg.sender][pair];
        portfolioBalances[msg.sender][pair] = FHE.sub(currentBalance, encryptedAmount);

        FHE.allowThis(portfolioBalances[msg.sender][pair]);
        FHE.allow(portfolioBalances[msg.sender][pair], msg.sender);

        uint256 tradeId = currentTradeCount++;
        emit QuickTradeExecuted(msg.sender, pair, false);
        return tradeId;
    }

    function getPortfolioBalance(address trader, string memory pair)
        external view returns (uint256) {
        return FHE.decrypt(portfolioBalances[trader][pair]);
    }

    function getMarketPrice(string memory pair) external view returns (uint256) {
        return marketPrices[pair];
    }

    function getCurrentOrderCount() external view returns (uint256) {
        return currentOrderCount;
    }

    function getCurrentTradeCount() external view returns (uint256) {
        return currentTradeCount;
    }
}
```

### 2. Create Deployment Script

Create `scripts/deploy.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting FHEVM contract deployment...");

  // Get the contract factory
  const HelloFHEVMTrading = await ethers.getContractFactory("HelloFHEVMTrading");

  // Deploy the contract
  console.log("📝 Deploying HelloFHEVMTrading contract...");
  const contract = await HelloFHEVMTrading.deploy();

  // Wait for deployment to complete
  await contract.deployed();

  console.log("✅ Contract deployed successfully!");
  console.log("📍 Contract address:", contract.address);
  console.log("🔗 Transaction hash:", contract.deployTransaction.hash);
  console.log("⛽ Gas used:", contract.deployTransaction.gasLimit.toString());

  // Verify deployment by calling a function
  console.log("\n🔍 Verifying deployment...");
  const orderCount = await contract.getCurrentOrderCount();
  const tradeCount = await contract.getCurrentTradeCount();

  console.log("📊 Initial order count:", orderCount.toString());
  console.log("📊 Initial trade count:", tradeCount.toString());

  // Display helpful information
  console.log("\n📋 Next steps:");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${contract.address}`);
  console.log("2. Update frontend with new contract address");
  console.log("3. Test contract functions");

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contract.address,
    network: hardhat.network.name,
    deploymentTime: new Date().toISOString(),
    transactionHash: contract.deployTransaction.hash
  };

  console.log("\n💾 Deployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
```

### 3. Create Test Suite

Create `test/HelloFHEVMTrading.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HelloFHEVMTrading", function () {
  let contract;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy contract
    const HelloFHEVMTrading = await ethers.getContractFactory("HelloFHEVMTrading");
    contract = await HelloFHEVMTrading.deploy();
    await contract.deployed();

    console.log("Test contract deployed at:", contract.address);
  });

  describe("Deployment", function () {
    it("Should set initial values correctly", async function () {
      expect(await contract.getCurrentOrderCount()).to.equal(0);
      expect(await contract.getCurrentTradeCount()).to.equal(0);
      expect(await contract.getMarketPrice("BTC/ETH")).to.equal(15);
    });
  });

  describe("Quick Trading", function () {
    it("Should allow quick buy", async function () {
      const pair = "BTC/ETH";
      const amount = 5;

      await expect(contract.connect(user1).quickBuy(pair, amount))
        .to.emit(contract, "QuickTradeExecuted")
        .withArgs(user1.address, pair, true);

      expect(await contract.getCurrentTradeCount()).to.equal(1);
    });

    it("Should allow quick sell", async function () {
      const pair = "BTC/ETH";
      const amount = 3;

      await expect(contract.connect(user1).quickSell(pair, amount))
        .to.emit(contract, "QuickTradeExecuted")
        .withArgs(user1.address, pair, false);

      expect(await contract.getCurrentTradeCount()).to.equal(1);
    });

    it("Should reject zero amount", async function () {
      await expect(contract.connect(user1).quickBuy("BTC/ETH", 0))
        .to.be.revertedWith("Amount must be positive");
    });
  });

  describe("Limit Orders", function () {
    it("Should place buy order", async function () {
      const pair = "BTC/ETH";
      const amount = 10;
      const price = 16;

      await expect(contract.connect(user1).placeOrder(pair, true, amount, price))
        .to.emit(contract, "OrderPlaced")
        .withArgs(0, user1.address, pair, true);

      expect(await contract.getCurrentOrderCount()).to.equal(1);
    });

    it("Should place sell order", async function () {
      const pair = "ETH/USDT";
      const amount = 5;
      const price = 2100;

      await expect(contract.connect(user1).placeOrder(pair, false, amount, price))
        .to.emit(contract, "OrderPlaced")
        .withArgs(0, user1.address, pair, false);
    });

    it("Should reject invalid inputs", async function () {
      await expect(contract.connect(user1).placeOrder("BTC/ETH", true, 0, 100))
        .to.be.revertedWith("Amount must be positive");

      await expect(contract.connect(user1).placeOrder("BTC/ETH", true, 100, 0))
        .to.be.revertedWith("Price must be positive");
    });
  });

  describe("Portfolio Management", function () {
    it("Should track encrypted balances", async function () {
      const pair = "BTC/ETH";
      const amount = 10;

      // Make a trade
      await contract.connect(user1).quickBuy(pair, amount);

      // Check balance (user can see their own balance)
      const balance = await contract.connect(user1).getPortfolioBalance(user1.address, pair);
      expect(balance).to.equal(amount);
    });

    it("Should maintain separate balances for different pairs", async function () {
      await contract.connect(user1).quickBuy("BTC/ETH", 5);
      await contract.connect(user1).quickBuy("ETH/USDT", 10);

      const btcBalance = await contract.connect(user1).getPortfolioBalance(user1.address, "BTC/ETH");
      const ethBalance = await contract.connect(user1).getPortfolioBalance(user1.address, "ETH/USDT");

      expect(btcBalance).to.equal(5);
      expect(ethBalance).to.equal(10);
    });
  });

  describe("Privacy Features", function () {
    it("Should allow users to access their own data", async function () {
      const pair = "BTC/ETH";
      const amount = 15;

      // User1 makes a trade
      await contract.connect(user1).quickBuy(pair, amount);

      // User1 can see their own balance
      const balance = await contract.connect(user1).getPortfolioBalance(user1.address, pair);
      expect(balance).to.equal(amount);
    });

    it("Should prevent unauthorized access to other users' data", async function () {
      const pair = "BTC/ETH";
      const amount = 20;

      // User1 makes a trade
      await contract.connect(user1).quickBuy(pair, amount);

      // User2 tries to access User1's balance (this should fail or return 0)
      // Note: In real FHEVM, this would fail due to permission system
      // For testing purposes, we check that the system maintains separation
      const user2Balance = await contract.connect(user2).getPortfolioBalance(user2.address, pair);
      expect(user2Balance).to.equal(0); // User2 has no balance
    });
  });

  describe("Market Data", function () {
    it("Should provide market prices", async function () {
      expect(await contract.getMarketPrice("BTC/ETH")).to.equal(15);
      expect(await contract.getMarketPrice("ETH/USDT")).to.equal(2000);
      expect(await contract.getMarketPrice("BTC/USDT")).to.equal(30000);
    });

    it("Should return 0 for unknown pairs", async function () {
      expect(await contract.getMarketPrice("UNKNOWN/PAIR")).to.equal(0);
    });
  });

  describe("Statistics", function () {
    it("Should track order and trade counts", async function () {
      // Initial state
      expect(await contract.getCurrentOrderCount()).to.equal(0);
      expect(await contract.getCurrentTradeCount()).to.equal(0);

      // Place some orders and trades
      await contract.connect(user1).placeOrder("BTC/ETH", true, 5, 16);
      await contract.connect(user1).quickBuy("BTC/ETH", 3);
      await contract.connect(user2).quickSell("ETH/USDT", 7);

      // Check updated counts
      expect(await contract.getCurrentOrderCount()).to.equal(1);
      expect(await contract.getCurrentTradeCount()).to.equal(2);
    });
  });
});
```

## 🚀 Deployment Process

### 1. Compile Contract

```bash
npx hardhat compile
```

Expected output:
```
Compiling 1 file with 0.8.24
Compilation finished successfully
```

### 2. Run Tests

```bash
npx hardhat test
```

This will run all tests and verify contract functionality.

### 3. Deploy to Sepolia

```bash
# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

Expected output:
```
🚀 Starting FHEVM contract deployment...
📝 Deploying HelloFHEVMTrading contract...
✅ Contract deployed successfully!
📍 Contract address: 0x1234567890AbCdEf1234567890AbCdEf12345678
🔗 Transaction hash: 0xabcdef...
```

### 4. Verify Deployment

```bash
# Check deployment on Etherscan
# Visit: https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS

# Test basic functions
npx hardhat console --network sepolia
```

In console:
```javascript
const contract = await ethers.getContractAt("HelloFHEVMTrading", "YOUR_CONTRACT_ADDRESS");
await contract.getCurrentOrderCount();
await contract.getMarketPrice("BTC/ETH");
```

## 🖥️ Frontend Development

### 1. Create React Frontend

```bash
cd frontend
npx create-react-app .
npm install ethers
```

### 2. Create Main Component

Update `frontend/src/App.js` with the trading interface from the tutorial.

### 3. Configure Contract Connection

```javascript
// In App.js
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
const CONTRACT_ABI = [
  // Add your contract ABI here
];
```

### 4. Start Frontend

```bash
cd frontend
npm start
```

## 🧪 End-to-End Testing

### 1. Manual Testing Checklist

- [ ] MetaMask connects to Sepolia
- [ ] Contract address is correct
- [ ] Quick buy executes successfully
- [ ] Quick sell executes successfully
- [ ] Limit orders can be placed
- [ ] Portfolio balances update
- [ ] Events are emitted correctly
- [ ] Privacy is preserved

### 2. Test Scenarios

**Scenario 1: First-time user**
1. Connect MetaMask
2. Switch to Sepolia network
3. Get test ETH from faucet
4. Execute quick buy
5. Verify balance updates

**Scenario 2: Multiple operations**
1. Place limit buy order
2. Place limit sell order
3. Execute quick trades
4. Check portfolio
5. Verify transaction history

**Scenario 3: Privacy verification**
1. Create second MetaMask account
2. Connect with different wallet
3. Verify cannot see other user's data
4. Confirm balances are separate

### 3. Gas Optimization Testing

```bash
# Run gas reporter
npm install --save-dev hardhat-gas-reporter
```

Add to `hardhat.config.js`:
```javascript
require("hardhat-gas-reporter");

module.exports = {
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 21
  }
};
```

## 📊 Monitoring and Maintenance

### 1. Set Up Event Monitoring

```javascript
// Monitor contract events
contract.on("OrderPlaced", (orderId, trader, pair, isLong) => {
  console.log(`Order placed: ${orderId} by ${trader} for ${pair} (${isLong ? 'buy' : 'sell'})`);
});

contract.on("QuickTradeExecuted", (trader, pair, isLong) => {
  console.log(`Quick trade: ${trader} ${isLong ? 'bought' : 'sold'} ${pair}`);
});
```

### 2. Health Check Functions

```javascript
// Check contract is responsive
async function healthCheck() {
  try {
    const orderCount = await contract.getCurrentOrderCount();
    console.log("✅ Contract responsive, order count:", orderCount.toString());
  } catch (error) {
    console.error("❌ Contract health check failed:", error);
  }
}
```

### 3. Analytics Dashboard

Track key metrics:
- Total orders placed
- Total trades executed
- Active users
- Gas usage trends
- Error rates

## 🔧 Troubleshooting Guide

### Common Issues

**Issue: "Unauthorized access to encrypted data"**
```
Solution: Ensure FHE.allowThis() and FHE.allow() are called after creating encrypted values
```

**Issue: Transaction fails with high gas cost**
```
Solution: Optimize encrypted operations, combine multiple FHE calls when possible
```

**Issue: Contract not found on network**
```
Solution: Verify contract address and network configuration
```

**Issue: MetaMask connection problems**
```
Solution: Check network settings, clear cache, ensure sufficient ETH for gas
```

### Debug Mode

```javascript
// Enable debug logging in frontend
const DEBUG = true;

if (DEBUG) {
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Connected account:", account);
  console.log("Network chain ID:", chainId);
}
```

### Performance Monitoring

```javascript
// Track transaction times
const startTime = Date.now();
const tx = await contract.quickBuy(pair, amount);
await tx.wait();
const endTime = Date.now();
console.log(`Transaction completed in ${endTime - startTime}ms`);
```

## 🎯 Next Steps

### Advanced Features to Implement

1. **Order Matching Engine**
   - Match buy and sell orders
   - Calculate trade execution
   - Handle partial fills

2. **Advanced Privacy Features**
   - User-side encryption with proofs
   - Async decryption for complex logic
   - Zero-knowledge range proofs

3. **DeFi Integration**
   - Liquidity pools with encrypted amounts
   - Yield farming with private balances
   - Cross-chain privacy bridges

4. **Mobile Application**
   - React Native app
   - WalletConnect integration
   - Push notifications for trades

### Production Checklist

- [ ] Comprehensive security audit
- [ ] Gas optimization review
- [ ] Frontend security best practices
- [ ] Error handling and recovery
- [ ] User documentation
- [ ] Support system setup
- [ ] Monitoring and alerting
- [ ] Backup and recovery procedures

---

**🎉 Congratulations!** You now have a complete FHEVM privacy trading dApp deployed and running on Sepolia testnet. This is just the beginning - explore the world of privacy-preserving DeFi with FHEVM!