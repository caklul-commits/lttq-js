// LTTQ PTIQ app.js v1.3
(function(){
'use strict';

var GAS_URL = 'https://script.google.com/macros/s/AKfycby_E4w4_-75Xz8BraK-1zQrgo27nDrcZNr_8bYXoR2zwFQlCqVBBl15qPOWPxIaeTMWEQ/exec';

var currentUser = null;
var currentToken = null;
var allMhsData = [];
var window_daftarDosenData = [];
var debounceTimer = null;
var currentSuratJenis = '';

var ROUTES = {
  'login':{auth:false,admin:false,dosen:false},
  'registrasi':{auth:false,admin:false,dosen:false},
  'daftar':{auth:false,admin:false,dosen:false},
  'dashboard':{auth:true,admin:true,dosen:false},
  'ujian-dosen':{auth:true,admin:false,dosen:true},
  'surat-form':{auth:true,admin:true,dosen:false}
};

// ========== API ==========
async function apiCall(action, data){
  var payload = {action:action, token:currentToken||'', data:data||{}};
  var res = await fetch(GAS_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  return await res.json();
}

// ========== ROUTING ==========
function navigate(route){
  var hash = '#' + route;
  if(window.location.hash !== hash) window.location.hash = hash;
  else handleRoute();
}
function handleRoute(){
  var hash = (window.location.hash || '#login').substring(1).split('?')[0];
  var route = ROUTES[hash] ? hash : 'login';
  if(ROUTES[route].auth && !currentToken){ showToast('Akses Ditolak','Silakan login dulu',true); window.location.hash='#login'; return; }
  if(ROUTES[route].admin && (!currentUser || currentUser.role !== 'admin')){ showToast('Akses Ditolak','Hanya admin',true); window.location.hash = (currentUser && currentUser.role === 'dosen') ? '#ujian-dosen' : '#login'; return; }
  if(ROUTES[route].dosen && (!currentUser || currentUser.role !== 'dosen')){ showToast('Akses Ditolak','Hanya dosen',true); window.location.hash = (currentUser && currentUser.role === 'admin') ? '#dashboard' : '#login'; return; }
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  var target = document.getElementById('page-'+route);
  if(target) target.classList.add('active');
  document.querySelectorAll('.app-nav-menu a[data-nav]').forEach(function(a){
    a.classList.toggle('active', a.getAttribute('data-nav') === route);
  });
  if(route === 'daftar') loadStats();
  if(route === 'dashboard'){ loadDashboard(); dashNav('overview'); }
  if(route === 'ujian-dosen') loadDaftarDosen();
  document.getElementById('appNavMenu').classList.remove('open');
}

// ========== SESSION ==========
function checkSession(){
  try{
    var sess = localStorage.getItem('lttq_session'), tok = localStorage.getItem('lttq_token');
    if(sess && tok){
      currentUser = JSON.parse(sess); currentToken = tok;
      document.getElementById('navLogout').style.display = 'flex';
    }
  }catch(e){}
}
function saveSession(user, token){
  currentUser = user; currentToken = token;
  localStorage.setItem('lttq_session', JSON.stringify(user));
  localStorage.setItem('lttq_token', token);
  document.getElementById('navLogout').style.display = 'flex';
}
function doLogout(){
  if(!confirm('Yakin ingin keluar?')) return;
  currentUser = null; currentToken = null;
  localStorage.removeItem('lttq_session'); localStorage.removeItem('lttq_token');
  document.getElementById('navLogout').style.display = 'none';
  showToast('Logout','Anda telah keluar',false);
  navigate('login');
}

// ========== LOGIN ==========
function switchLoginTab(role){
  document.getElementById('tabLoginAdmin').classList.toggle('active', role === 'admin');
  document.getElementById('tabLoginDosen').classList.toggle('active', role === 'dosen');
  document.getElementById('panelLoginAdmin').classList.toggle('active', role === 'admin');
  document.getElementById('panelLoginDosen').classList.toggle('active', role === 'dosen');
}
async function doLogin(role){
  var username = document.getElementById(role === 'admin' ? 'adminUsername' : 'dosenUsername').value.trim();
  var password = document.getElementById(role === 'admin' ? 'adminPassword' : 'dosenPassword').value;
  var alertId = 'alertLogin' + (role === 'admin' ? 'Admin' : 'Dosen');
  if(!username || !password){ showAlert(alertId,'Username dan password wajib diisi'); return; }
  var btn = document.getElementById(role === 'admin' ? 'btnLoginAdmin' : 'btnLoginDosen');
  btn.disabled = true; btn.innerHTML = 'Memproses...';
  try{
    var res = await apiCall('login', {username:username, password:password, role:role});
    if(res.success){
      saveSession({username:res.username, nama:res.nama, role:res.role}, res.token);
      showToast('Login Berhasil','Selamat datang, '+res.nama, false);
      setTimeout(function(){ navigate(res.role === 'admin' ? 'dashboard' : 'ujian-dosen'); }, 800);
      return;
    }
    showAlert(alertId, res.message || 'Username atau password salah');
  }catch(e){
    showAlert(alertId, 'Gagal terhubung ke server: ' + e.message);
  }finally{
    btn.disabled = false;
    btn.innerHTML = 'Masuk sebagai ' + (role === 'admin' ? 'Admin' : 'Dosen');
  }
}

// ========== REGISTRASI ==========
async function submitRegistrasi(e){
  e.preventDefault();
  var data = {
    nim: document.getElementById('regNIM').value.trim(),
    nama: document.getElementById('regNama').value.trim(),
    tempatLahir: document.getElementById('regTempat').value.trim(),
    tanggalLahir: document.getElementById('regTgl').value,
    fakultas: document.getElementById('regFakultas').value.trim(),
    prodi: document.getElementById('regProdi').value.trim(),
    jenjang: document.getElementById('regJenjang').value,
    programTahfizh: document.getElementById('regProgram').value,
    email: document.getElementById('regEmail').value.trim(),
    wa: document.getElementById('regWA').value.trim()
  };
  if(!data.nim || !data.nama || !data.wa){ showAlert('alertRegistrasi','NIM, Nama, dan WA wajib diisi'); return; }
  var btn = document.getElementById('btnSubmitReg');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try{
    var res = await apiCall('registerMahasiswa', data);
    if(res.success){ showAlert('alertRegistrasi', '✓ ' + res.message, true); document.getElementById('formRegistrasi').reset(); }
    else showAlert('alertRegistrasi', '✗ ' + (res.message || 'Gagal'));
  }catch(e){ showAlert('alertRegistrasi','✗ Gagal terhubung'); }
  finally{ btn.disabled = false; btn.textContent = 'Kirim Pendaftaran'; }
}

// ========== CARI MAHASISWA ==========
function debounceCari(){
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(cariMahasiswa, 400);
}
async function cariMahasiswa(){
  var q = document.getElementById('daftarQuery').value.trim();
  var el = document.getElementById('daftarHasil');
  if(q.length < 2){ el.innerHTML = ''; return; }
  el.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner"></div></div>';
  try{
    var res = await apiCall('cariMahasiswa', {query:q});
    if(!res.success || !res.data || !res.data.length){
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><div>Tidak ada mahasiswa ditemukan</div></div>';
      return;
    }
    el.innerHTML = res.data.map(renderMhsCard).join('');
  }catch(e){
    el.innerHTML = '<div class="empty-state">Gagal mencari data</div>';
  }
}
function renderMhsCard(m){
  var waLink = m.WA ? 'https://wa.me/'+m.WA : '';
  var html = '<div class="mhs-card"><div class="mhs-header">';
  html += '<div class="mhs-nim">'+m.NIM+'</div>';
  html += '<div class="mhs-nama">'+m.Nama+'</div>';
  html += '<div class="mhs-meta">'+(m.Prodi||'-')+' • '+(m.Jenjang||'S1')+' • '+(m.Program||'-')+'</div></div>';
  if(m.WA){
    html += '<div class="kontak-card"><div class="label">📞 Kontak</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">';
    html += '<div><div style="font-size:11px;color:#6b7280;">Nomor WA</div><div style="font-weight:700;font-family:monospace;">'+m.WA+'</div></div>';
    html += '<a href="'+waLink+'" target="_blank" class="btn-wa">Chat WA</a></div></div>';
  }
  html += '<div style="margin-top:14px;"><div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:8px;">Rekapan Ujian</div>';
  html += renderUjianRows(m) + '</div></div>';
  return html;
}
function renderUjianRows(m){
  var rows = [{jenis:'tahsin',tahap:1,label:'Tahsin',nilai:m.ujian.tahsin.nilai,lulus:m.ujian.tahsin.lulus}];
  for(var t=1;t<=4;t++) rows.push({jenis:'marhalah',tahap:t,label:'Marhalah '+t,nilai:m.ujian['marhalah'+t].nilai,lulus:m.ujian['marhalah'+t].lulus});
  for(var t=1;t<=2;t++) rows.push({jenis:'komprehensif',tahap:t,label:'Komprehensif '+t,nilai:m.ujian['komprehensif'+t].nilai,lulus:m.ujian['komprehensif'+t].lulus});
  return rows.map(function(r){
    var cls = r.lulus ? 'lulus' : (r.nilai ? 'belum' : '');
    var status, aksi;
    if(r.lulus){ status = '<span class="badge badge-success">✓ Lulus</span>'; aksi = ''; }
    else if(r.nilai){ status = '<span class="badge badge-danger">✗ Belum Lulus</span>'; aksi = '<button class="btn btn-primary btn-sm" onclick="daftarSatuUjian(\''+m.NIM+'\',\''+r.jenis+'\','+r.tahap+',\''+r.label+'\')">Daftar Ulang</button>'; }
    else{ status = '<span class="badge badge-warning">Belum Ujian</span>'; aksi = '<button class="btn btn-primary btn-sm" onclick="daftarSatuUjian(\''+m.NIM+'\',\''+r.jenis+'\','+r.tahap+',\''+r.label+'\')">Daftar</button>'; }
    return '<div class="ujian-row '+cls+'"><div><span class="ujian-label">'+r.label+'</span>' + (r.nilai?'<span class="ujian-nilai">Nilai: '+r.nilai+'</span>':'') + '</div><div>'+status+' '+aksi+'</div></div>';
  }).join('');
}
async function daftarSatuUjian(nim, jenis, tahap, label){
  if(!confirm('Daftarkan ujian ' + label + ' untuk ' + nim + '?')) return;
  try{
    var res = await apiCall('daftarUjian', {nim:nim, jenisUjian:jenis, tahap:tahap, keterangan:''});
    if(res.success){ showAlert('alertDaftar', '✓ ' + label + ' berhasil didaftarkan!', true); setTimeout(cariMahasiswa, 500); }
    else showAlert('alertDaftar', '✗ ' + (res.message||'Gagal'));
  }catch(e){ showAlert('alertDaftar', '✗ Gagal terhubung'); }
}
async function loadStats(){
  try{
    var res = await apiCall('getLaporan', {});
    if(res.success){
      document.getElementById('statTotal').textContent = res.total||0;
      document.getElementById('statLulusTahsin').textContent = res.lulusTahsin||0;
      document.getElementById('statLulusAll').textContent = res.lulusKeseluruhan||0;
      document.getElementById('statPending').textContent = res.pendingUjian||0;
    }
  }catch(e){}
}

// ========== DASHBOARD ==========
function dashNav(section){
  document.querySelectorAll('.dash-nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nav = document.getElementById('dnav-'+section); if(nav) nav.classList.add('active');
  document.querySelectorAll('.dash-section').forEach(function(s){ s.classList.remove('active'); });
  var sec = document.getElementById('dsec-'+section); if(sec) sec.classList.add('active');
  if(section === 'mahasiswa') loadMahasiswa();
  if(section === 'ujian') loadPendaftaran();
  if(section === 'registrasi') loadRegistrasi();
  if(section === 'overview') loadDashboard();
}
async function loadDashboard(){
  try{
    var results = await Promise.all([
      apiCall('getLaporan',{}).catch(function(){return{success:false};}),
      apiCall('getPendaftaran',{filter:{status:'Menunggu'}}).catch(function(){return{success:false};})
    ]);
    var lap = results[0], pend = results[1];
    if(lap.success){
      document.getElementById('dashTotal').textContent = lap.total||0;
      document.getElementById('dashLulusTahsin').textContent = lap.lulusTahsin||0;
      document.getElementById('dashLulusAll').textContent = lap.lulusKeseluruhan||0;
      document.getElementById('dashRegPending').textContent = lap.registrasiPending||0;
      var chart = document.getElementById('dashProgramChart');
      chart.innerHTML = '';
      var prog = lap.perProgram || {};
      Object.keys(prog).forEach(function(p){
        var d = document.createElement('div');
        d.className = 'stat-card';
        d.innerHTML = '<div class="stat-number">'+(prog[p]||0)+'</div><div class="stat-label">'+p+'</div>';
        chart.appendChild(d);
      });
    }
    if(pend.success){
      document.getElementById('dashPending').textContent = pend.total||0;
      var recent = document.getElementById('dashRecentDaftar');
      if(!pend.data || !pend.data.length) recent.innerHTML = '<div class="empty-state">Tidak ada pendaftaran</div>';
      else recent.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>NIM</th><th>Nama</th><th>Jenis</th><th>Tahap</th></tr></thead><tbody>' +
        pend.data.slice(0,5).map(function(d){ return '<tr><td>'+d.NIM+'</td><td>'+d.Nama+'</td><td>'+d['Jenis Ujian']+'</td><td>'+d.Tahap+'</td></tr>'; }).join('') + '</tbody></table></div>';
    }
  }catch(e){ console.error(e); }
}

// ========== REGISTRASI ADMIN ==========
async function loadRegistrasi(){
  document.getElementById('tbodyRegistrasi').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;"><div class="spinner"></div></td></tr>';
  var status = document.getElementById('filterRegStatus').value;
  try{
    var res = await apiCall('getRegistrasiMhs', {status:status});
    var data = res.data||[];
    if(!data.length){ document.getElementById('tbodyRegistrasi').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#6b7280;">Tidak ada data</td></tr>'; return; }
    document.getElementById('tbodyRegistrasi').innerHTML = data.map(function(r){
      var sc = r.Status === 'Approved' ? 'badge-success' : (r.Status === 'Rejected' ? 'badge-danger' : 'badge-warning');
      var waNorm = String(r['Nomor WA']||'').replace(/[^0-9]/g,'');
      var waLink = waNorm ? 'https://wa.me/'+waNorm : '';
      var aksi = r.Status === 'Pending' ?
        '<button class="btn btn-primary btn-sm" onclick="approveRegistrasi(\''+r.ID+'\')">Setujui</button> <button class="btn btn-danger btn-sm" onclick="rejectRegistrasi(\''+r.ID+'\')">Tolak</button>' :
        '<span style="color:#6b7280;">—</span>';
      return '<tr><td style="font-family:monospace;font-size:11px;">'+r.ID+'</td><td style="font-family:monospace;">'+r.NIM+'</td><td style="font-weight:600;">'+r.Nama+'</td><td>'+(r.Prodi||'—')+'</td><td>'+(waLink ? '<a href="'+waLink+'" target="_blank" class="btn-wa">'+r['Nomor WA']+'</a>' : '—')+'</td><td><span class="badge '+sc+'">'+r.Status+'</span></td><td>'+aksi+'</td></tr>';
    }).join('');
  }catch(e){ document.getElementById('tbodyRegistrasi').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#dc2626;">Gagal memuat</td></tr>'; }
}
async function approveRegistrasi(id){
  if(!confirm('Setujui registrasi ini?')) return;
  try{
    var res = await apiCall('approveRegistrasi', {id:id});
    if(res.success){ showToast('Disetujui', res.message); loadRegistrasi(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}
async function rejectRegistrasi(id){
  if(!confirm('Tolak registrasi ini?')) return;
  try{
    var res = await apiCall('rejectRegistrasi', {id:id});
    if(res.success){ showToast('Ditolak', res.message); loadRegistrasi(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}

// ========== MAHASISWA ==========
async function loadMahasiswa(){
  document.getElementById('tbodyMhs').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;"><div class="spinner"></div></td></tr>';
  try{
    var res = await apiCall('getAllMahasiswa', {});
    allMhsData = res.data||[];
    renderMahasiswa(allMhsData);
  }catch(e){
    document.getElementById('tbodyMhs').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#dc2626;">Gagal memuat</td></tr>';
  }
}
function renderMahasiswa(data){
  if(!data.length){ document.getElementById('tbodyMhs').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#6b7280;">Belum ada data</td></tr>'; return; }
  document.getElementById('tbodyMhs').innerHTML = data.map(function(m){
    var waLink = m.WA ? 'https://wa.me/'+m.WA : '';
    var kontak = m.WA ? '<a href="'+waLink+'" target="_blank" class="btn-wa" style="font-size:11px;">'+m.WA+'</a>' : '—';
    var nT = parseFloat(m.NilaiTahsin)||0;
    var kkm = m.Jenjang === 'S1' ? 90 : 80;
    var status = nT >= kkm ? '<span class="badge badge-success">Lulus</span>' : (nT > 0 ? '<span class="badge badge-warning">Proses</span>' : '<span class="badge badge-danger">Belum</span>');
    return '<tr><td style="font-family:monospace;">'+m.NIM+'</td><td style="font-weight:600;">'+m.Nama+'</td><td>'+kontak+'</td><td>'+(m.Prodi||'—')+'</td><td><span class="badge badge-gold">'+(m.ProgramTahfizh||'Nontahfizh')+'</span></td><td>'+(nT ? '<span class="badge badge-info">Tahsin: '+nT+'</span>' : '—')+'</td><td>'+status+'</td><td><button class="btn btn-outline btn-sm" onclick="bukaTranskrip(\''+m.NIM+'\')">📋</button> <button class="btn btn-outline btn-sm" onclick="openModalMhs(\''+m.NIM+'\')">✏️</button></td></tr>';
  }).join('');
}
function filterMahasiswa(){
  var kw = document.getElementById('searchMhs').value.toLowerCase();
  renderMahasiswa(allMhsData.filter(function(m){ return ((m.NIM||'')+(m.Nama||'')+(m.Prodi||'')).toLowerCase().indexOf(kw) !== -1; }));
}
function openModalMhs(nim){
  if(nim){
    var m = allMhsData.find(function(x){ return x.NIM === nim; });
    if(m){
      document.getElementById('modalMhsTitle').textContent = 'Edit Mahasiswa';
      document.getElementById('mhsNIM').value = m.NIM||''; document.getElementById('mhsNIM').disabled = true;
      document.getElementById('mhsNama').value = m.Nama||'';
      document.getElementById('mhsTempat').value = m.TempatLahir||'';
      document.getElementById('mhsTgl').value = m.TanggalLahir||'';
      document.getElementById('mhsFakultas').value = m.Fakultas||'';
      document.getElementById('mhsProdi').value = m.Prodi||'';
      document.getElementById('mhsEmail').value = '';
      document.getElementById('mhsWA').value = m.WA||'';
      document.getElementById('mhsProgram').value = m.ProgramTahfizh||'Nontahfizh';
      document.getElementById('mhsJenjang').value = m.Jenjang||'S1';
    }
  }else{
    document.getElementById('modalMhsTitle').textContent = 'Tambah Mahasiswa';
    ['mhsNIM','mhsNama','mhsTempat','mhsTgl','mhsFakultas','mhsProdi','mhsEmail','mhsWA'].forEach(function(id){ document.getElementById(id).value = ''; });
    document.getElementById('mhsNIM').disabled = false;
  }
  document.getElementById('modalMhs').classList.add('show');
}
async function saveMahasiswa(){
  var data = {
    nim: document.getElementById('mhsNIM').value.trim(),
    nama: document.getElementById('mhsNama').value.trim(),
    tempatLahir: document.getElementById('mhsTempat').value.trim(),
    tanggalLahir: document.getElementById('mhsTgl').value,
    fakultas: document.getElementById('mhsFakultas').value.trim(),
    prodi: document.getElementById('mhsProdi').value.trim(),
    email: document.getElementById('mhsEmail').value.trim(),
    wa: document.getElementById('mhsWA').value.trim(),
    programTahfizh: document.getElementById('mhsProgram').value,
    jenjang: document.getElementById('mhsJenjang').value
  };
  if(!data.nim || !data.nama){ showToast('Gagal','NIM dan Nama wajib diisi',true); return; }
  try{
    var res = await apiCall('saveMahasiswa', data);
    if(res.success){ showToast('Berhasil', res.message); closeModal('modalMhs'); loadMahasiswa(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}

// ========== MANAJEMEN UJIAN ==========
async function loadPendaftaran(){
  document.getElementById('tbodyUjian').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;"><div class="spinner"></div></td></tr>';
  var filter = {};
  var st = document.getElementById('filterStatusUjian').value;
  var jn = document.getElementById('filterJenisUjian').value;
  if(st) filter.status = st;
  if(jn) filter.jenis = jn;
  try{
    var res = await apiCall('getPendaftaran', {filter:filter});
    var data = res.data||[];
    if(!data.length){ document.getElementById('tbodyUjian').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#6b7280;">Tidak ada data</td></tr>'; return; }
    document.getElementById('tbodyUjian').innerHTML = data.map(function(d){
      var sc = d.Status === 'Selesai' ? 'badge-success' : (d.Status === 'Dijadwalkan' ? 'badge-info' : (d.Status === 'Menunggu' ? 'badge-warning' : 'badge-danger'));
      var action = d.Status === 'Menunggu' ? '<button class="btn btn-primary btn-sm" onclick="openJadwal(\''+d.ID+'\')">📅 Jadwal</button>' : '';
      return '<tr><td style="font-family:monospace;">'+d.NIM+'</td><td style="font-weight:600;">'+d.Nama+'</td><td><span class="badge badge-'+d['Jenis Ujian']+'">'+d['Jenis Ujian']+'</span></td><td>'+d.Tahap+'</td><td><span class="badge '+sc+'">'+d.Status+'</span></td><td>'+(d.Penguji||'—')+'</td><td>'+(d['Tanggal Ujian']||'—')+'</td><td>'+action+'</td></tr>';
    }).join('');
  }catch(e){
    document.getElementById('tbodyUjian').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#dc2626;">Gagal memuat</td></tr>';
  }
}

// ========== OPEN JADWAL (DROPDOWN DOSEN) ==========
function openJadwal(id){
  document.getElementById('jadwalId').value = id;
  document.getElementById('jadwalTgl').value = '';
  document.getElementById('jadwalWaktu').value = '';
  var sel = document.getElementById('jadwalPenguji');
  sel.innerHTML = '<option value="">Memuat daftar dosen...</option>';
  document.getElementById('modalJadwal').classList.add('show');

  apiCall('getDosenList', {}).then(function(res){
    if(res.success && res.data && res.data.length){
      sel.innerHTML = '<option value="">-- Pilih Dosen Penguji --</option>' +
        res.data.map(function(d){ return '<option value="'+d.nama+'">'+d.nama+' ('+d.username+')</option>'; }).join('');
    } else {
      sel.innerHTML = '<option value="">Tidak ada dosen aktif terdaftar</option>';
    }
  }).catch(function(){
    sel.innerHTML = '<option value="">Gagal memuat daftar dosen</option>';
  });
}
async function saveJadwal(){
  var id = document.getElementById('jadwalId').value;
  var penguji = document.getElementById('jadwalPenguji').value.trim();
  var tgl = document.getElementById('jadwalTgl').value;
  var waktu = document.getElementById('jadwalWaktu').value.trim();
  if(!penguji || !tgl){ showToast('Gagal','Penguji dan tanggal wajib diisi',true); return; }
  try{
    var res = await apiCall('jadwalkanUjian', {id:id, penguji:penguji, tanggalUjian:tgl, waktu:waktu});
    if(res.success){ showToast('Berhasil','Ujian dijadwalkan'); closeModal('modalJadwal'); loadPendaftaran(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}

// ========== PORTAL DOSEN ==========
async function loadDaftarDosen(){
  document.getElementById('listUjianDosen').innerHTML = '<div class="spinner"></div>';
  var jenis = document.getElementById('filterJenisDosen').value;
  try{
    var res = await apiCall('getUjianDosen', {username:currentUser.username, jenis:jenis});
    var data = res.data||[];
    window_daftarDosenData = data;
    if(!data.length){
      document.getElementById('listUjianDosen').innerHTML = '<div class="card"><div class="empty-state"><div class="icon">📭</div>Tidak ada peserta ujian yang ditugaskan</div></div>';
      return;
    }
    document.getElementById('listUjianDosen').innerHTML = data.map(function(d,idx){
      var jk = d['Jenis Ujian']||'';
      var waLink = d.WA ? 'https://wa.me/'+d.WA : '';
      return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
        '<div><div style="font-family:monospace;font-size:11px;color:#6b7280;">'+d.NIM+'</div>' +
        '<div style="font-weight:700;font-size:15px;">'+d.Nama+'</div>' +
        '<div style="margin-top:6px;"><span class="badge badge-'+jk+'">'+jk+' Tahap '+d.Tahap+'</span> ' +
        '<span style="font-size:11px;color:#6b7280;">'+(d.Jenjang||'S1')+' | '+(d['Program Tahfizh']||'—')+'</span></div></div>' +
        '<div style="text-align:right;">' + (waLink ? '<a href="'+waLink+'" target="_blank" class="btn-wa">Chat WA</a>' : '') +
        '<div style="font-size:11px;color:#6b7280;margin-top:8px;">WA: '+(d.WA||'—')+'</div></div></div>' +
        '<div style="margin-top:14px;"><button class="btn btn-primary" onclick="openInputNilai('+idx+')">✏️ Input Nilai</button></div></div>';
    }).join('');
  }catch(e){
    document.getElementById('listUjianDosen').innerHTML = '<div class="card"><div class="empty-state">Gagal memuat data</div></div>';
  }
}
function openInputNilai(idx){
  var d = window_daftarDosenData[idx]; if(!d) return;
  document.getElementById('nilaiId').value = d.ID;
  document.getElementById('nilaiJenjang').value = d.Jenjang||'S1';
  document.getElementById('nilaiJenis').value = d['Jenis Ujian'];
  var jenis = d['Jenis Ujian'], jenjang = d.Jenjang||'S1';
  var kkm = jenis === 'tahsin' ? (jenjang === 'S1' ? 90 : 80) : 70;
  document.getElementById('nilaiPesertaInfo').innerHTML = '<strong>'+d.Nama+'</strong> ('+d.NIM+')<br>Jenis: '+jenis+' Tahap '+d.Tahap+'<br>Jenjang: '+jenjang;
  document.getElementById('kkmInfo').textContent = 'KKM: '+kkm;
  document.getElementById('nilaiInput').value = '';
  document.getElementById('nilaiCatatan').value = '';
  document.getElementById('nilaiPreview').classList.remove('show');
  document.getElementById('modalNilai').classList.add('show');
}
function cekKKM(){
  var val = parseFloat(document.getElementById('nilaiInput').value)||0;
  var jenis = document.getElementById('nilaiJenis').value;
  var jenjang = document.getElementById('nilaiJenjang').value;
  var kkm = jenis === 'tahsin' ? (jenjang === 'S1' ? 90 : 80) : 70;
  var lulus = val >= kkm;
  var prev = document.getElementById('nilaiPreview');
  prev.className = 'alert show ' + (lulus ? 'alert-success' : 'alert-error');
  prev.textContent = (lulus ? '✓ Lulus' : '✗ Belum Lulus')+' — Nilai: '+val+' | KKM: '+kkm;
}
async function submitNilai(){
  var id = document.getElementById('nilaiId').value;
  var nilai = parseFloat(document.getElementById('nilaiInput').value);
  var catatan = document.getElementById('nilaiCatatan').value.trim();
  if(isNaN(nilai) || nilai < 0 || nilai > 100){ showToast('Nilai Tidak Valid','0-100',true); return; }
  var btn = document.getElementById('btnSubmitNilai');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try{
    var res = await apiCall('inputNilai', {id:id, nilai:nilai, catatan:catatan, penguji:currentUser.nama});
    if(res.success){ showToast('Berhasil','Nilai tersimpan: '+nilai); closeModal('modalNilai'); loadDaftarDosen(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
  finally{ btn.disabled = false; btn.textContent = 'Simpan Nilai'; }
}

// ========== PERSURATAN ==========
function openSuratForm(jenis){
  currentSuratJenis = jenis;
  var titles = {undangan:'Surat Undangan',tugas:'Surat Tugas',keterangan:'Surat Keterangan',keputusan:'Surat Keputusan',permohonan:'Surat Permohonan'};
  document.getElementById('suratFormTitle').textContent = titles[jenis]||'Buat Surat';
  document.getElementById('suratPerihal').value = '';
  document.getElementById('suratFields').innerHTML = buildSuratFields(jenis);
  navigate('surat-form');
}
function buildSuratFields(jenis){
  var fg = function(l,i,t){
    t = t||'text';
    return t === 'textarea' ? '<div class="form-group"><label class="form-label">'+l+'</label><textarea class="form-textarea" id="'+i+'"></textarea></div>' : '<div class="form-group"><label class="form-label">'+l+'</label><input class="form-input" id="'+i+'" type="'+t+'"/></div>';
  };
  if(jenis === 'undangan') return fg('Kepada','sf-kepada')+fg('Hari','sf-hari')+fg('Tanggal','sf-tanggal','date')+fg('Waktu','sf-waktu')+fg('Tempat','sf-tempat')+fg('Agenda','sf-agenda','textarea');
  if(jenis === 'tugas') return fg('Nama','sf-nama')+fg('NIP','sf-nip')+fg('Jabatan','sf-jabatan')+fg('Hari','sf-hari')+fg('Tanggal','sf-tanggal','date')+fg('Waktu','sf-waktu')+fg('Tempat','sf-tempat');
  if(jenis === 'keterangan') return fg('NIM','sf-nim')+fg('Nama','sf-nama')+fg('Fakultas','sf-fakultas')+fg('Prodi','sf-prodi')+fg('Keterangan','sf-keterangan','textarea');
  if(jenis === 'keputusan') return fg('Menimbang','sf-menimbang','textarea')+fg('Mengingat','sf-mengingat','textarea')+fg('Menetapkan','sf-menetapkan')+fg('Pertama','sf-pertama','textarea')+fg('Kedua','sf-kedua','textarea');
  if(jenis === 'permohonan') return fg('Kepada','sf-kepada')+fg('Isi','sf-isi','textarea');
  return '';
}
async function previewSurat(){
  var data = {jenis:currentSuratJenis, perihal:document.getElementById('suratPerihal').value.trim()};
  document.querySelectorAll('#suratFields input, #suratFields textarea').forEach(function(el){ data[el.id.replace('sf-','')] = el.value.trim(); });
  if(!data.perihal){ showAlert('alertSurat','Perihal wajib diisi'); return; }
  try{
    var res = await apiCall('buatSurat', {data:data, preview:true});
    if(res.success){ var w = window.open('','_blank'); w.document.write(res.html); w.document.close(); }
    else showAlert('alertSurat', res.message||'Gagal');
  }catch(e){ showAlert('alertSurat','Gagal terhubung'); }
}
async function simpanSurat(){
  var data = {jenis:currentSuratJenis, perihal:document.getElementById('suratPerihal').value.trim()};
  document.querySelectorAll('#suratFields input, #suratFields textarea').forEach(function(el){ data[el.id.replace('sf-','')] = el.value.trim(); });
  if(!data.perihal){ showAlert('alertSurat','Perihal wajib diisi'); return; }
  try{
    var res = await apiCall('buatSurat', {data:data});
    if(res.success) showAlert('alertSurat','✓ Nomor: '+res.nomorSurat, true);
    else showAlert('alertSurat', res.message||'Gagal');
  }catch(e){ showAlert('alertSurat','Gagal terhubung'); }
}

// ========== TRANSKRIP & SERTIFIKAT ==========
async function bukaTranskrip(nim){
  var n = nim || document.getElementById('transkripNIM').value.trim();
  if(!n){ showToast('Peringatan','Masukkan NIM',true); return; }
  try{
    var res = await apiCall('getTranskrip', {nim:n});
    if(res.success){ var w = window.open('','_blank'); w.document.write(res.html); w.document.close(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}
async function bukaSertifikat(){
  var nim = document.getElementById('sertifikatNIM').value.trim();
  if(!nim){ showToast('Peringatan','Masukkan NIM',true); return; }
  try{
    var res = await apiCall('getSertifikat', {nim:nim});
    if(res.success){ var w = window.open('','_blank'); w.document.write(res.html); w.document.close(); }
    else showToast('Tidak Dapat Dicetak', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}

// ========== UTILS ==========
function showAlert(id, msg, ok){
  var el = document.getElementById(id); if(!el) return;
  el.textContent = msg;
  el.className = 'alert show ' + (ok ? 'alert-success' : 'alert-error');
  setTimeout(function(){ el.classList.remove('show'); }, 5000);
}
function showToast(title, msg, err){
  var t = document.getElementById('appToast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMsg').textContent = msg;
  t.className = 'toast show' + (err ? ' error' : '');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(function(){ t.classList.remove('show'); }, 4000);
}
function closeModal(id){ var el = document.getElementById(id); if(el) el.classList.remove('show'); }
function toggleMobileMenu(){ document.getElementById('appNavMenu').classList.toggle('open'); }

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function(){
  checkSession();
  if(currentToken && (!window.location.hash || window.location.hash === '#login')){
    window.location.hash = currentUser.role === 'admin' ? '#dashboard' : '#ujian-dosen';
  }
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  document.querySelectorAll('.app-nav-menu a[data-nav]').forEach(function(a){
    a.addEventListener('click', function(){ document.getElementById('appNavMenu').classList.remove('open'); });
  });
  console.log('✅ LTTQ PTIQ v1.3 loaded');
});

// Export
['navigate','switchLoginTab','doLogin','doLogout','submitRegistrasi','debounceCari','cariMahasiswa','daftarSatuUjian','dashNav','loadMahasiswa','filterMahasiswa','openModalMhs','saveMahasiswa','loadRegistrasi','approveRegistrasi','rejectRegistrasi','loadPendaftaran','openJadwal','saveJadwal','loadDaftarDosen','openInputNilai','cekKKM','submitNilai','openSuratForm','previewSurat','simpanSurat','bukaTranskrip','bukaSertifikat','closeModal','toggleMobileMenu'].forEach(function(fn){
  window[fn] = eval(fn);
});

})();
