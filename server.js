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
  totalEarnings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const businessRequestSchema = new mongoose.Schema({
  businessName: String,
  businessPhone: String,
  businessAddress: String,
  packageType: String,
  amount: Number,
  referrerUserId: mongoose.Schema.Types.ObjectId,
  referrerCode: String,
  paymentStatus: { type: String, default: 'completed' },
  refId: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const BusinessRequest = mongoose.model('BusinessRequest', businessRequestSchema);

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

// Business Request - Requires referrerCode AND address
app.post('/api/business-request', async (req, res) => {
  try {
    const { businessName, businessPhone, businessAddress, packageType, referrerCode } = req.body;
    
    if (!referrerCode || referrerCode.trim() === '') {
      return res.status(400).json({ message: 'کد معرفی الزامی است' });
    }
    
    if (!businessAddress || businessAddress.trim() === '') {
      return res.status(400).json({ message: 'آدرس الزامی است' });
    }
    
    const referrer = await User.findOne({ referralCode: referrerCode });
    if (!referrer) {
      return res.status(400).json({ message: 'کد معرفی نامعتبر است' });
    }
    
    const prices = { bronze: 5000000, silver: 15000000, gold: 40000000 };
    const amount = prices[packageType];
    
    const request = await BusinessRequest.create({
      businessName,
      businessPhone,
      businessAddress,
      packageType,
      amount,
      referrerUserId: referrer._id,
      referrerCode: referrerCode,
      paymentStatus: 'completed',
      refId: 'TEST_' + Date.now()
    });
    
    const commission = Math.floor(amount * 0.65);
    await User.findByIdAndUpdate(
      referrer._id,
      { $inc: { totalEarnings: commission } }
    );
    
    res.status(201).json({ message: 'OK', requestId: request._id });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Dashboard
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const earnings = user.totalEarnings || 0;
    const requests = await BusinessRequest.find({ referrerUserId: req.user._id });
    
    res.json({
      user: { name: user.name, phone: user.phone, referralCode: user.referralCode },
      stats: {
        totalEarnings: earnings,
        totalCommission: earnings,
        requestCount: requests.length
      }
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/requests', auth, async (req, res) => {
  try {
    const requests = await BusinessRequest.find({ referrerUserId: req.user._id });
    res.json({ requests });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Directory - Get all approved businesses
app.get('/api/directory', async (req, res) => {
  try {
    const businesses = await BusinessRequest.find({ paymentStatus: 'completed' });
    res.json({ businesses });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Pages - Homepage
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>تبلیغ‌یار</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#7209b7;color:#fff;font-family:Arial;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;padding:20px;text-align:center}h1{font-size:52px;margin-bottom:15px;line-height:1.2}p{font-size:24px;margin-bottom:40px}.btn{background:#a55eea;color:#fff;padding:20px 30px;border:none;border-radius:10px;cursor:pointer;margin:15px auto;font-size:20px;font-weight:bold;width:95%;max-width:500px;display:block;touch-action:manipulation}</style></head><body><h1>تبلیغ‌یار 📢</h1><p>دایرکتوری کسب‌وکارهای تهران</p><button class="btn" onclick="window.location.href='/directory.html'">📂 مشاهدهی دایرکتوری</button><button class="btn" onclick="window.location.href='/business-request.html'">📝 درخواست تبلیغ</button><button class="btn" onclick="window.location.href='/signup.html'">📋 ثبت‌نام نمایندهی تبلیغات</button><button class="btn" onclick="window.location.href='/login.html'">🔐 ورود نمایندگان تبلیغات</button></body></html>`);
});

// Signup Page
app.get('/signup.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ثبت‌نام</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f4f8;font-family:Arial;padding:15px}h1{color:#7209b7;font-size:32px;margin-bottom:20px}.container{max-width:500px;margin:0 auto;background:#fff;padding:25px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input{display:block;width:100%;padding:16px;margin:15px 0;border:2px solid #e0e7ff;border-radius:8px;font-size:18px}label{display:block;color:#7209b7;font-weight:bold;font-size:16px;margin-top:15px}.btn{width:100%;padding:16px;background:#a55eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:25px;font-size:18px}.back-btn{display:inline-block;margin-bottom:15px;background:#999;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:16px}.info{background:#f0f4f8;padding:15px;border-radius:8px;margin-top:20px;color:#666;font-size:15px;line-height:1.8}</style></head><body><div class="container"><a href="/" class="back-btn">⬅ بازگشت</a><h1>📋 ثبت‌نام</h1><div><label>نام و نام‌خانوادگی</label><input type="text" id="name" placeholder="نام شما"></div><div><label>شماره تلفن</label><input type="tel" id="phone" placeholder="۰۹XXXXXXXXX"></div><div><label>رمز عبور</label><input type="password" id="password" placeholder="رمز عبور"></div><button class="btn" onclick="signup()">ثبت‌نام</button><div class="info"><p>✅ کد معرفی خاص دریافت کنید</p><p>✅ ۶۵% درآمد برای هر پرداخت</p></div></div><script>function signup(){const name=document.getElementById('name').value;const phone=document.getElementById('phone').value;const password=document.getElementById('password').value;if(!name||!phone||!password){alert('❌ تمام فیلدها الزامی هستند');return}fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,password})}).then(r=>r.json()).then(d=>{if(d.token){localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));alert('✓ کد معرفی شما:\\n\\n'+d.user.referralCode);window.location.href='/dashboard.html'}else{alert('❌ '+d.message)}}).catch(e=>alert('❌ خطا'))}</script></body></html>`);
});

// Login Page
app.get('/login.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ورود</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f4f8;font-family:Arial;padding:15px}h1{color:#7209b7;font-size:32px;margin-bottom:20px}.container{max-width:500px;margin:0 auto;background:#fff;padding:25px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input{display:block;width:100%;padding:16px;margin:15px 0;border:2px solid #e0e7ff;border-radius:8px;font-size:18px}label{display:block;color:#7209b7;font-weight:bold;font-size:16px;margin-top:15px}.btn{width:100%;padding:16px;background:#a55eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:25px;font-size:18px}.back-btn{display:inline-block;margin-bottom:15px;background:#999;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:16px}.link{text-align:center;margin-top:20px;color:#666;font-size:15px}.link a{color:#a55eea;text-decoration:none}</style></head><body><div class="container"><a href="/" class="back-btn">⬅ بازگشت</a><h1>🔐 ورود</h1><div><label>شماره تلفن</label><input type="tel" id="phone" placeholder="۰۹XXXXXXXXX"></div><div><label>رمز عبور</label><input type="password" id="password" placeholder="رمز عبور"></div><button class="btn" onclick="login()">ورود</button><div class="link"><p>حساب‌ندارید؟ <a href="/signup.html">ثبت‌نام کنید</a></p></div></div><script>function login(){const phone=document.getElementById('phone').value;const password=document.getElementById('password').value;if(!phone||!password){alert('❌ الزامی');return}fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})}).then(r=>r.json()).then(d=>{if(d.token){localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));window.location.href='/dashboard.html'}else{alert('❌ ناموفق')}}).catch(e=>alert('❌ خطا'))}</script></body></html>`);
});

// Directory Page
app.get('/directory.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>دایرکتوری</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f4f8;font-family:Arial}header{background:#7209b7;color:#fff;padding:20px;text-align:center}h1{font-size:28px}main{padding:15px}input{width:100%;padding:16px;border:2px solid #e0e7ff;border-radius:8px;font-size:18px;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr;gap:15px}.card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);border-left:5px solid #a55eea}.card h2{color:#7209b7;font-size:20px;margin-bottom:10px}.card p{color:#666;font-size:16px;margin:8px 0}.badge{background:#a55eea;color:#fff;padding:8px 12px;border-radius:20px;font-size:14px;display:inline-block;margin-top:10px}.back-btn{background:#7209b7;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:16px}</style></head><body><header><h1>📂 دایرکتوری</h1></header><main><a href="/" class="back-btn">⬅ بازگشت</a><input type="text" id="search" placeholder="جستجو برای نام کسب‌وکار..."><div class="grid" id="grid"><p style="text-align:center;color:#999">در حال بارگذاری...</p></div></main><script>let all=[];fetch('/api/directory').then(r=>r.json()).then(d=>{all=d.businesses;show(all)}).catch(e=>alert('❌ خطا'));function show(b){const grid=document.getElementById('grid');if(!b.length){grid.innerHTML='<p style="text-align:center;color:#999">نتیجه‌ای نیافت</p>';return}grid.innerHTML=b.map(x=>{const p={bronze:'🥉 برنزی',silver:'🥈 نقره‌ای',gold:'🥇 طلایی'};return '<div class="card"><h2>'+x.businessName+'</h2><p>📍 '+x.businessAddress+'</p><p>☎️ '+x.businessPhone+'</p><span class="badge">'+p[x.packageType]+'</span></div>'}).join('')}document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();show(all.filter(x=>x.businessName.toLowerCase().includes(q)))})</script></body></html>`);
});

// Business Request Page
app.get('/business-request.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>درخواست تبلیغ</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f4f8;font-family:Arial;padding:15px}h1{color:#7209b7;font-size:32px;margin-bottom:20px}.container{max-width:500px;margin:0 auto;background:#fff;padding:25px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input,select{display:block;width:100%;padding:16px;margin:15px 0;border:2px solid #e0e7ff;border-radius:8px;font-size:18px}label{display:block;color:#7209b7;font-weight:bold;font-size:16px;margin-top:15px}.price-box{background:#f0f4f8;padding:15px;border-radius:8px;margin:15px 0;text-align:center}.price-value{font-size:28px;font-weight:bold;color:#a55eea}.btn{width:100%;padding:16px;background:#a55eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:25px;font-size:18px}.back-btn{display:inline-block;margin-bottom:15px;background:#999;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:16px}</style></head><body><div class="container"><a href="/" class="back-btn">⬅ بازگشت</a><h1>📝 درخواست تبلیغ</h1><div><label>نام کسب‌وکار</label><input type="text" id="name" placeholder="نام"></div><div><label>شماره تلفن</label><input type="tel" id="phone" placeholder="۰۹XXXXXXXXX"></div><div><label>آدرس</label><input type="text" id="address" placeholder="آدرس (الزامی)"></div><div><label>بسته</label><select id="package" onchange="updatePrice()"><option value="">-- بسته را انتخاب کنید --</option><option value="bronze">🥉 برنزی - ۵M</option><option value="silver">🥈 نقره‌ای - ۱۵M</option><option value="gold">🥇 طلایی - ۴۰M</option></select></div><div class="price-box"><div>قیمت:</div><div class="price-value"><span id="price">۰</span></div></div><div><label>کد معرفی</label><input type="text" id="code" placeholder="کد معرفی (الزامی)"></div><button class="btn" onclick="submit()">✓ تایید</button></div><script>function updatePrice(){const p={bronze:'۵M',silver:'۱۵M',gold:'۴۰M'};document.getElementById('price').textContent=p[document.getElementById('package').value]||'۰'}function submit(){const name=document.getElementById('name').value;const phone=document.getElementById('phone').value;const address=document.getElementById('address').value;const pkg=document.getElementById('package').value;const code=document.getElementById('code').value;if(!name||!phone||!address||!pkg||!code){alert('❌ تمام فیلدها الزامی');return}fetch('/api/business-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessName:name,businessPhone:phone,businessAddress:address,packageType:pkg,referrerCode:code})}).then(r=>r.json()).then(d=>{if(d.message==='OK'){alert('✓ ثبت شد!');window.location.href='/'}else{alert('❌ '+d.message)}}).catch(e=>alert('❌ خطا'))}</script></body></html>`);
});

// Dashboard Page
app.get('/dashboard.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>داشبورد</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f4f8;font-family:Arial}header{background:#7209b7;color:#fff;padding:20px;display:flex;justify-content:space-between;align-items:center}h1{font-size:22px}.container{max-width:800px;margin:15px auto;padding:0 15px}.card{background:#fff;padding:20px;margin-bottom:15px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}.stat{display:grid;grid-template-columns:1fr 1fr;gap:15px}.stat-item{background:#f0f4f8;padding:15px;border-radius:8px}.stat-label{color:#666;font-size:14px}.stat-value{font-size:32px;font-weight:bold;color:#7209b7;margin-top:8px}table{width:100%;border-collapse:collapse}th{background:#f0f4f8;padding:12px;text-align:right;font-weight:bold;border-bottom:2px solid #e0e7ff;font-size:16px}td{padding:12px;border-bottom:1px solid #e0e7ff;font-size:15px}button{background:red;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px}</style></head><body><header><h1>📊 داشبورد</h1><button onclick="logout()">خروج</button></header><div class="container"><div class="card"><div class="stat"><div class="stat-item"><div class="stat-label">درآمد</div><div class="stat-value"><span id="earn">۰</span></div></div><div class="stat-item"><div class="stat-label">درخواست‌ها</div><div class="stat-value"><span id="req">۰</span></div></div></div><p style="color:#666;margin-top:15px;font-size:16px">کد: <strong id="code">-</strong></p></div><div class="card"><h2 style="color:#7209b7;margin-bottom:15px;font-size:20px">درخواست‌ها</h2><table><thead><tr><th>نام</th><th>بسته</th><th>مبلغ</th></tr></thead><tbody id="list"><tr><td colspan="3">بارگذاری...</td></tr></tbody></table></div></div><script>const token=localStorage.getItem('token');const user=JSON.parse(localStorage.getItem('user'))||{};if(!token){window.location.href='/'}fetch('/api/dashboard',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(d=>{document.getElementById('earn').textContent=(d.stats.totalEarnings/1e6).toFixed(0)+'M';document.getElementById('req').textContent=d.stats.requestCount;document.getElementById('code').textContent=user.referralCode||'-'});fetch('/api/requests',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(d=>{const list=document.getElementById('list');if(!d.requests.length){list.innerHTML='<tr><td colspan="3">درخواستی ندارید</td></tr>';return}list.innerHTML=d.requests.map(r=>'<tr><td>'+r.businessName+'</td><td>'+r.packageType+'</td><td>'+(r.amount/1e6).toFixed(0)+'M</td></tr>').join('')});function logout(){localStorage.clear();window.location.href='/'}</script></body></html>`);
});

app.listen(8080, () => {
  console.log('Server running on 8080');
});
