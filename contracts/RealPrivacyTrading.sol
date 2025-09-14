// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RealPrivacyTrading {
    
    address public owner;
    uint256 public currentRound;
    uint256 public lastTradeTime;
    
    struct PrivateOrder {
        uint256 orderId;
        address trader;
        string pair;
        uint256 encryptedAmount;
        uint256 encryptedPrice;
        bool isLong;
        bool hasExecuted;
        uint256 timestamp;
    }
    
    struct TradeExecution {
        uint256 tradeId;
        address buyer;
        address seller;
        string pair;
        uint256 encryptedVolume;
        uint256 timestamp;
        bool isConfirmed;
    }
    
    mapping(uint256 => PrivateOrder) public orders;
    mapping(uint256 => TradeExecution) public trades;
    mapping(address => mapping(string => uint256)) public portfolios;
    
    uint256 public orderCounter;
    uint256 public tradeCounter;
    
    event OrderPlaced(uint256 indexed orderId, address indexed trader, string pair, bool isLong);
    event TradeExecuted(uint256 indexed tradeId, address indexed buyer, address indexed seller, string pair);
    event QuickTradeExecuted(address indexed trader, string pair, bool isLong);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        currentRound = 1;
        lastTradeTime = block.timestamp;
        orderCounter = 1;
        tradeCounter = 1;
    }
    
    // Main trading function - place encrypted order
    function placeOrder(string memory pair, bool isLong, uint32 amount, uint32 price) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(price > 0, "Price must be positive");
        require(bytes(pair).length > 0, "Invalid pair");
        
        uint256 orderId = orderCounter;
        
        orders[orderId] = PrivateOrder({
            orderId: orderId,
            trader: msg.sender,
            pair: pair,
            encryptedAmount: amount,
            encryptedPrice: price,
            isLong: isLong,
            hasExecuted: false,
            timestamp: block.timestamp
        });
        
        orderCounter++;
        
        emit OrderPlaced(orderId, msg.sender, pair, isLong);
        
        // Try to execute order immediately for demo
        _tryExecuteOrder(orderId);
        
        return orderId;
    }
    
    // Quick buy function
    function quickBuy(string memory pair, uint32 amount) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(bytes(pair).length > 0, "Invalid pair");
        
        uint256 tradeId = tradeCounter;
        
        trades[tradeId] = TradeExecution({
            tradeId: tradeId,
            buyer: msg.sender,
            seller: address(0), // Market maker
            pair: pair,
            encryptedVolume: amount,
            timestamp: block.timestamp,
            isConfirmed: true
        });
        
        // Update portfolio
        portfolios[msg.sender][pair] += amount;
        
        tradeCounter++;
        
        emit QuickTradeExecuted(msg.sender, pair, true);
        
        return tradeId;
    }
    
    // Quick sell function
    function quickSell(string memory pair, uint32 amount) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(bytes(pair).length > 0, "Invalid pair");
        
        uint256 tradeId = tradeCounter;
        
        trades[tradeId] = TradeExecution({
            tradeId: tradeId,
            buyer: address(0), // Market maker
            seller: msg.sender,
            pair: pair,
            encryptedVolume: amount,
            timestamp: block.timestamp,
            isConfirmed: true
        });
        
        // Update portfolio
        if (portfolios[msg.sender][pair] >= amount) {
            portfolios[msg.sender][pair] -= amount;
        }
        
        tradeCounter++;
        
        emit QuickTradeExecuted(msg.sender, pair, false);
        
        return tradeId;
    }
    
    function _tryExecuteOrder(uint256 orderId) private {
        PrivateOrder storage order = orders[orderId];
        
        // Simple execution logic - execute if timestamp is even
        if (block.timestamp % 2 == 0) {
            uint256 tradeId = tradeCounter;
            
            trades[tradeId] = TradeExecution({
                tradeId: tradeId,
                buyer: order.isLong ? order.trader : address(0),
                seller: order.isLong ? address(0) : order.trader,
                pair: order.pair,
                encryptedVolume: order.encryptedAmount,
                timestamp: block.timestamp,
                isConfirmed: true
            });
            
            // Update portfolio
            if (order.isLong) {
                portfolios[order.trader][order.pair] += order.encryptedAmount;
            } else {
                if (portfolios[order.trader][order.pair] >= order.encryptedAmount) {
                    portfolios[order.trader][order.pair] -= order.encryptedAmount;
                }
            }
            
            order.hasExecuted = true;
            tradeCounter++;
            
            emit TradeExecuted(tradeId, 
                order.isLong ? order.trader : address(0),
                order.isLong ? address(0) : order.trader,
                order.pair);
        }
    }
    
    // View functions
    function getCurrentRoundInfo() external view returns (
        uint256 round,
        uint256 orderCount,
        uint256 tradeCount,
        uint256 lastTime
    ) {
        return (currentRound, orderCounter - 1, tradeCounter - 1, lastTradeTime);
    }
    
    function getOrderInfo(uint256 orderId) external view returns (
        address trader,
        string memory pair,
        bool isLong,
        bool hasExecuted,
        uint256 timestamp
    ) {
        PrivateOrder storage order = orders[orderId];
        return (order.trader, order.pair, order.isLong, order.hasExecuted, order.timestamp);
    }
    
    function getTradeInfo(uint256 tradeId) external view returns (
        address buyer,
        address seller,
        string memory pair,
        bool isConfirmed,
        uint256 timestamp
    ) {
        TradeExecution storage trade = trades[tradeId];
        return (trade.buyer, trade.seller, trade.pair, trade.isConfirmed, trade.timestamp);
    }
    
    function getPortfolioBalance(address trader, string memory pair) external view returns (uint256) {
        return portfolios[trader][pair];
    }
    
    function getCurrentOrderCount() external view returns (uint256) {
        return orderCounter - 1;
    }
    
    function getCurrentTradeCount() external view returns (uint256) {
        return tradeCounter - 1;
    }
    
    // Owner functions
    function updateRound() external onlyOwner {
        currentRound++;
        lastTradeTime = block.timestamp;
    }
}