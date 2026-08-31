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
    
    // Validate ALL required fields
    if (!referrerCode || referrerCode.trim() === '') {
      return res.status(400).json({ message: 'کد معرفی الزامی است' });
    }
    
    if (!businessAddress || businessAddress.trim() === '') {
      return res.status(400).json({ message: 'آدرس الزامی است' });
    }
    
    // Find referrer by code
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
    
    // Add earnings to referrer
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

// Pages
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>تبلیغ‌یار</title><style>body{background:#7209b7;color:#fff;text-align:center;padding:40px;font-family:Arial}h1{font-size:32px}.btn{background:#a55eea;color:#fff;padding:12px 30px;border:none;border-radius:6px;cursor:pointer;margin:10px;font-size:14px}</style></head><body><h1>تبلیغ‌یار 📢</h1><p style="font-size:16px;margin-bottom:30px">دایرکتوری کسب‌وکارهای تهران</p><button class="btn" onclick="window.location.href='/directory.html'">📂 مشاهدهی دایرکتوری</button><button class="btn" onclick="window.location.href='/business-request.html'">📝 درخواست تبلیغ</button><button class="btn" onclick="window.location.href='/signup.html'">📋 ثبت‌نام نمایندهی تبلیغات</button><button class="btn" onclick="window.location.href='/login.html'">🔐 ورود نمایندگان تبلیغات</button></body></html>`);
});

app.get('/signup.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ثبت‌نام نمایندهی تبلیغات</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8;padding:20px}h1{color:#7209b7;margin-bottom:20px}.container{max-width:400px;margin:0 auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input{display:block;width:100%;padding:12px;margin:15px 0;border:2px solid #e0e7ff;border-radius:8px;font-size:14px;box-sizing:border-box}label{display:block;color:#7209b7;font-weight:bold;font-size:12px;margin-top:15px}.btn{width:100%;padding:12px;background:#a55eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:20px}.back-btn{display:inline-block;margin-bottom:20px;background:#999;color:#fff;padding:8px 15px;border-radius:6px;text-decoration:none}.info{background:#f0f4f8;padding:15px;border-radius:8px;margin-top:20px;color:#666;font-size:12px}</style></head><body><div class="container"><a href="/" class="back-btn">⬅ بازگشت</a><h1>📋 ثبت‌نام نمایندهی تبلیغات</h1><div><label>نام و نام‌خانوادگی</label><input type="text" id="name" placeholder="نام شما"></div><div><label>شماره تلفن</label><input type="tel" id="phone" placeholder="۰۹XXXXXXXXX"></div><div><label>رمز عبور</label><input type="password" id="password" placeholder="رمز عبور"></div><button class="btn" onclick="signup()">ثبت‌نام</button><div class="info"><p>✅ بعد از ثبت‌نام، داشبورد خود را دریافت خواهید کرد</p><p>✅ کد معرفی خاص خود را برای جذب مشتریان استفاده کنید</p><p>✅ برای هر پرداخت، ۶۵% درآمد دریافت کنید</p></div></div><script>function signup(){const name=document.getElementById('name').value;const phone=document.getElementById('phone').value;const password=document.getElementById('password').value;if(!name||!phone||!password){alert('❌ تمام فیلدها الزامی هستند');return}fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,password})}).then(r=>r.json()).then(d=>{if(d.token){localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));alert('✓ ثبت‌نام موفق! کد معرفی شما:\\n\\n'+d.user.referralCode+'\\n\\nاین کد را برای جذب مشتریان استفاده کنید');window.location.href='/dashboard.html'}else{alert('❌ '+d.message)}}).catch(e=>alert('❌ خطا: '+e.message))}</script></body></html>`);
});

app.get('/login.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ورود فروشنده</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8;padding:20px}h1{color:#7209b7;margin-bottom:20px}.container{max-width:400px;margin:0 auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input{display:block;width:100%;padding:12px;margin:15px 0;border:2px solid #e0e7ff;border-radius:8px;font-size:14px;box-sizing:border-box}label{display:block;color:#7209b7;font-weight:bold;font-size:12px;margin-top:15px}.btn{width:100%;padding:12px;background:#a55eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:20px}.back-btn{display:inline-block;margin-bottom:20px;background:#999;color:#fff;padding:8px 15px;border-radius:6px;text-decoration:none}.link{text-align:center;margin-top:15px;color:#666;font-size:12px}.link a{color:#a55eea;text-decoration:none}</style></head><body><div class="container"><a href="/" class="back-btn">⬅ بازگشت</a><h1>🔐 ورود فروشنده</h1><div><label>شماره تلفن</label><input type="tel" id="phone" placeholder="۰۹XXXXXXXXX"></div><div><label>رمز عبور</label><input type="password" id="password" placeholder="رمز عبور"></div><button class="btn" onclick="login()">ورود</button><div class="link"><p>حساب‌ندارید؟ <a href="/signup.html">ثبت‌نام کنید</a></p></div></div><script>function login(){const phone=document.getElementById('phone').value;const password=document.getElementById('password').value;if(!phone||!password){alert('❌ شماره تلفن و رمز عبور الزامی هستند');return}fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})}).then(r=>r.json()).then(d=>{if(d.token){localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));window.location.href='/dashboard.html'}else{alert('❌ ورود ناموفق: '+d.message)}}).catch(e=>alert('❌ خطا: '+e.message))}</script></body></html>`);
});

