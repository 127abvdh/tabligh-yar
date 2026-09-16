const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// MongoDB Connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://azam71farahani_db_user:VnI4CipodA1GMfgV@cluster0.zrmkmdc.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URL)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  password: String,
  referralCode: String,
  totalEarnings: { type: Number, default: 0 },
  level: { type: String, default: 'Seller' },
  teamEarnings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const businessRequestSchema = new mongoose.Schema({
  businessName: String,
  businessPhone: String,
  businessAddress: String,
  packageType: String,
  amount: Number,
  referrerUserId: String,
  referrerCode: String,
  paymentStatus: { type: String, default: 'pending' },
  refId: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const BusinessRequest = mongoose.model('BusinessRequest', businessRequestSchema);

// Constants
const BANK_IBAN = 'IR360190000000216518589002';
const BANK_NAME = 'بانک صادرات';
const COMMISSION_RATE = 0.65;
const LEVEL1_RATE = 0.10;
const LEVEL2_RATE = 0.03;
const LEVEL3_RATE = 0.02;

const LEVELS = {
  'Seller': 0,
  'Manager': 100000000,
  'Leader': 200000000,
  'TopLeader': 350000000,
  'TopEarner': 500000000,
  'SiteLeader': 750000000
};

const PACKAGES = {
  'bronze': 5000000,
  'silver': 15000000,
  'gold': 40000000
};

// Helper Functions
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function calculateLevel(earnings) {
  if (earnings >= LEVELS.SiteLeader) return 'Site Leader';
  if (earnings >= LEVELS.TopEarner) return 'Top Earner';
  if (earnings >= LEVELS.TopLeader) return 'Top Leader';
  if (earnings >= LEVELS.Leader) return 'Leader';
  if (earnings >= LEVELS.Manager) return 'Manager';
  return 'Seller';
}

// HTML Pages
const landingPage = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تبلیغ‌یار - پلتفرم تبلیغات دیجیتال</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; color: white; max-width: 800px; padding: 20px; }
    h1 { font-size: 3em; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
    p { font-size: 1.2em; margin-bottom: 30px; opacity: 0.95; }
    .buttons { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
    button { padding: 15px 30px; font-size: 1.1em; border: none; border-radius: 8px; cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; font-weight: bold; }
    .btn-directory { background: white; color: #1e3a8a; }
    .btn-directory:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
    .btn-request { background: #10b981; color: white; }
    .btn-request:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
    .btn-signup { background: #f59e0b; color: white; }
    .btn-signup:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
    .btn-login { background: #8b5cf6; color: white; }
    .btn-login:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 تبلیغ‌یار</h1>
    <p>پلتفرم تبلیغات دیجیتال و فروش تیمی</p>
    <div class="buttons">
      <button class="btn-directory" onclick="window.location.href='/directory.html'">📁 دایرکتوری کسب‌وکارها</button>
      <button class="btn-request" onclick="window.location.href='/business-request.html'">📝 درخواست تبلیغ</button>
      <button class="btn-signup" onclick="window.location.href='/signup.html'">📝 ثبت‌نام نماینده</button>
      <button class="btn-login" onclick="window.location.href='/login.html'">🔓 ورود نماینده</button>
    </div>
  </div>
</body>
</html>
`;

const signupPage = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ثبت‌نام - تبلیغ‌یار</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; width: 100%; }
    h1 { text-align: center; color: #1e3a8a; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #333; margin-bottom: 8px; font-weight: bold; }
    input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
    input:focus { outline: none; border-color: #3b82f6; }
    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer; font-weight: bold; margin-top: 20px; }
    button:hover { background: #1e3a8a; }
    .link { text-align: center; margin-top: 20px; }
    a { color: #3b82f6; text-decoration: none; }
    .message { padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .success { background: #d1fae5; color: #065f46; }
    .error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ثبت‌نام نماینده</h1>
    <div id="message"></div>
    <form id="signupForm">
      <div class="form-group">
        <label>نام و نام خانوادگی:</label>
        <input type="text" id="name" required placeholder="نام خود را وارد کنید">
      </div>
      <div class="form-group">
        <label>شماره تلفن:</label>
        <input type="tel" id="phone" required placeholder="۰۹xxxxxxxxx">
      </div>
      <div class="form-group">
        <label>رمز عبور:</label>
        <input type="password" id="password" required placeholder="رمز خود را وارد کنید">
      </div>
      <button type="submit">ثبت‌نام</button>
    </form>
    <div class="link">
      <p>قبلاً حساب دارید؟ <a href="/login.html">وارد شوید</a></p>
    </div>
  </div>
  <script>
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const phone = document.getElementById('phone').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, password })
        });
        const data = await response.json();
        
        const msgDiv = document.getElementById('message');
        if (response.ok) {
          msgDiv.className = 'message success';
          msgDiv.textContent = '✅ ثبت‌نام موفق! رمز عبور شما: ' + data.tempPassword;
          setTimeout(() => window.location.href = '/login.html', 3000);
        } else {
          msgDiv.className = 'message error';
          msgDiv.textContent = '❌ ' + (data.message || 'خطا در ثبت‌نام');
        }
      } catch (err) {
        document.getElementById('message').className = 'message error';
        document.getElementById('message').textContent = '❌ خطا در اتصال';
      }
    });
  </script>
</body>
</html>
`;

const loginPage = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ورود - تبلیغ‌یار</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; width: 100%; }
    h1 { text-align: center; color: #1e3a8a; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #333; margin-bottom: 8px; font-weight: bold; }
    input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
    input:focus { outline: none; border-color: #3b82f6; }
    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer; font-weight: bold; margin-top: 20px; }
    button:hover { background: #1e3a8a; }
    .link { text-align: center; margin-top: 20px; }
    a { color: #3b82f6; text-decoration: none; }
    .message { padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .success { background: #d1fae5; color: #065f46; }
    .error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ورود نماینده</h1>
    <div id="message"></div>
    <form id="loginForm">
      <div class="form-group">
        <label>شماره تلفن:</label>
        <input type="tel" id="phone" required placeholder="۰۹xxxxxxxxx">
      </div>
      <div class="form-group">
        <label>رمز عبور:</label>
        <input type="password" id="password" required placeholder="رمز خود را وارد کنید">
      </div>
      <button type="submit">ورود</button>
    </form>
    <div class="link">
      <p>حساب ندارید؟ <a href="/signup.html">ثبت‌نام کنید</a></p>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('phone').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });
        const data = await response.json();
        
        const msgDiv = document.getElementById('message');
        if (response.ok) {
          localStorage.setItem('token', data.token);
          msgDiv.className = 'message success';
          msgDiv.textContent = '✅ ورود موفق!';
          setTimeout(() => window.location.href = '/dashboard.html', 2000);
        } else {
          msgDiv.className = 'message error';
          msgDiv.textContent = '❌ ' + (data.message || 'خطا در ورود');
        }
      } catch (err) {
        document.getElementById('message').className = 'message error';
        document.getElementById('message').textContent = '❌ خطا در اتصال';
      }
    });
  </script>
</body>
</html>
`;

const dashboardPage = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>داشبورد - تبلیغ‌یار</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; }
    h1 { font-size: 2.5em; margin-bottom: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
    .stat-box { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .stat-number { font-size: 2em; font-weight: bold; color: #1e3a8a; }
    .stat-label { color: #666; margin-top: 10px; }
    .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    button { padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em; font-weight: bold; }
    button:hover { background: #1e3a8a; }
    table { width: 100%; background: white; border-collapse: collapse; border-radius: 10px; overflow: hidden; }
    th, td { padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb; }
    th { background: #1e3a8a; color: white; font-weight: bold; }
    tr:hover { background: #f9fafb; }
    .logout-btn { background: #ef4444; }
    .logout-btn:hover { background: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 id="userName">داشبورد</h1>
          <p id="userLevel">سطح: Seller</p>
        </div>
        <button class="logout-btn" onclick="logout()">خروج</button>
      </div>
    </div>
    
    <div class="stats">
      <div class="stat-box">
        <div class="stat-number" id="earnings">0</div>
        <div class="stat-label">درآمد کل (ریال)</div>
      </div>
      <div class="stat-box">
        <div class="stat-number" id="requests">0</div>
        <div class="stat-label">درخواست‌های شما</div>
      </div>
      <div class="stat-box">
        <div class="stat-number" id="referralCode">-</div>
        <div class="stat-label">کد معرفی</div>
      </div>
    </div>

    <div class="actions">
      <button onclick="window.location.href='/'">بازگشت به صفحه اصلی</button>
      <button onclick="window.location.href='/directory.html'">مشاهده دایرکتوری</button>
      <button onclick="copyReferralCode()">کپی کد معرفی</button>
    </div>

    <h2 style="margin-bottom: 20px; color: #1e3a8a;">درخواست‌های شما</h2>
    <table>
      <thead>
        <tr>
          <th>نام کسب‌وکار</th>
          <th>بسته</th>
          <th>مبلغ (ریال)</th>
          <th>کمیشن (۶۵%)</th>
          <th>وضعیت</th>
          <th>تاریخ</th>
        </tr>
      </thead>
      <tbody id="requestsTable">
      </tbody>
    </table>
  </div>

  <script>
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/login.html';

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await response.json();
        
        document.getElementById('userName').textContent = data.user.name;
        document.getElementById('userLevel').textContent = 'سطح: ' + data.user.level;
        document.getElementById('earnings').textContent = data.user.totalEarnings.toLocaleString('fa-IR');
        document.getElementById('requests').textContent = data.requests.length;
        document.getElementById('referralCode').textContent = data.user.referralCode;

        const tbody = document.getElementById('requestsTable');
        tbody.innerHTML = data.requests.map(req => `
          <tr>
            <td>${req.businessName}</td>
            <td>${req.packageType}</td>
            <td>${req.amount.toLocaleString('fa-IR')}</td>
            <td>${Math.round(req.amount * 0.65).toLocaleString('fa-IR')}</td>
            <td>${req.paymentStatus === 'completed' ? '✅ تکمیل' : '⏳ درحال بررسی'}</td>
            <td>${new Date(req.createdAt).toLocaleDateString('fa-IR')}</td>
          </tr>
        `).join('');
      } catch (err) {
        alert('خطا در بارگزاری داشبورد');
      }
    }

    function copyReferralCode() {
      const code = document.getElementById('referralCode').textContent;
      navigator.clipboard.writeText(code);
      alert('✅ کد معرفی کپی شد!');
    }

    function logout() {
      localStorage.removeItem('token');
      window.location.href = '/';
    }

    loadDashboard();
  </script>
</body>
</html>
`;

const directoryPage = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>دایرکتوری - تبلیغ‌یار</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; }
    h1 { font-size: 2.5em; margin-bottom: 20px; }
    .search-box { display: flex; gap: 10px; margin-bottom: 30px; }
    input { flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
    button { padding: 12px 30px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
    button:hover { background: #1e3a8a; }
    .businesses { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .business-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .business-name { font-size: 1.5em; color: #1e3a8a; margin-bottom: 10px; font-weight: bold; }
    .business-info { color: #666; margin: 10px 0; }
    .badge { display: inline-block; padding: 5px 10px; background: #3b82f6; color: white; border-radius: 5px; font-size: 0.9em; margin-top: 10px; }
    .home-btn { background: #10b981; }
    .home-btn:hover { background: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📁 دایرکتوری کسب‌وکارها</h1>
      <button class="home-btn" onclick="window.location.href='/'">بازگشت به صفحه اصلی</button>
    </div>

    <div class="search-box">
      <input type="text" id="searchInput" placeholder="جستجو کسب‌وکار...">
      <button onclick="search()">جستجو</button>
    </div>

    <div class="businesses" id="businessesContainer">
    </div>
  </div>

  <script>
    async function loadBusinesses(query = '') {
      try {
        const response = await fetch('/api/directory?search=' + query);
        const businesses = await response.json();
        
        const container = document.getElementById('businessesContainer');
        container.innerHTML = businesses.map(b => `
          <div class="business-card">
            <div class="business-name">${b.businessName}</div>
            <div class="business-info">📍 ${b.businessAddress}</div>
            <div class="business-info">📞 ${b.businessPhone}</div>
            <span class="badge">${b.packageType.toUpperCase()}</span>
          </div>
        `).join('');
      } catch (err) {
        alert('خطا در بارگزاری دایرکتوری');
      }
    }

    function search() {
      const query = document.getElementById('searchInput').value;
      loadBusinesses(query);
    }

    loadBusinesses();
  </script>
</body>
</html>
`;

const businessRequestPage = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>درخواست تبلیغ - تبلیغ‌یار</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 500px; width: 100%; }
    h1 { text-align: center; color: #1e3a8a; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #333; margin-bottom: 8px; font-weight: bold; }
    input, select { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
    input:focus, select:focus { outline: none; border-color: #3b82f6; }
    .price-info { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .iban-info { background: #dcfce7; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; color: #166534; }
    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer; font-weight: bold; }
    button:hover { background: #1e3a8a; }
    .link { text-align: center; margin-top: 20px; }
    a { color: #3b82f6; text-decoration: none; }
    .message { padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .success { background: #d1fae5; color: #065f46; }
    .error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 درخواست تبلیغ</h1>
    <div id="message"></div>

    <div class="iban-info">
      ✅ حساب تماس: ${BANK_IBAN}<br>
      بانک: ${BANK_NAME}
    </div>

    <form id="requestForm">
      <div class="form-group">
        <label>نام کسب‌وکار:</label>
        <input type="text" id="businessName" required placeholder="نام کسب‌وکار">
      </div>

      <div class="form-group">
        <label>شماره تلفن:</label>
        <input type="tel" id="businessPhone" required placeholder="۰۹xxxxxxxxx">
      </div>

      <div class="form-group">
        <label>آدرس:</label>
        <input type="text" id="businessAddress" required placeholder="آدرس">
      </div>

      <div class="form-group">
        <label>انتخاب بسته:</label>
        <select id="packageType" required onchange="updatePrice()">
          <option value="">انتخاب کنید</option>
          <option value="bronze">Bronze - 5,000,000 ریال</option>
          <option value="silver">Silver - 15,000,000 ریال</option>
          <option value="gold">Gold - 40,000,000 ریال</option>
        </select>
      </div>

      <div class="price-info">
        قیمت نهایی: <strong id="finalPrice">0</strong> ریال
      </div>

      <div class="form-group">
        <label>کد معرفی (اختیاری):</label>
        <input type="text" id="referrerCode" placeholder="کد معرفی نماینده">
      </div>

      <button type="submit">ارسال درخواست</button>
    </form>

    <div class="link">
      <a href="/">بازگشت به صفحه اصلی</a>
    </div>
  </div>

  <script>
    function updatePrice() {
      const pkg = document.getElementById('packageType').value;
      const prices = { bronze: 5000000, silver: 15000000, gold: 40000000 };
      const price = prices[pkg] || 0;
      document.getElementById('finalPrice').textContent = price.toLocaleString('fa-IR');
    }

    document.getElementById('requestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const businessName = document.getElementById('businessName').value;
      const businessPhone = document.getElementById('businessPhone').value;
      const businessAddress = document.getElementById('businessAddress').value;
      const packageType = document.getElementById('packageType').value;
      const referrerCode = document.getElementById('referrerCode').value;

      const prices = { bronze: 5000000, silver: 15000000, gold: 40000000 };
      const amount = prices[packageType];

      try {
        const response = await fetch('/api/business-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName, businessPhone, businessAddress, packageType, amount, referrerCode })
        });
        const data = await response.json();

        const msgDiv = document.getElementById('message');
        if (response.ok) {
          msgDiv.className = 'message success';
          msgDiv.textContent = '✅ درخواست ثبت شد! شماره درخواست: ' + data.requestId;
          document.getElementById('requestForm').reset();
          updatePrice();
        } else {
          msgDiv.className = 'message error';
          msgDiv.textContent = '❌ ' + (data.message || 'خطا در ثبت درخواست');
        }
      } catch (err) {
        document.getElementById('message').className = 'message error';
        document.getElementById('message').textContent = '❌ خطا در اتصال';
      }
    });
  </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => res.send(landingPage));
app.get('/signup.html', (req, res) => res.send(signupPage));
app.get('/login.html', (req, res) => res.send(loginPage));
app.get('/dashboard.html', (req, res) => res.send(dashboardPage));
app.get('/directory.html', (req, res) => res.send(directoryPage));
app.get('/business-request.html', (req, res) => res.send(businessRequestPage));

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    
    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'کاربر قبلاً ثبت‌نام شده' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = generateReferralCode();
    
    const user = new User({ name, phone, password: hashedPassword, referralCode });
    await user.save();

    res.json({ message: 'ثبت‌نام موفق', tempPassword: password });
  } catch (err) {
    res.status(500).json({ message: 'خطا سرور' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: 'کاربر یافت نشد' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'رمز عبور اشتباه' });

    const token = jwt.sign({ userId: user._id }, 'your-secret-key', { expiresIn: '30d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'خطا سرور' });
  }
});

// Dashboard Route
app.get('/api/dashboard', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, 'your-secret-key');
    
    const user = await User.findById(decoded.userId);
    const requests = await BusinessRequest.find({ referrerUserId: user._id });

    res.json({ user, requests });
  } catch (err) {
    res.status(401).json({ message: 'غیرمجاز' });
  }
});

// Business Request Route
app.post('/api/business-request', async (req, res) => {
  try {
    const { businessName, businessPhone, businessAddress, packageType, amount, referrerCode } = req.body;

    let referrerUser = null;
    if (referrerCode) {
      referrerUser = await User.findOne({ referralCode: referrerCode });
    }

    const request = new BusinessRequest({
      businessName,
      businessPhone,
      businessAddress,
      packageType,
      amount,
      referrerUserId: referrerUser?._id,
      referrerCode,
      paymentStatus: 'pending'
    });
    await request.save();

    // اگر Referrer باشد، کمیشن اضافه کن
    if (referrerUser) {
      referrerUser.totalEarnings += Math.round(amount * COMMISSION_RATE);
      referrerUser.level = calculateLevel(referrerUser.totalEarnings);
      await referrerUser.save();
    }

    res.json({ requestId: request._id, message: 'درخواست ثبت شد' });
  } catch (err) {
    res.status(500).json({ message: 'خطا سرور' });
  }
});

// Directory Route
app.get('/api/directory', async (req, res) => {
  try {
    const search = req.query.search || '';
    const requests = await BusinessRequest.find({
      businessName: { $regex: search, $options: 'i' },
      paymentStatus: 'completed'
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'خطا سرور' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('تبلیغ‌یار سرور فعال است:', PORT);
});
