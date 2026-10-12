// LTTQ PTIQ - app.js v1.0 (MINIMAL - Login Only)
// ============================================================
(function(){
'use strict';

// GANTI dengan URL GAS Anda
var GAS_URL = 'https://script.google.com/macros/s/AKfycby_E4w4_-75Xz8BraK-1zQrgo27nDrcZNr_8bYXoR2zwFQlCqVBBl15qPOWPxIaeTMWEQ/exec';

// ============================================================
// API CALL
// ============================================================
async function apiCall(action, data){
  var payload = { action: action, data: data || {} };
  var res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(payload)
  });
  return await res.json();
}

// ============================================================
// LOGIN
// ============================================================
async function doLogin(role){
  var username = document.getElementById(role + 'Username').value.trim();
  var password = document.getElementById(role + 'Password').value;
  var alertEl = document.getElementById('alert' + role);

  // Reset alert
  alertEl.textContent = '';
  alertEl.style.display = 'none';

  if(!username || !password){
    alertEl.textContent = 'Username dan password wajib diisi';
    alertEl.style.display = 'block';
    return;
  }

  var btn = document.getElementById('btn' + role);
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try{
    var res = await apiCall('login', {username: username, password: password, role: role});

    if(res.success){
      // Simpan session
      sessionStorage.setItem('lttq_user', JSON.stringify({
        username: res.username,
        nama: res.nama,
        role: res.role
      }));

      alertEl.textContent = 'Login berhasil! Selamat datang, ' + res.nama;
      alertEl.style.color = '#065f46';
      alertEl.style.background = '#d1fae5';
      alertEl.style.border = '1px solid #a7f3d0';
      alertEl.style.display = 'block';

      // Tampilkan info
      setTimeout(function(){
        document.getElementById('loginBox').style.display = 'none';
        document.getElementById('welcomeBox').style.display = 'block';
        document.getElementById('welcomeName').textContent = res.nama;
        document.getElementById('welcomeRole').textContent = res.role === 'admin' ? 'Administrator' : 'Dosen Penguji';
      }, 800);
    } else {
      alertEl.textContent = res.message || 'Login gagal';
      alertEl.style.display = 'block';
    }
  } catch(e){
    alertEl.textContent = 'Error: ' + e.message;
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
}

// ============================================================
// SWITCH TAB
// ============================================================
function switchTab(role){
  document.getElementById('tabAdmin').classList.toggle('active', role === 'admin');
  document.getElementById('tabDosen').classList.toggle('active', role === 'dosen');
  document.getElementById('panelAdmin').style.display = role === 'admin' ? 'block' : 'none';
  document.getElementById('panelDosen').style.display = role === 'dosen' ? 'block' : 'none';
}

// ============================================================
// LOGOUT
// ============================================================
function doLogout(){
  sessionStorage.removeItem('lttq_user');
  document.getElementById('loginBox').style.display = 'block';
  document.getElementById('welcomeBox').style.display = 'none';
}

// ============================================================
// EXPORT
// ============================================================
window.doLogin = doLogin;
window.switchTab = switchTab;
window.doLogout = doLogout;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function(){
  console.log('✅ LTTQ PTIQ app.js v1.0 (MINIMAL) loaded');
  console.log('GAS_URL:', GAS_URL);

  // Cek session
  var sess = sessionStorage.getItem('lttq_user');
  if(sess){
    var u = JSON.parse(sess);
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('welcomeBox').style.display = 'block';
    document.getElementById('welcomeName').textContent = u.nama;
    document.getElementById('welcomeRole').textContent = u.role === 'admin' ? 'Administrator' : 'Dosen Penguji';
  }
});

})();
