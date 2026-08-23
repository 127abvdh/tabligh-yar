const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ===== کاربر (فروشنده) =====
const UserSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String, required: true },
  
  // اطلاعات تیم
  referralCode: { type: String, unique: true }, // کد منحصر دعوت این فروشنده
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // کدام کاربر این فروشنده رو معرفی کرده
  directTeamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // اعضای مستقیم تیم
  
  // بانکی
  bankAccountNumber: String,
  bankName: String,
  accountHolder: String,
  
  // وضعیت
  currentRank: {
    type: String,
    enum: ['seller', 'manager', 'leader', 'top_leader', 'top_earner', 'site_leader'],
    default: 'seller'
  },
  totalTeamSales: { type: Number, default: 0 }, // کل فروش تیم این ماه
  monthlyCommission: { type: Number, default: 0 }, // کمیشن ماه جاری
  totalEarnings: { type: Number, default: 0 }, // کل درآمد کمیشن تا الان
  
  // درجه‌های بالاتر (اگر این کاربر سرگروه باشه)
  level2Members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // اعضای سطح ۲
  level3Members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // اعضای سطح ۳
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch(err) { next(err); }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ===== فروش (Sale - هرتاثیری که یک کاربر فروخت) =====
const SaleSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // اطلاعات فروش
  businessName: String, // نام کسب‌وکاری که تبلیغ خریده
  packageType: {
    type: String,
    enum: ['bronze', 'silver', 'gold'],
    required: true
  },
  amount: { type: Number, required: true }, // مبلغ فروش (میلیون تومان)
  description: String,
  
  // کمیشن‌ها (محاسبه‌شده خودکار)
  commissions: {
    seller: Number, // سهم فروشنده
    level1Manager: Number, // سهم سرگروه
    level2: Number,
    level3: Number,
    platform: Number
  },
  
  // پرداخت
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['zarinpal', 'bank_transfer', 'cash'],
    default: 'zarinpal'
  },
  transactionId: String, // رسید تراکنش
  
  createdAt: { type: Date, default: Date.now },
  settledAt: Date
});

// ===== کمیشن (Commission - سهم هر شخص از هر فروش) =====
const CommissionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // سطح این کمیشن
  level: {
    type: Number,
    enum: [0, 1, 2, 3], // 0 = فروشنده خود، 1,2,3 = سطح‌های بالا
    required: true
  },
  
  amount: Number, // مبلغ کمیشن این شخص
  percentage: Number, // درصد کمیشن (۶۵، ۱۰، ۳، ۲)
  
  status: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  },
  
  paidAt: Date,
  
  createdAt: { type: Date, default: Date.now }
});

// ===== تسویه ماهانه (Monthly Settlement) =====
const SettlementSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: String, // فرمت: "1404-01"
  
  totalSales: Number, // کل فروش این کاربر
  teamSales: Number, // کل فروش تیم
  totalCommission: Number, // کل کمیشن
  
  commissionBreakdown: {
    ownSales: Number,
    level1: Number,
    level2: Number,
    level3: Number
  },
  
  status: {
    type: String,
    enum: ['pending', 'settled', 'paid'],
    default: 'pending'
  },
  
  paidAt: Date,
  bankAccount: {
    accountNumber: String,
    bankName: String,
    accountHolder: String
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Sale: mongoose.model('Sale', SaleSchema),
  Commission: mongoose.model('Commission', CommissionSchema),
  Settlement: mongoose.model('Settlement', SettlementSchema)
};
