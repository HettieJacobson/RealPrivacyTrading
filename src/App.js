import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Contract configuration
const CONTRACT_ADDRESS = "0x7eA6E43F5131c69536fd97e9Ea267eA14B20061b"; // Privacy Asset Trading Contract
const CONTRACT_ABI = [
  "function placeOrder(string memory pair, bool isLong, uint32 amount, uint32 price) external returns (uint256)",
  "function quickBuy(string memory pair, uint32 amount) external returns (uint256)",
  "function quickSell(string memory pair, uint32 amount) external returns (uint256)",
  "function getOrderInfo(uint256 orderId) external view returns (address, string, bool, bool, bool, uint256)",
  "function getOrderData(uint256 orderId) external view returns (uint256, uint256)",
  "function getPortfolioBalance(address trader, string memory pair) external view returns (uint256)",
  "function getMarketPrice(string memory pair) external view returns (uint256)",
  "function getCurrentOrderCount() external view returns (uint256)",
  "function getCurrentTradeCount() external view returns (uint256)",
  "event OrderPlaced(uint256 indexed orderId, address indexed trader, string pair, bool isLong)",
  "event TradeExecuted(uint256 indexed tradeId, address indexed buyer, address indexed seller, string pair)",
  "event QuickTradeExecuted(address indexed trader, string pair, bool isLong)"
];

