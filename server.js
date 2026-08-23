const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { User, Sale, Commission, Settlement } = require('./models');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/tabligh-yar', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).catch(err => console.log('MongoDB Connection Error:', err));

// Commission Configuration
const COMMISSIONS = {
  seller: parseInt(process.env.COMMISSION_SELLER) || 65,
  level1: parseInt(process.env.COMMISSION_LEVEL1) || 10,
  level2: parseInt(process.env.COMMISSION_LEVEL2) || 3,
  level3: parseInt(process.env.COMMISSION_LEVEL3) || 2,
  platform: parseInt(process.env.COMMISSION_PLATFORM) || 20
};

const RANK_THRESHOLDS = {
  seller: 0,
  manager: parseInt(process.env.RANK_MANAGER) || 100,
  leader: parseInt(process.env.RANK_LEADER) || 200,
  top_leader: parseInt(process.env.RANK_TOP_LEADER) || 350,
  top_earner: parseInt(process.env.RANK_TOP_EARNER) || 500,
  site_leader: parseInt(process.env.RANK_SITE_LEADER) || 750
};

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============= AUTH ROUTES =============

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, referralCode } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }
    
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }
    
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
      referredBy = referrer._id;
    }
    
    const userId = new mongoose.Types.ObjectId();
    const newUser = new User({
      _id: userId,
      name,
      phone,
      password: phone, // Default password = phone (should be changed by user)
      referralCode: uuidv4().substring(0, 8).toUpperCase(),
      referredBy,
      currentRank: 'seller'
    });
    
    await newUser.save();
    
    // اگر این کاربر زیرمجموعه کسی بود، اون کسی رو آپدیت کن
    if (referredBy) {
      await User.findByIdAndUpdate(referredBy, {
        $push: { directTeamMembers: userId }
      });
    }
    
    const token = jwt.sign(
      { userId: newUser._id, phone: newUser.phone },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        _id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        referralCode: newUser.referralCode
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }
    
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }
    
    const token = jwt.sign(
      { userId: user._id, phone: user.phone },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        currentRank: user.currentRank
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============= USER ROUTES =============

// Get User Profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('referredBy', 'name')
      .populate('directTeamMembers', 'name phone totalTeamSales');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        currentRank: user.currentRank,
        totalTeamSales: user.totalTeamSales,
        monthlyCommission: user.monthlyCommission,
        totalEarnings: user.totalEarnings,
        directTeamMembers: user.directTeamMembers,
        directTeamCount: user.directTeamMembers.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get Team (Hierarchy)
app.get('/api/user/team', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate({
      path: 'directTeamMembers',
      select: 'name phone totalTeamSales monthlyCommission currentRank'
    });
    
    res.json({
      teamLeader: {
        name: user.name,
        currentRank: user.currentRank
      },
      directTeam: user.directTeamMembers,
      directTeamCount: user.directTeamMembers.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============= SALE ROUTES =============

// Create Sale (Record a sale made by this user)
app.post('/api/sales/create', authenticateToken, async (req, res) => {
  try {
    const { businessName, packageType, amount, description } = req.body;
    
    if (!amount || !packageType) {
      return res.status(400).json({ message: 'Amount and package type required' });
    }
    
    const saleId = new mongoose.Types.ObjectId();
    const newSale = new Sale({
      _id: saleId,
      seller: req.user.userId,
      businessName: businessName || 'Unnamed Business',
      packageType,
      amount,
      description,
      paymentStatus: 'completed' // In real implementation, integrate with Zarinpal
    });
    
    await newSale.save();
    
    // Calculate and distribute commissions
    await calculateAndDistributeCommissions(saleId, req.user.userId, amount);
    
    // Update user's total team sales and rank
    await updateUserRank(req.user.userId);
    
    res.status(201).json({
      message: 'Sale recorded successfully',
      sale: {
        _id: newSale._id,
        amount: newSale.amount,
        packageType: newSale.packageType,
        createdAt: newSale.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get User's Sales
app.get('/api/sales/user', authenticateToken, async (req, res) => {
  try {
    const sales = await Sale.find({ seller: req.user.userId }).sort({ createdAt: -1 });
    
    res.json({
      sales,
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, s) => sum + s.amount, 0)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============= COMMISSION ROUTES =============

// Get User's Commissions
app.get('/api/commissions', authenticateToken, async (req, res) => {
  try {
    const commissions = await Commission.find({ recipient: req.user.userId })
      .populate('sale', 'businessName amount packageType createdAt')
      .sort({ createdAt: -1 });
    
    const total = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    res.json({
      commissions,
      total,
      byLevel: {
        own: commissions.filter(c => c.level === 0).reduce((s, c) => s + (c.amount || 0), 0),
        level1: commissions.filter(c => c.level === 1).reduce((s, c) => s + (c.amount || 0), 0),
        level2: commissions.filter(c => c.level === 2).reduce((s, c) => s + (c.amount || 0), 0),
        level3: commissions.filter(c => c.level === 3).reduce((s, c) => s + (c.amount || 0), 0)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============= DASHBOARD ROUTE =============

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    const commissions = await Commission.find({ recipient: req.user.userId });
    const totalEarnings = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const sales = await Sale.find({ seller: req.user.userId });
    const ownSalesAmount = sales.reduce((sum, s) => sum + s.amount, 0);
    
    // Calculate progress to next rank
    const rankKeys = Object.keys(RANK_THRESHOLDS).sort((a, b) => RANK_THRESHOLDS[a] - RANK_THRESHOLDS[b]);
    const currentRankIndex = rankKeys.indexOf(user.currentRank);
    const nextRank = rankKeys[currentRankIndex + 1];
    const nextThreshold = nextRank ? RANK_THRESHOLDS[nextRank] : RANK_THRESHOLDS.site_leader;
    const progress = Math.min((user.totalTeamSales / nextThreshold) * 100, 100);
    
    res.json({
      user: {
        name: user.name,
        currentRank: user.currentRank,
        phone: user.phone
      },
      stats: {
        ownSalesThisMonth: ownSalesAmount,
        teamSalesThisMonth: user.totalTeamSales,
        totalCommission: user.monthlyCommission,
        totalEarnings: totalEarnings,
        directTeamSize: user.directTeamMembers.length
      },
      rankProgress: {
        current: user.currentRank,
        currentThreshold: RANK_THRESHOLDS[user.currentRank],
        nextRank: nextRank || 'site_leader',
        nextThreshold,
        currentTeamSales: user.totalTeamSales,
        progress
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============= HELPER FUNCTIONS =============

// Calculate and distribute commissions across the hierarchy
async function calculateAndDistributeCommissions(saleId, sellerId, amount) {
  try {
    const seller = await User.findById(sellerId);
    if (!seller) return;
    
    // Level 0: The direct seller gets 65%
    const sellerCommission = (amount * COMMISSIONS.seller) / 100;
    await Commission.create({
      _id: new mongoose.Types.ObjectId(),
      sale: saleId,
      recipient: sellerId,
      level: 0,
      amount: sellerCommission,
      percentage: COMMISSIONS.seller
    });
    
    // Level 1, 2, 3: Walk up the hierarchy
    let currentUser = seller;
    let level = 1;
    
    while (currentUser.referredBy && level <= 3) {
      const manager = await User.findById(currentUser.referredBy);
      if (!manager) break;
      
      const percentage = level === 1 ? COMMISSIONS.level1 : level === 2 ? COMMISSIONS.level2 : COMMISSIONS.level3;
      const managerCommission = (amount * percentage) / 100;
      
      await Commission.create({
        _id: new mongoose.Types.ObjectId(),
        sale: saleId,
        recipient: currentUser.referredBy,
        level,
        amount: managerCommission,
        percentage
      });
      
      currentUser = manager;
      level++;
    }
    
    // Update seller's monthly commission
    await updateUserMonthlyCommission(sellerId);
  } catch (error) {
    console.log('Commission calculation error:', error);
  }
}

// Update user's monthly commission and team sales
async function updateUserMonthlyCommission(userId) {
  try {
    const commissions = await Commission.find({ recipient: userId });
    const totalCommission = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    await User.findByIdAndUpdate(userId, {
      monthlyCommission: totalCommission,
      totalEarnings: totalCommission + (await User.findById(userId)).totalEarnings
    });
  } catch (error) {
    console.log('Update commission error:', error);
  }
}

// Calculate team sales and update rank
async function updateUserRank(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    // Get all sales from direct team members (recursive)
    async function getTeamSales(memberId) {
      const members = await User.findById(memberId).select('directTeamMembers');
      let total = 0;
      
      for (const member of members.directTeamMembers) {
        const sales = await Sale.find({ seller: member });
        total += sales.reduce((sum, s) => sum + s.amount, 0);
        
        // Recursively get sales from deeper levels
        total += await getTeamSales(member);
      }
      
      return total;
    }
    
    const teamSales = await getTeamSales(userId);
    
    // Determine rank based on threshold
    let newRank = 'seller';
    if (teamSales >= RANK_THRESHOLDS.site_leader) newRank = 'site_leader';
    else if (teamSales >= RANK_THRESHOLDS.top_earner) newRank = 'top_earner';
    else if (teamSales >= RANK_THRESHOLDS.top_leader) newRank = 'top_leader';
    else if (teamSales >= RANK_THRESHOLDS.leader) newRank = 'leader';
    else if (teamSales >= RANK_THRESHOLDS.manager) newRank = 'manager';
    
    await User.findByIdAndUpdate(userId, {
      totalTeamSales: teamSales,
      currentRank: newRank
    });
  } catch (error) {
    console.log('Update rank error:', error);
  }
}

// ============= ERROR HANDLING =============

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// ============= START SERVER =============

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
