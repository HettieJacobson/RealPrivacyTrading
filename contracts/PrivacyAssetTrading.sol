// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PrivacyAssetTrading {

    address public owner;
    uint256 public orderCounter;
    uint256 public tradeCounter;
    
    struct Order {
        uint256 orderId;
        address trader;
        string pair;
        bool isLong; // true for buy, false for sell
        uint256 amount;
        uint256 price;
        bool isActive;
        uint256 timestamp;
        bool isExecuted;
    }
    
    struct Trade {
        uint256 tradeId;
        address buyer;
        address seller;
        string pair;
        uint256 amount;
        uint256 price;
        uint256 timestamp;
    }
    
    struct Balance {
        uint256 balance;
        bool exists;
    }
    
    mapping(uint256 => Order) public orders;
    mapping(address => mapping(string => Balance)) public portfolios;
    mapping(uint256 => Trade) public trades;
    mapping(string => uint256) public marketPrices; // Market prices
    
    event OrderPlaced(uint256 indexed orderId, address indexed trader, string pair, bool isLong);
    event TradeExecuted(uint256 indexed tradeId, address indexed buyer, address indexed seller, string pair);
    event QuickTradeExecuted(address indexed trader, string pair, bool isLong);
    event MarketPriceUpdated(string pair);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        orderCounter = 1;
        tradeCounter = 1;
        
        // Initialize market prices
        _initializeMarketPrices();
    }
    
    function _initializeMarketPrices() private {
        // Initialize with sample market prices
        marketPrices["BTC/ETH"] = 15000; // Example: 15 ETH per BTC
        marketPrices["ETH/USDT"] = 2500; // Example: 2500 USDT per ETH
        marketPrices["BTC/USDT"] = 37500000; // Example: 37,500 USDT per BTC
    }
    
    function placeOrder(
        string memory pair,
        bool isLong,
        uint32 amount,
        uint32 price
    ) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(price > 0, "Price must be positive");
        require(bytes(pair).length > 0, "Invalid pair");
        
        Order memory newOrder = Order({
            orderId: orderCounter,
            trader: msg.sender,
            pair: pair,
            isLong: isLong,
            amount: amount,
            price: price,
            isActive: true,
            timestamp: block.timestamp,
            isExecuted: false
        });
        
        orders[orderCounter] = newOrder;
        
        emit OrderPlaced(orderCounter, msg.sender, pair, isLong);
        
        // Try to match orders
        _tryMatchOrders(orderCounter);
        
        uint256 currentOrderId = orderCounter;
        orderCounter++;
        
        return currentOrderId;
    }
    
    function quickBuy(string memory pair, uint32 amount) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(bytes(pair).length > 0, "Invalid pair");
        
        // Get current market price
        uint256 currentPrice = marketPrices[pair];
        
        // Execute at market price
        _executeQuickTrade(msg.sender, pair, true, amount, currentPrice);
        
        emit QuickTradeExecuted(msg.sender, pair, true);
        
        uint256 currentTradeId = tradeCounter;
        tradeCounter++;
        
        return currentTradeId;
    }
    
    function quickSell(string memory pair, uint32 amount) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(bytes(pair).length > 0, "Invalid pair");
        
        // Get current market price
        uint256 currentPrice = marketPrices[pair];
        
        // Execute at market price
        _executeQuickTrade(msg.sender, pair, false, amount, currentPrice);
        
        emit QuickTradeExecuted(msg.sender, pair, false);
        
        uint256 currentTradeId = tradeCounter;
        tradeCounter++;
        
        return currentTradeId;
    }
    
    function _executeQuickTrade(
        address trader,
        string memory pair,
        bool isLong,
        uint256 amount,
        uint256 price
    ) private {
        // Create trade record
        Trade memory newTrade = Trade({
            tradeId: tradeCounter,
            buyer: isLong ? trader : address(0),
            seller: isLong ? address(0) : trader,
            pair: pair,
            amount: amount,
            price: price,
            timestamp: block.timestamp
        });
        
        trades[tradeCounter] = newTrade;
        
        // Update portfolio
        _updatePortfolio(trader, pair, amount, isLong);
    }
    
    function _tryMatchOrders(uint256 newOrderId) private {
        Order storage newOrder = orders[newOrderId];
        
        // Simple matching logic - execute some orders for demonstration
        // In a real exchange, this would involve order book matching
        
        // Mark order as potentially matched (simple randomization)
        if (block.timestamp % 2 == 0) {
            _executeOrder(newOrderId);
        }
    }
    
    function _executeOrder(uint256 orderId) private {
        Order storage order = orders[orderId];
        require(order.isActive, "Order not active");
        
        // Create trade record
        Trade memory newTrade = Trade({
            tradeId: tradeCounter,
            buyer: order.isLong ? order.trader : address(0),
            seller: order.isLong ? address(0) : order.trader,
            pair: order.pair,
            amount: order.amount,
            price: order.price,
            timestamp: block.timestamp
        });
        
        trades[tradeCounter] = newTrade;
        
        // Mark order as executed
        order.isExecuted = true;
        order.isActive = false;
        
        // Update portfolio
        _updatePortfolio(order.trader, order.pair, order.amount, order.isLong);
        
        emit TradeExecuted(tradeCounter, 
            order.isLong ? order.trader : address(0),
            order.isLong ? address(0) : order.trader,
            order.pair);
        
        tradeCounter++;
    }
    
    function _updatePortfolio(
        address trader,
        string memory pair,
        uint256 amount,
        bool isLong
    ) private {
        if (!portfolios[trader][pair].exists) {
            portfolios[trader][pair] = Balance({
                balance: amount,
                exists: true
            });
        } else {
            if (isLong) {
                portfolios[trader][pair].balance += amount;
            } else {
                portfolios[trader][pair].balance -= amount;
            }
        }
    }
    
    function getOrderInfo(uint256 orderId) external view returns (
        address trader,
        string memory pair,
        bool isLong,
        bool isActive,
        bool isExecuted,
        uint256 timestamp
    ) {
        Order storage order = orders[orderId];
        return (
            order.trader,
            order.pair,
            order.isLong,
            order.isActive,
            order.isExecuted,
            order.timestamp
        );
    }
    
    function getOrderData(uint256 orderId) external view returns (
        uint256 amount,
        uint256 price
    ) {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender || msg.sender == owner, "Not authorized");
        
        return (order.amount, order.price);
    }
    
    function getPortfolioBalance(address trader, string memory pair) 
        external view returns (uint256) {
        require(msg.sender == trader || msg.sender == owner, "Not authorized");
        return portfolios[trader][pair].balance;
    }
    
    function getMarketPrice(string memory pair) external view returns (uint256) {
        return marketPrices[pair];
    }
    
    function updateMarketPrice(string memory pair, uint32 newPrice) external onlyOwner {
        marketPrices[pair] = newPrice;
        emit MarketPriceUpdated(pair);
    }
    
    function getCurrentOrderCount() external view returns (uint256) {
        return orderCounter - 1;
    }
    
    function getCurrentTradeCount() external view returns (uint256) {
        return tradeCounter - 1;
    }
    
    // Emergency functions
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender, "Not your order");
        require(order.isActive && !order.isExecuted, "Cannot cancel");
        
        order.isActive = false;
    }
}