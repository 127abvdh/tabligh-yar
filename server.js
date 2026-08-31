const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost/tabligh-yar';
const JWT_SECRET = 'secret-key';

mongoose.connect(MONGO_URI);

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

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const code = Math.random().toString(16).slice(2, 10).toUpperCase();
    const user = await User.create({ name, phone, password, referralCode: code });
    const token = jwt.sign({ _id: user._id }, JWT_SECRET);
    res.status(201).json({ 
      message: 'OK', 
      user: { _id: user._id, name, phone, referralCode: code }, 
      token 
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone, password });
    if (!user) return res.status(401).json({ message: 'Invalid' });
    const token = jwt.sign({ _id: user._id }, JWT_SECRET);
    res.json({ 
      user: { _id: user._id, name: user.name, phone, referralCode: user.referralCode }, 
      token 
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Create sale
app.post('/api/sales/create', auth, async (req, res) => {
  try {
    const { businessName, packageType, amount } = req.body;
    const sale = await Sale.create({ 
      seller: req.user._id, 
      businessName, 
      packageType, 
      amount, 
      description: '' 
    });
    res.status(201).json({ message: 'OK', sale });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Get user sales
app.get('/api/sales/user', auth, async (req, res) => {
  try {
    const sales = await Sale.find({ seller: req.user._id });
    res.json({ sales });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Dashboard
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sales = await Sale.find({ seller: req.user._id });
    const ownSales = sales.reduce((sum, s) => sum + s.amount, 0);
    const commission = Math.floor(ownSales * 0.65);
    
    res.json({
      user,
      stats: {
        ownSalesThisMonth: ownSales,
        teamSalesThisMonth: 0,
        totalCommission: commission,
        totalEarnings: commission
      },
      rankProgress: { 
        current: user.currentRank, 
        nextRank: 'manager', 
        progress: 0 
      },
      team: [],
      directTeamCount: 0
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Pages
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>تبلیغ‌یار</title><style>body{background:#0a1f5c;color:#fff;text-align:center;padding:40px;font-family:Arial}h1{font-size:32px}button{background:#2563eb;color:#fff;padding:12px 30px;border:none;border-radius:6px;cursor:pointer;margin:10px}</style></head><body><h1>تبلیغ‌یار 📢</h1><p>دایرکتوری کسب‌وکارها</p><button onclick="showLogin()">ورود</button> <button onclick="showSignup()">ثبت‌نام</button><script>function showLogin(){const phone=prompt('تلفن:');const pass=prompt('رمز:');fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password:pass})}).then(r=>r.json()).then(d=>{localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));window.location.href='/dashboard.html'})}function showSignup(){const name=prompt('نام:');const phone=prompt('تلفن:');const pass=prompt('رمز:');fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,password:pass})}).then(r=>r.json()).then(d=>{localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));window.location.href='/dashboard.html'})}</script></body></html>`);
});

app.get('/dashboard.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>داشبورد</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#0a1f5c;color:#fff;padding:10px;display:flex;justify-content:space-between}a{color:#fff;text-decoration:none}.card{background:#fff;padding:15px;margin:10px}</style></head><body><header><h1 style="font-size:14px">📊 داشبورد</h1><div><a href="/sales.html" style="margin-right:20px">📝 فروش</a><button onclick="logout()" style="background:red;color:#fff;border:none;cursor:pointer;padding:8px">خروج</button></div></header><div class="card"><p>درآمد: <span id="s">۰</span></p><p>نام: <span id="n">-</span></p><p>فروش‌های شما: <span id="count">۰</span></p></div><script>const token=localStorage.getItem('token');if(!token)window.location.href='/';fetch('/api/dashboard',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(d=>{document.getElementById('s').textContent=Math.floor(d.stats.totalEarnings/1e6)+'M';document.getElementById('n').textContent=d.user.name;fetch('/api/sales/user',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(s=>{document.getElementById('count').textContent=s.sales.length})}).catch(()=>alert('خطا'));function logout(){localStorage.clear();window.location.href='/'}</script></body></html>`);
});

app.get('/sales.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>فروش</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#0a1f5c;color:#fff;padding:10px}.form{background:#fff;padding:20px;margin:20px}.form input{display:block;width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px}button{width:100%;padding:10px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-top:10px}</style></head><body><header><h1 style="font-size:14px">📊 فروش</h1></header><div class="form"><input type="text" id="name" placeholder="نام کسب"><select id="pkg" style="width:100%;padding:10px;margin:10px 0"><option value="bronze">🥉 برنزی - ۵M</option><option value="silver">🥈 نقره‌ای - ۱۵M</option><option value="gold">🥇 طلایی - ۴۰M</option></select><input type="number" id="amount" placeholder="مبلغ"><button onclick="submit()">ثبت</button><button onclick="window.location.href='/dashboard.html'" style="background:#999">برگشت</button></div><script>const token=localStorage.getItem('token');if(!token)window.location.href='/';function submit(){const name=document.getElementById('name').value;const pkg=document.getElementById('pkg').value;const amount=document.getElementById('amount').value;fetch('/api/sales/create',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({businessName:name,packageType:pkg,amount:parseInt(amount)})}).then(r=>r.json()).then(d=>{alert('✓ ثبت شد');document.getElementById('name').value='';document.getElementById('amount').value='';window.location.href='/dashboard.html'}).catch(()=>alert('خطا'))}</script></body></html>`);
});

app.listen(8080, () => {
  console.log('Server running on 8080');
});
