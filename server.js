const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/test');

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>تبلیغ‌یار</title><style>body{background:#0a1f5c;color:#fff;text-align:center;padding:40px;font-family:Arial}h1{font-size:32px}button{background:#2563eb;color:#fff;padding:12px 30px;border:none;border-radius:6px;cursor:pointer;margin:10px}</style></head><body><h1>تبلیغ‌یار 📢</h1><p>دایرکتوری کسب‌وکارها</p><button onclick="alert('ورود')">ورود</button> <button onclick="alert('ثبت‌نام')">ثبت‌نام</button></body></html>`);
});

app.get('/dashboard.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>داشبورد</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#0a1f5c;color:#fff;padding:10px}a{color:#fff;text-decoration:none;margin-right:10px}.card{background:#fff;padding:15px;margin:10px}</style></head><body><header><h1 style="font-size:16px;display:inline">📊 داشبورد</h1><a href="/sales.html">فروش</a><button onclick="logout()" style="float:right;background:red;color:#fff;border:none;cursor:pointer;padding:8px">خروج</button></header><div class="card"><p>درآمد: <span id="s">۰</span></p><p>نام: <span id="n">-</span></p></div><script>fetch('/api/dashboard',{headers:{Authorization:'Bearer '+localStorage.getItem('token')}}).then(e=>e.json()).then(e=>{document.getElementById('s').textContent=Math.floor(e.stats.totalEarnings/1e6)+'M';document.getElementById('n').textContent=e.user.name}).catch(()=>alert('خطا'));function logout(){localStorage.clear();window.location.href='/'}</script></body></html>`);
});

app.get('/sales.html', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>فروش</title><style>*{margin:0;padding:0}body{font-family:Arial;background:#f0f4f8}header{background:#0a1f5c;color:#fff;padding:10px}input{display:block;width:90%;padding:10px;margin:10px auto;border:1px solid #ddd;border-radius:4px}button{width:90%;padding:10px;margin:10px auto;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer}</style></head><body><header><h1 style="font-size:16px">📊 فروش</h1></header><input type="text" id="name" placeholder="نام کسب"><input type="number" id="amount" placeholder="مبلغ"><button onclick="submit()">ثبت</button><a href="/dashboard.html" style="display:block;text-align:center;margin:10px;color:#2563eb">← برگشت</a><script>function submit(){fetch('/api/sales/create',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('token')},body:JSON.stringify({businessName:document.getElementById('name').value,packageType:'custom',amount:parseInt(document.getElementById('amount').value),description:''})}).then(e=>e.json()).then(e=>{alert('✓');document.getElementById('name').value='';document.getElementById('amount').value=''}).catch(()=>alert('خطا'))}</script></body></html>`);
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    res.json({ message: 'OK' });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  res.json({
    user: { name: 'کاربر', phone: '09123456789' },
    stats: { totalEarnings: 1000000 }
  });
});

app.listen(8080, () => {
  console.log('Server running on 8080');
});