app.get('/directory.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>دایرکتوری</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#7209b7;color:#fff;padding:15px;text-align:center}h1{font-size:20px}main{max-width:1000px;margin:20px auto;padding:0 15px}.search-box{background:#fff;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.1)}#searchInput{width:100%;padding:12px;border:2px solid #e0e7ff;border-radius:8px;font-size:14px;box-sizing:border-box}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}.card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);border-left:5px solid #a55eea}.card h2{color:#7209b7;margin-bottom:10px;font-size:18px}.card p{color:#666;margin:8px 0;font-size:14px}.badge{display:inline-block;background:#a55eea;color:#fff;padding:6px 12px;border-radius:20px;margin-top:10px;font-size:12px}.back-btn{background:#7209b7;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;margin-bottom:20px}.no-results{text-align:center;color:#999;padding:30px}</style></head><body><header><h1>📂 دایرکتوری کسب‌وکارهای تهران</h1></header><main><button class="back-btn" onclick="window.location.href='/'">⬅ بازگشت</button><div class="search-box"><input type="text" id="searchInput" placeholder="جستجو برای نام کسب‌وکار..."></div><div class="grid" id="grid"><div style="text-align:center;color:#999">در حال بارگذاری...</div></div></main><script>let allBusinesses=[];fetch('/api/directory').then(r=>r.json()).then(d=>{allBusinesses=d.businesses;displayBusinesses(allBusinesses)}).catch(e=>alert('❌ خطا: '+e.message));document.getElementById('searchInput').addEventListener('input',function(e){const query=e.target.value.toLowerCase();const filtered=allBusinesses.filter(b=>b.businessName.toLowerCase().includes(query));displayBusinesses(filtered)});function displayBusinesses(businesses){const grid=document.getElementById('grid');if(businesses.length===0){grid.innerHTML='<div class="no-results">نتیجه‌ای یافت نشد</div>';return}grid.innerHTML=businesses.map(b=>{const pkg={bronze:'🥉 برنزی',silver:'🥈 نقره‌ای',gold:'🥇 طلایی'};return '<div class="card"><h2>'+b.businessName+'</h2><p>📍 '+b.businessAddress+'</p><p>☎️ '+b.businessPhone+'</p><span class="badge">'+pkg[b.packageType]+'</span></div>'}).join('')}</script></body></html>`);
});

