const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost/tabligh-yar';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

// Connect to MongoDB
mongoose.connect(MONGO_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })
  .catch(err => console.log('MongoDB error:', err.message));

// Schemas
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  password: String,
  referralCode: String,
  directTeamMembers: [String],
  totalTeamSales: { type: Number, default: 0 },
  currentRank: { type: String, default: 'seller' },
  createdAt: { type: Date, default: Date.now }
});

const saleSchema = new mongoose.Schema({
  seller: String,
  businessName: String,
  packageType: String,
  amount: Number,
  description: String,
  paymentStatus: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Sale = mongoose.model('Sale', saleSchema);

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const code = Math.random().toString(16).slice(2, 10).toUpperCase();
    const user = await User.create({ name, phone, password, referralCode: code });
    const token = jwt.sign({ _id: user._id }, JWT_SECRET);
    res.status(201).json({ message: 'OK', user: { _id: user._id, name, phone, referralCode: code }, token });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone, password });
    if (!user) return res.status(401).json({ message: 'Invalid' });
    const token = jwt.sign({ _id: user._id }, JWT_SECRET);
    res.json({ user: { _id: user._id, name: user.name, phone, referralCode: user.referralCode }, token });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/sales/create', auth, async (req, res) => {
  try {
    const { businessName, packageType, amount } = req.body;
    const sale = await Sale.create({ seller: req.user._id, businessName, packageType, amount, description: '' });
    res.status(201).json({ message: 'OK', sale });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/sales/user', auth, async (req, res) => {
  try {
    const sales = await Sale.find({ seller: req.user._id });
    res.json({ sales });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sales = await Sale.find({ seller: req.user._id });
    const ownSales = sales.reduce((s, x) => s + x.amount, 0);
    res.json({
      user,
      stats: {
        ownSalesThisMonth: ownSales,
        teamSalesThisMonth: 0,
        totalCommission: Math.floor(ownSales * 0.65),
        totalEarnings: Math.floor(ownSales * 0.65)
      },
      rankProgress: { current: user.currentRank, nextRank: 'manager', progress: 0 },
      team: [],
      directTeamCount: 0
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/user/team', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ directTeam: [], directTeamCount: 0 });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/db-status', (req, res) => {
  res.json({ status: 'ok' });
});

// Static HTML pages
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>تبلیغ‌یار</title><style>body{background:#0a1f5c;color:#fff;text-align:center;padding:40px;font-family:Arial}h1{font-size:32px}button{background:#2563eb;color:#fff;padding:12px 30px;border:none;border-radius:6px;cursor:pointer;margin:10px}</style></head><body><h1>تبلیغ‌یار 📢</h1><p>دایرکتوری کسب‌وکارها</p><button onclick="alert('ورود')">ورود</button> <button onclick="alert('ثبت‌نام')">ثبت‌نام</button></body></html>`);
});

app.get('/dashboard.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>داشبورد</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#0a1f5c;color:#fff;padding:10px}a{color:#fff;text-decoration:none;margin-right:10px}.card{background:#fff;padding:15px;margin:10px}</style></head><body><header><h1 style="font-size:16px;display:inline">📊 داشبورد</h1><a href="/sales.html">فروش</a><button onclick="logout()" style="float:right;background:red;color:#fff;border:none;cursor:pointer;padding:8px">خروج</button></header><div class="card"><p>درآمد: <span id="s">۰</span></p><p>نام: <span id="n">-</span></p></div><script>fetch('/api/dashboard',{headers:{Authorization:'Bearer '+localStorage.getItem('token')}}).then(e=>e.json()).then(e=>{document.getElementById('s').textContent=Math.floor(e.stats.totalEarnings/1e6)+'M';document.getElementById('n').textContent=e.user.name}).catch(()=>alert('خطا'));function logout(){localStorage.clear();window.location.href='/'}</script></body></html>`);
});

app.get('/sales.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>فروش</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#0a1f5c;color:#fff;padding:10px}input{display:block;width:90%;padding:10px;margin:10px auto;border:1px solid #ddd;border-radius:4px}button{width:90%;padding:10px;margin:10px auto;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer}</style></head><body><header><h1 style="font-size:16px">📊 فروش</h1></header><input type="text" id="name" placeholder="نام کسب"><input type="number" id="amount" placeholder="مبلغ"><button onclick="submit()">ثبت</button><a href="/dashboard.html" style="display:block;text-align:center;margin:10px;color:#2563eb">← برگشت</a><script>function submit(){fetch('/api/sales/create',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('token')},body:JSON.stringify({businessName:document.getElementById('name').value,packageType:'custom',amount:parseInt(document.getElementById('amount').value),description:''})}).then(e=>e.json()).then(e=>{alert('✓');document.getElementById('name').value='';document.getElementById('amount').value=''}).catch(()=>alert('خطا'))}</script></body></html>`);
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