function App() {
  // State variables
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Connect wallet to start private trading on Sepolia!');
  const [selectedPair, setSelectedPair] = useState('BTC/ETH');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [marketPrices, setMarketPrices] = useState({});
  const [portfolioBalances, setPortfolioBalances] = useState({});
  const [stats, setStats] = useState({ orders: 0, trades: 0 });

  const availablePairs = ['BTC/ETH', 'ETH/USDT', 'BTC/USDT'];

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      setLoading(true);
      setMessage('Connecting to MetaMask...');

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Check/switch to Sepolia network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') { // Sepolia chain ID
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia Test Network',
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io/']
              }]
            });
          }
        }
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAccount(accounts[0]);
      setContract(contractInstance);
      setMessage('Connected to Sepolia! Ready for private trading ✅');
      
      // Load trading data
      await loadTradingData(contractInstance, accounts[0]);
      
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setMessage('Wallet connection failed ❌');
    } finally {
      setLoading(false);
    }
  };

  // Load trading data
  const loadTradingData = async (contractInstance, userAccount) => {
    if (!contractInstance) return;

    try {
      // Load market prices
      const prices = {};
      for (const pair of availablePairs) {
        try {
          const price = await contractInstance.getMarketPrice(pair);
          prices[pair] = ethers.formatUnits(price, 0);
        } catch (error) {
          console.log(`Price for ${pair} not available`);
          prices[pair] = 'N/A';
        }
      }
      setMarketPrices(prices);

      // Load portfolio balances
      const balances = {};
      for (const pair of availablePairs) {
        try {
          const balance = await contractInstance.getPortfolioBalance(userAccount, pair);
          balances[pair] = ethers.formatUnits(balance, 0);
        } catch (error) {
          balances[pair] = '0';
        }
      }
      setPortfolioBalances(balances);

      // Load stats
      const orderCount = await contractInstance.getCurrentOrderCount();
      const tradeCount = await contractInstance.getCurrentTradeCount();
      setStats({
        orders: Number(orderCount),
        trades: Number(tradeCount)
      });

    } catch (error) {
      console.error('Failed to load trading data:', error);
    }
  };

  // Place limit order
  const placeOrder = async (isLong) => {
    if (!contract) {
      setMessage('Please connect your wallet first!');
      return;
    }

    // Get current values and validate
    const currentAmount = tradeAmount?.trim();
    const currentPrice = tradePrice?.trim();

    if (!currentAmount || !currentPrice) {
      setMessage('Please enter both amount and price!');
      return;
    }

    const amount = parseFloat(currentAmount);
    const price = parseFloat(currentPrice);

    if (amount <= 0 || isNaN(amount) || amount < 1) {
      setMessage('Amount must be at least 1!');
      return;
    }

    if (price <= 0 || isNaN(price) || price < 1) {
      setMessage('Price must be at least 1!');
      return;
    }

    const finalAmount = Math.floor(amount);
    const finalPrice = Math.floor(price);

    if (finalAmount === 0) {
      setMessage('Amount too small! Must be at least 1.');
      return;
    }

    if (finalPrice === 0) {
      setMessage('Price too small! Must be at least 1.');
      return;
    }

    try {
      setLoading(true);
      setMessage(`Placing ${isLong ? 'buy' : 'sell'} order on blockchain...`);
      
      console.log('Calling placeOrder with:', {
        pair: selectedPair,
        isLong: isLong,
        amount: finalAmount,
        price: finalPrice
      });
      
      const tx = await contract.placeOrder(
        selectedPair,
        isLong,
        finalAmount,
        finalPrice
      );
      setMessage('Transaction sent! Waiting for confirmation...');
      
      await tx.wait();
      
      setMessage(`${isLong ? 'Buy' : 'Sell'} order placed successfully! 🎯`);
      setTradeAmount('');
      setTradePrice('');
      await loadTradingData(contract, account);
      
    } catch (error) {
      console.error('Place order failed:', error);
      
      // Better error messages
      if (error.message.includes('Amount must be positive')) {
        setMessage('❌ Error: Amount must be positive. Please check your input.');
      } else if (error.message.includes('user rejected')) {
        setMessage('❌ Transaction cancelled by user.');
      } else if (error.message.includes('insufficient funds')) {
        setMessage('❌ Insufficient ETH for transaction fees.');
      } else {
        setMessage(`❌ Transaction failed: ${error.reason || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick buy/sell at market price
  const quickTrade = async (isLong) => {
    if (!contract) {
      setMessage('Please connect your wallet first!');
      return;
    }

    // Get current value and validate
    const currentAmount = tradeAmount?.trim();

    if (!currentAmount) {
      setMessage('Please enter trade amount!');
      return;
    }

    const amount = parseFloat(currentAmount);

    if (amount <= 0 || isNaN(amount) || amount < 1) {
      setMessage('Amount must be at least 1!');
      return;
    }

    const finalAmount = Math.floor(amount);

    if (finalAmount === 0) {
      setMessage('Amount too small! Must be at least 1.');
      return;
    }

    try {
      setLoading(true);
      setMessage(`Executing ${isLong ? 'quick buy' : 'quick sell'} on blockchain...`);
      
      console.log('Calling quickTrade with:', {
        pair: selectedPair,
        isLong: isLong,
        amount: finalAmount
      });
      
      const tx = isLong 
        ? await contract.quickBuy(selectedPair, finalAmount)
        : await contract.quickSell(selectedPair, finalAmount);
      
      setMessage('Transaction sent! Waiting for confirmation...');
      
      await tx.wait();
      
      setMessage(`${isLong ? 'Quick buy' : 'Quick sell'} executed successfully! ⚡`);
      setTradeAmount('');
      await loadTradingData(contract, account);
      
    } catch (error) {
      console.error('Quick trade failed:', error);
      
      // Better error messages
      if (error.message.includes('Amount must be positive')) {
        setMessage('❌ Error: Amount must be positive. Please check your input.');
      } else if (error.message.includes('user rejected')) {
        setMessage('❌ Transaction cancelled by user.');
      } else if (error.message.includes('insufficient funds')) {
        setMessage('❌ Insufficient ETH for transaction fees.');
      } else {
        setMessage(`❌ Quick trade failed: ${error.reason || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh data
  useEffect(() => {
    if (contract && account) {
      const interval = setInterval(() => {
        loadTradingData(contract, account);
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [contract, account]);

  return (
    <div className="App">
      <header className="App-header">
        <div className="hero-section">
          <div className="hero-background"></div>
          <div className="container">
            <h1 className="logo">🔐 Privacy Asset Trading</h1>
            <p className="subtitle">Live on Sepolia Testnet</p>
            <p className="description">
              Real blockchain deployment using Zama's FHE technology for private trading with encrypted volumes and prices
            </p>
            
            {/* Blockchain Connection Status */}
            {contract && (
              <div style={{ 
                background: 'rgba(0,255,0,0.1)', 
                padding: '15px', 
                margin: '20px 0', 
                border: '1px solid #00ff00', 
                borderRadius: '8px' 
              }}>
                <p><strong>✅ CONNECTED TO SEPOLIA</strong></p>
                <p>Contract: <span style={{color: '#00ff00'}}>{CONTRACT_ADDRESS}</span></p>
                <p>Wallet: <span style={{color: '#00ff00'}}>{account?.slice(0,6)}...{account?.slice(-4)}</span></p>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div style={{ 
                background: 'rgba(255,255,255,0.1)', 
                padding: '10px', 
                margin: '10px 0', 
                borderRadius: '5px' 
              }}>
                <p>{message}</p>
              </div>
            )}

            {/* Trading Interface */}
            {account ? (
              <div className="features-grid">
                {/* Trading Panel */}
                <div className="feature-card gradient-border card-hover" style={{minWidth: '300px'}}>
                  <h3>📈 Trade Assets</h3>
                  
                  <select 
                    value={selectedPair} 
                    onChange={(e) => setSelectedPair(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      margin: '10px 0',
                      background: '#1a1a2e',
                      color: 'white',
                      border: '1px solid #333',
                      borderRadius: '4px'
                    }}
                  >
                    {availablePairs.map(pair => (
                      <option key={pair} value={pair}>{pair}</option>
                    ))}
                  </select>

                  <p>Market Price: <span style={{color: '#00ff00'}}>{marketPrices[selectedPair] || 'Loading...'}</span></p>

                  <input
                    type="number"
                    placeholder="Amount (min: 1, integer)"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    disabled={loading}
                    min="1"
                    step="1"
                    style={{
                      width: '100%',
                      padding: '8px',
                      margin: '5px 0',
                      background: '#1a1a2e',
                      color: 'white',
                      border: tradeAmount && parseFloat(tradeAmount) > 0 ? '1px solid #00ff00' : '1px solid #333',
                      borderRadius: '4px'
                    }}
                  />

                  <input
                    type="number"
                    placeholder="Price (min: 1, integer, for limit orders)"
                    value={tradePrice}
                    onChange={(e) => setTradePrice(e.target.value)}
                    disabled={loading}
                    min="1"
                    step="1"
                    style={{
                      width: '100%',
                      padding: '8px',
                      margin: '5px 0',
                      background: '#1a1a2e',
                      color: 'white',
                      border: tradePrice && parseFloat(tradePrice) > 0 ? '1px solid #00ff00' : '1px solid #333',
                      borderRadius: '4px'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => quickTrade(true)}
                      disabled={loading}
                      style={{ flex: 1, padding: '8px', background: '#00ff00', color: 'black' }}
                    >
                      {loading ? 'Trading...' : 'Quick Buy'}
                    </button>
                    <button 
                      onClick={() => quickTrade(false)}
                      disabled={loading}
                      style={{ flex: 1, padding: '8px', background: '#ff4444', color: 'white' }}
                    >
                      {loading ? 'Trading...' : 'Quick Sell'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                    <button 
                      onClick={() => placeOrder(true)}
                      disabled={loading || !tradePrice}
                      style={{ flex: 1, padding: '8px', background: '#0088ff', color: 'white' }}
                    >
                      Limit Buy
                    </button>
                    <button 
                      onClick={() => placeOrder(false)}
                      disabled={loading || !tradePrice}
                      style={{ flex: 1, padding: '8px', background: '#ff8800', color: 'white' }}
                    >
                      Limit Sell
                    </button>
                  </div>
                </div>
                
                {/* Portfolio Panel */}
                <div className="feature-card gradient-border card-hover">
                  <h3>📊 Portfolio</h3>
                  {availablePairs.map(pair => (
                    <div key={pair} style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                      <span>{pair}:</span>
                      <span style={{color: '#00ff00'}}>{portfolioBalances[pair] || '0'}</span>
                    </div>
                  ))}
                </div>
                
                {/* Stats Panel */}
                <div className="feature-card gradient-border card-hover">
                  <h3>💎 Stats</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <span>Total Orders:</span>
                    <span style={{color: '#00ff00'}}>{stats.orders}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <span>Total Trades:</span>
                    <span style={{color: '#00ff00'}}>{stats.trades}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <span>Privacy:</span>
                    <span style={{color: '#00ff00'}}>🔐 FHE</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="features-grid">
                <div className="feature-card gradient-border card-hover">
                  <h3>🔐 Real Blockchain Trading</h3>
                  <p>Connect MetaMask to start trading on Sepolia testnet with FHE encryption</p>
                </div>
                
                <div className="feature-card gradient-border card-hover">
                  <h3>📊 Live Contract Interaction</h3>
                  <p>All transactions are real blockchain calls to deployed smart contract</p>
                </div>
                
                <div className="feature-card gradient-border card-hover">
                  <h3>🌐 Sepolia Testnet</h3>
                  <p>Real testnet deployment - requires Sepolia ETH for transactions</p>
                </div>
              </div>
            )}
            
            <div className="action-buttons">
              <button className="btn-primary glow-effect" onClick={() => window.open(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`, '_blank')}>
                View Contract on Etherscan
              </button>
              {!account ? (
                <button 
                  className="btn-secondary" 
                  onClick={connectWallet}
                  disabled={loading}
                >
                  {loading ? 'Connecting...' : 'Connect MetaMask'}
                </button>
              ) : (
                <button className="btn-secondary" disabled>
                  ✅ Connected: {account.slice(0, 6)}...{account.slice(-4)}
                </button>
              )}
            </div>
            
            <div className="privacy-notice">
              <span className="privacy-icon">🛡️</span>
              <p>Real blockchain deployment on Sepolia testnet. All transactions require actual Sepolia ETH and are permanently recorded on the blockchain.</p>
            </div>
          </div>
        </div>
        
        <div className="stats-section">
          <div className="container">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats.trades || 'Loading...'}</div>
                <div className="stat-label">Total Trades</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{availablePairs.length}</div>
                <div className="stat-label">Trading Pairs</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{account ? '1' : '0'}</div>
                <div className="stat-label">Connected Users</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">🔐</div>
                <div className="stat-label">Privacy Level</div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;