app.get('/business-request.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>درخواست تبلیغ</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8;padding:20px}h1{color:#7209b7;margin-bottom:20px}.container{max-width:500px;margin:0 auto;background:#fff;padding:25px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input,select{display:block;width:100%;padding:12px;margin:10px 0;border:2px solid #e0e7ff;border-radius:8px;font-size:14px}label{display:block;margin-top:15px;color:#7209b7;font-weight:bold;font-size:12px}.price-box{background:#f0f4f8;padding:15px;margin:15px 0;border-radius:8px;text-align:center}.price-value{font-size:24px;font-weight:bold;color:#a55eea}.btn{width:100%;padding:12px;background:#a55eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:15px}.required{color:red}</style></head><body><div class="container"><h1>📝 درخواست تبلیغ</h1><div><label>نام کسب‌وکار <span class="required">*</span></label><input type="text" id="name" placeholder="نام کسب‌وکارتان"></div><div><label>شماره تلفن <span class="required">*</span></label><input type="tel" id="phone" placeholder="۰۹XXXXXXXXX"></div><div><label>آدرس <span class="required">*</span></label><input type="text" id="address" placeholder="آدرس کسب‌وکار (الزامی)"></div><div><label>انتخاب بسته <span class="required">*</span></label><select id="package" onchange="updatePrice()"><option value="">-- بسته را انتخاب کنید --</option><option value="bronze">🥉 برنزی - ۵ میلیون تومان</option><option value="silver">🥈 نقره‌ای - ۱۵ میلیون تومان</option><option value="gold">🥇 طلایی - ۴۰ میلیون تومان</option></select></div><div class="price-box"><div>قیمت:</div><div class="price-value"><span id="price">۰</span></div></div><div><label>کد معرفی <span class="required">*</span></label><input type="text" id="referrerCode" placeholder="کد معرفی نمایندهی تبلیغات (الزامی)"></div><button class="btn" onclick="submitRequest()">✓ تایید و پرداخت</button><p style="text-align:center;color:#999;font-size:12px;margin-top:15px">تمام فیلدهای علامت‌دار (*) الزامی هستند</p></div><script>function updatePrice(){const pkg=document.getElementById('package').value;const prices={bronze:'۵ میلیون',silver:'۱۵ میلیون',gold:'۴۰ میلیون'};document.getElementById('price').textContent=prices[pkg]||'۰'}function submitRequest(){const name=document.getElementById('name').value;const phone=document.getElementById('phone').value;const address=document.getElementById('address').value;const pkg=document.getElementById('package').value;const referrerCode=document.getElementById('referrerCode').value;if(!name||!phone||!address||!pkg||!referrerCode){alert('❌ تمام فیلدهای الزامی را پر کنید');return}fetch('/api/business-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessName:name,businessPhone:phone,businessAddress:address,packageType:pkg,referrerCode:referrerCode})}).then(r=>r.json()).then(d=>{if(d.message==='OK'){alert('✓ درخواست ثبت شد! کسب‌وکارتان به دایرکتوری اضافه شد.');window.location.href='/'}else{alert('❌ '+d.message)}}).catch(e=>{alert('❌ خطا: '+e.message)})}</script></body></html>`);
});

app.get('/dashboard.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>داشبورد نمایندهی تبلیغات</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#7209b7;color:#fff;padding:15px;display:flex;justify-content:space-between;align-items:center}h1{font-size:18px}.container{max-width:800px;margin:20px auto;padding:0 15px}.card{background:#fff;padding:20px;margin-bottom:15px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}.stat{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}.stat-item{background:#f0f4f8;padding:15px;border-radius:8px}.stat-label{color:#666;font-size:12px}.stat-value{font-size:28px;font-weight:bold;color:#7209b7;margin-top:5px}table{width:100%;border-collapse:collapse}th{background:#f0f4f8;padding:10px;text-align:right;font-weight:bold;border-bottom:2px solid #e0e7ff}td{padding:10px;border-bottom:1px solid #e0e7ff}button{background:red;color:#fff;border:none;padding:8px 15px;border-radius:6px;cursor:pointer}</style></head><body><header><h1>📊 داشبورد نمایندهی تبلیغات</h1><button onclick="logout()">خروج</button></header><div class="container"><div class="card"><div class="stat"><div class="stat-item"><div class="stat-label">درآمد کل</div><div class="stat-value"><span id="earnings">۰</span></div></div><div class="stat-item"><div class="stat-label">تعداد درخواست‌ها</div><div class="stat-value"><span id="requestCount">۰</span></div></div></div><p style="color:#666">کد معرفی: <strong id="referralCode">-</strong></p></div><div class="card"><h2 style="color:#7209b7;margin-bottom:15px">درخواست‌های شما</h2><table><thead><tr><th>نام کسب‌وکار</th><th>بسته</th><th>مبلغ</th><th>تاریخ</th></tr></thead><tbody id="requestsTable"><tr><td colspan="4" style="text-align:center;color:#999">در حال بارگذاری...</td></tr></tbody></table></div></div><script>const token=localStorage.getItem('token');const user=JSON.parse(localStorage.getItem('user'))||{};if(!token){window.location.href='/';throw new Error('No token')}function toPersian(n){return n.toString().replace(/\\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}fetch('/api/dashboard',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(d=>{document.getElementById('earnings').textContent=toPersian(Math.floor(d.stats.totalEarnings/1e6))+'M';document.getElementById('requestCount').textContent=toPersian(d.stats.requestCount);document.getElementById('referralCode').textContent=user.referralCode||'-'});fetch('/api/requests',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(d=>{const tbody=document.getElementById('requestsTable');if(d.requests.length===0){tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:#999">درخواستی ندارید</td></tr>';return}tbody.innerHTML=d.requests.map(r=>{const date=new Date(r.createdAt).toLocaleDateString('fa-IR');return '<tr><td>'+r.businessName+'</td><td>'+r.packageType+'</td><td>'+toPersian(Math.floor(r.amount/1e6))+'M</td><td>'+date+'</td></tr>'}).join('')});function logout(){localStorage.clear();window.location.href='/'}</script></body></html>`);
});

app.listen(8080, () => {
  console.log('Server running on 8080');
});
