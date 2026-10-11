// ============================================================
// LTTQ PTIQ - Frontend Application
// Version: 1.2
// ============================================================
(function(){
'use strict';

var GAS_URL = 'https://script.google.com/macros/s/AKfycby6-xwNwHUyAlfpNPoXBalboarI3RnF9F4x78ZZmx3Yo3s-Rc8SZ6OYi4AGS0VzqdA/exec';
var SESSION_KEY = 'lttq_session';
var TOKEN_KEY = 'lttq_token';

var currentUser = null, currentToken = null;
var selectedJenis = '', selectedTahap = 1;
var currentSuratJenis = '';
var allMhsData = [];
var window_daftarDosenData = [];
var debounceTimer = null;

var ROUTES = {
  'login':{requiresAuth:false,requiresAdmin:false,requiresDosen:false},
  'registrasi':{requiresAuth:false,requiresAdmin:false,requiresDosen:false},
  'daftar':{requiresAuth:false,requiresAdmin:false,requiresDosen:false},
  'dashboard':{requiresAuth:true,requiresAdmin:true,requiresDosen:false},
  'ujian-dosen':{requiresAuth:true,requiresAdmin:false,requiresDosen:true},
  'surat-form':{requiresAuth:true,requiresAdmin:true,requiresDosen:false}
};

function navigate(route){
  var hash = '#' + route;
  if(window.location.hash !== hash) window.location.hash = hash;
  else handleRoute();
}

function handleRoute(){
  var hash = (window.location.hash || '#login').substring(1).split('?')[0];
  var route = ROUTES[hash] ? hash : 'login';
  if(ROUTES[route].requiresAuth && !currentToken){
    showToast('Akses Ditolak','Silakan login dulu',true);
    window.location.hash='#login'; return;
  }
  if(ROUTES[route].requiresAdmin && (!currentUser || currentUser.role !== 'admin')){
    showToast('Akses Ditolak','Hanya admin',true);
    window.location.hash = (currentUser && currentUser.role === 'dosen') ? '#ujian-dosen' : '#login';
    return;
  }
  if(ROUTES[route].requiresDosen && (!currentUser || currentUser.role !== 'dosen')){
    showToast('Akses Ditolak','Hanya dosen',true);
    window.location.hash = (currentUser && currentUser.role === 'admin') ? '#dashboard' : '#login';
    return;
  }
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

function checkSession(){
  try{
    var sess = localStorage.getItem(SESSION_KEY);
    var tok = localStorage.getItem(TOKEN_KEY);
    if(sess && tok){
      currentUser = JSON.parse(sess);
      currentToken = tok;
      document.getElementById('navLogout').style.display = 'flex';
    }
  }catch(e){}
}
function saveSession(user,token){
  currentUser = user; currentToken = token;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
  document.getElementById('navLogout').style.display = 'flex';
}
function doLogout(){
  if(!confirm('Yakin ingin keluar?')) return;
  currentUser = null; currentToken = null;
  localStorage.removeItem(SESSION_KEY); localStorage.removeItem(TOKEN_KEY);
  document.getElementById('navLogout').style.display = 'none';
  showToast('Logout','Anda telah keluar',false);
  navigate('login');
}
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
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
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
    showAlert(alertId, 'Gagal terhubung ke server. Cek koneksi.');
  }finally{
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk sebagai ' + (role === 'admin' ? 'Admin' : 'Dosen');
  }
}

// ============ REGISTRASI MAHASISWA (PUBLIK) ============
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
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
  try{
    var res = await apiCall('registerMahasiswa', data);
    if(res.success){
      showAlert('alertRegistrasi', '✓ ' + res.message + ' (ID: '+res.id+')', true);
      document.getElementById('formRegistrasi').reset();
      showToast('Pendaftaran Terkirim','Tunggu verifikasi admin', false);
    }else{
      showAlert('alertRegistrasi', '✗ ' + (res.message || 'Gagal mendaftar'));
    }
  }catch(e){ showAlert('alertRegistrasi','✗ Gagal terhubung ke server'); }
  finally{ btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran'; }
}

// ============ CARI MAHASISWA + KONTAK ============
function debounceCari(){
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(cariMahasiswa, 400);
}
async function cariMahasiswa(){
  var q = document.getElementById('daftarQuery').value.trim();
  var el = document.getElementById('daftarHasil');
  if(q.length < 2){ el.innerHTML = ''; return; }
  el.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:10px auto;"></div></div>';
  try{
    var res = await apiCall('cariMahasiswa', {query:q});
    if(!res.success || !res.data || !res.data.length){
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><div>Tidak ada mahasiswa ditemukan</div></div>';
      return;
    }
    el.innerHTML = res.data.map(function(m){ return renderMhsCard(m); }).join('');
  }catch(e){
    el.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><div>Gagal mencari data</div></div>';
  }
}
function renderMhsCard(m){
  var waLink = m.WA ? 'https://wa.me/'+m.WA+'?text='+encodeURIComponent('Assalamualaikum '+m.Nama+', saya dari LTTQ PTIQ ingin berkoordinasi terkait ujian Anda.') : '';
  return '<div class="mhs-card">' +
    '<div class="mhs-header">' +
      '<div class="mhs-nim">'+m.NIM+'</div>' +
      '<div class="mhs-nama">'+m.Nama+'</div>' +
      '<div class="mhs-meta">'+(m.Prodi || '-')+' • '+(m.Jenjang || 'S1')+' • '+(m.Program || '-')+'</div>' +
    '</div>' +
    '<div class="kontak-card">' +
      '<div class="label"><i class="fas fa-address-book"></i> Kontak Koordinasi</div>' +
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
        '<div>' +
          '<div style="font-size:11px; color:var(--gray-500);">Nama</div>' +
          '<div class="value" style="font-family:inherit;">'+m.Nama+'</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px; color:var(--gray-500);">Nomor WA</div>' +
          '<div class="value">'+(m.WA || '—')+'</div>' +
        '</div>' +
        (waLink ? '<a href="'+waLink+'" target="_blank" class="btn-wa" style="padding:10px 16px; font-size:13px;"><i class="fab fa-whatsapp"></i> Chat WA</a>' : '') +
      '</div>' +
    '</div>' +
    '<div style="margin-top:14px;">' +
      '<div style="font-size:11px; font-weight:700; color:var(--gray-500); text-transform:uppercase; margin-bottom:8px;">Rekapan Ujian</div>' +
      renderUjianRows(m) +
    '</div>' +
  '</div>';
}
function renderUjianRows(m){
  var rows = [{jenis:'tahsin',tahap:1,label:'Tahsin',nilai:m.ujian.tahsin.nilai,lulus:m.ujian.tahsin.lulus}];
  for(var t=1;t<=4;t++) rows.push({jenis:'marhalah',tahap:t,label:'Marhalah '+t,nilai:m.ujian['marhalah'+t].nilai,lulus:m.ujian['marhalah'+t].lulus});
  for(var t=1;t<=2;t++) rows.push({jenis:'komprehensif',tahap:t,label:'Komprehensif '+t,nilai:m.ujian['komprehensif'+t].nilai,lulus:m.ujian['komprehensif'+t].lulus});
  return rows.map(function(r){
    var cls = r.lulus ? 'lulus' : (r.nilai ? 'belum' : '');
    var status, aksi;
    if(r.lulus){ status = '<span class="badge badge-success">✓ Lulus</span>'; aksi = '<span style="font-size:11px; color:var(--gray-500);">—</span>'; }
    else if(r.nilai){ status = '<span class="badge badge-danger">✗ Belum Lulus</span>'; aksi = '<button class="btn btn-primary btn-sm" onclick="daftarSatuUjian(\''+m.NIM+'\',\''+r.jenis+'\','+r.tahap+',\''+r.label+'\')"><i class="fas fa-redo"></i> Daftar Ulang</button>'; }
    else{ status = '<span class="badge badge-warning">Belum Ujian</span>'; aksi = '<button class="btn btn-primary btn-sm" onclick="daftarSatuUjian(\''+m.NIM+'\',\''+r.jenis+'\','+r.tahap+',\''+r.label+'\')"><i class="fas fa-plus"></i> Daftar</button>'; }
    return '<div class="ujian-row '+cls+'">' +
      '<div><span class="ujian-label">'+r.label+'</span>' + (r.nilai?'<span class="ujian-nilai">Nilai: '+r.nilai+'</span>':'') + '</div>' +
      '<div style="display:flex; align-items:center; gap:10px;">'+status+aksi+'</div>' +
    '</div>';
  }).join('');
}
async function daftarSatuUjian(nim, jenis, tahap, label){
  if(!confirm('Daftarkan ujian ' + label + ' untuk mahasiswa ' + nim + '?')) return;
  try{
    var res = await apiCall('daftarUjian', {nim:nim, jenisUjian:jenis, tahap:tahap, keterangan:''});
    if(res.success){
      showAlert('alertDaftar', '✓ ' + label + ' berhasil didaftarkan! Tunggu verifikasi admin.', true);
      showToast('Pendaftaran Berhasil', label + ' — ID: ' + res.id, false);
      setTimeout(cariMahasiswa, 500);
    }else{ showAlert('alertDaftar', '✗ ' + (res.message || 'Gagal')); }
  }catch(e){ showAlert('alertDaftar', '✗ Gagal terhubung ke server'); }
}
async function loadStats(){
  try{
    var res = await apiCall('getLaporan', {});
    if(res.success){
      document.getElementById('statTotal').textContent = res.total || 0;
      document.getElementById('statLulusTahsin').textContent = res.lulusTahsin || 0;
      document.getElementById('statLulusAll').textContent = res.lulusKeseluruhan || 0;
      document.getElementById('statPending').textContent = res.pendingUjian || 0;
    }
  }catch(e){
    ['statTotal','statLulusTahsin','statLulusAll','statPending'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.textContent = '0';
    });
  }
}

// ============ DASHBOARD ADMIN ============
function dashNav(section){
  document.querySelectorAll('.dash-nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nav = document.getElementById('dnav-'+section);
  if(nav) nav.classList.add('active');
  document.querySelectorAll('.dash-section').forEach(function(s){ s.classList.remove('active'); });
  var sec = document.getElementById('dsec-'+section);
  if(sec) sec.classList.add('active');
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
      document.getElementById('dashTotal').textContent = lap.total || 0;
      document.getElementById('dashLulusTahsin').textContent = lap.lulusTahsin || 0;
      document.getElementById('dashLulusAll').textContent = lap.lulusKeseluruhan || 0;
      document.getElementById('dashRegPending').textContent = lap.registrasiPending || 0;
      var chartEl = document.getElementById('dashProgramChart');
      chartEl.innerHTML = '';
      var program = lap.perProgram || {'Nontahfizh':0,'Tahfizh Terbatas':0,'Tahfizh Penuh':0};
      Object.keys(program).forEach(function(p){
        var div = document.createElement('div');
        div.className = 'stat-card';
        div.innerHTML = '<div class="stat-number">'+(program[p]||0)+'</div><div class="stat-label">'+p+'</div>';
        chartEl.appendChild(div);
      });
    }
    if(pend.success){
      document.getElementById('dashPending').textContent = pend.total || 0;
      var recentEl = document.getElementById('dashRecentDaftar');
      if(!pend.data || pend.data.length === 0){
        recentEl.innerHTML = '<div class="empty-state"><div class="icon">📭</div>Tidak ada pendaftaran menunggu</div>';
      }else{
        recentEl.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>NIM</th><th>Nama</th><th>Jenis</th><th>Tahap</th></tr></thead><tbody>' +
          pend.data.slice(0,5).map(function(d){ return '<tr><td>'+d.NIM+'</td><td>'+d.Nama+'</td><td>'+d['Jenis Ujian']+'</td><td>'+d.Tahap+'</td></tr>'; }).join('') +
          '</tbody></table></div>';
      }
    }
  }catch(e){ console.error('Dashboard error:', e); }
}

// ============ REGISTRASI MAHASISWA BARU (ADMIN) ============
async function loadRegistrasi(){
  document.getElementById('tbodyRegistrasi').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;"><div class="spinner"></div></td></tr>';
  var status = document.getElementById('filterRegStatus').value;
  try{
    var res = await apiCall('getRegistrasiMhs', {status:status});
    var data = res.data || [];
    if(!data.length){
      document.getElementById('tbodyRegistrasi').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--gray-500);">Tidak ada data</td></tr>';
      return;
    }
    document.getElementById('tbodyRegistrasi').innerHTML = data.map(function(r){
      var statusClass = r.Status === 'Approved' ? 'badge-success' : (r.Status === 'Rejected' ? 'badge-danger' : 'badge-warning');
      var waNorm = String(r['Nomor WA'] || '').replace(/[^0-9]/g,'');
      var waLink = waNorm ? 'https://wa.me/'+waNorm+'?text='+encodeURIComponent('Assalamualaikum '+r.Nama+', pendaftaran Anda di LTTQ PTIQ sedang kami proses.') : '';
      var aksi = '';
      if(r.Status === 'Pending'){
        aksi = '<button class="btn btn-primary btn-sm" onclick="approveRegistrasi(\''+r.ID+'\')"><i class="fas fa-check"></i> Setujui</button> ' +
               '<button class="btn btn-danger btn-sm" onclick="rejectRegistrasi(\''+r.ID+'\')"><i class="fas fa-times"></i></button>';
      } else {
        aksi = '<span style="font-size:11px; color:var(--gray-500);">—</span>';
      }
      return '<tr>' +
        '<td style="font-family:monospace; font-size:11px;">'+r.ID+'</td>' +
        '<td style="font-family:monospace;">'+r.NIM+'</td>' +
        '<td style="font-weight:600;">'+r.Nama+'</td>' +
        '<td>'+(r.Prodi || '—')+'</td>' +
        '<td>'+(waLink ? '<a href="'+waLink+'" target="_blank" class="btn-wa"><i class="fab fa-whatsapp"></i> '+r['Nomor WA']+'</a>' : '—')+'</td>' +
        '<td><span class="badge '+statusClass+'">'+r.Status+'</span></td>' +
        '<td>'+aksi+'</td>' +
      '</tr>';
    }).join('');
  }catch(e){
    document.getElementById('tbodyRegistrasi').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Gagal memuat</td></tr>';
  }
}
async function approveRegistrasi(id){
  if(!confirm('Setujui registrasi ini? Mahasiswa akan ditambahkan ke database.')) return;
  try{
    var res = await apiCall('approveRegistrasi', {id:id});
    if(res.success){ showToast('Disetujui', res.message); loadRegistrasi(); }
    else showToast('Gagal', res.message || 'Gagal', true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}
async function rejectRegistrasi(id){
  if(!confirm('Tolak registrasi ini?')) return;
  try{
    var res = await apiCall('rejectRegistrasi', {id:id});
    if(res.success){ showToast('Ditolak', res.message); loadRegistrasi(); }
    else showToast('Gagal', res.message || 'Gagal', true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}

// ============ MAHASISWA ============
async function loadMahasiswa(){
  document.getElementById('tbodyMhs').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;"><div class="spinner"></div></td></tr>';
  try{
    var res = await apiCall('getAllMahasiswa', {});
    allMhsData = res.data || [];
    renderMahasiswa(allMhsData);
  }catch(e){
    document.getElementById('tbodyMhs').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Gagal memuat data</td></tr>';
  }
}
function renderMahasiswa(data){
  if(!data.length){
    document.getElementById('tbodyMhs').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray-500);">Belum ada data mahasiswa</td></tr>';
    return;
  }
  document.getElementById('tbodyMhs').innerHTML = data.map(function(m){
    var rekapan = getRekapanBadges(m);
    var waLink = m.WA ? 'https://wa.me/'+m.WA+'?text='+encodeURIComponent('Assalamualaikum '+m.Nama+', saya dari LTTQ PTIQ.') : '';
    var kontak = m.WA ? '<a href="'+waLink+'" target="_blank" class="btn-wa" style="font-size:11px; padding:4px 8px;"><i class="fab fa-whatsapp"></i> '+m.WA+'</a>' : '<span style="font-size:11px; color:var(--gray-500);">—</span>';
    return '<tr>' +
      '<td style="font-family:monospace;">'+m.NIM+'</td>' +
      '<td style="font-weight:600;">'+m.Nama+'</td>' +
      '<td>'+kontak+'</td>' +
      '<td>'+(m.Prodi || '—')+'</td>' +
      '<td><span class="badge badge-gold">'+(m.ProgramTahfizh || 'Nontahfizh')+'</span></td>' +
      '<td>'+rekapan+'</td>' +
      '<td>'+getStatusKelulusan(m)+'</td>' +
      '<td>' +
        '<button class="btn btn-outline btn-sm" onclick="bukaTranskrip(\''+m.NIM+'\')" title="Transkrip"><i class="fas fa-file-alt"></i></button> ' +
        '<button class="btn btn-outline btn-sm" onclick="openModalMhs(\''+m.NIM+'\')" title="Edit"><i class="fas fa-edit"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');
}
function getRekapanBadges(m){
  var items = [];
  var nT = parseFloat(m.NilaiTahsin) || 0;
  if(nT) items.push({label:'Tahsin', nilai:nT});
  if(!items.length) return '<span style="font-size:11px; color:var(--gray-500);">Belum ada ujian</span>';
  return items.map(function(x){ return '<span class="badge '+(x.nilai >= 70 ? 'badge-success' : 'badge-warning')+'" style="margin:2px;">'+x.label+':'+x.nilai+'</span>'; }).join('');
}
function getStatusKelulusan(m){
  var kkmT = (m.Jenjang === 'S1') ? 90 : 80;
  var nT = parseFloat(m.NilaiTahsin) || 0;
  if(nT >= kkmT) return '<span class="badge badge-success">Lulus Tahsin</span>';
  if(nT > 0) return '<span class="badge badge-warning">Proses</span>';
  return '<span class="badge badge-danger">Belum</span>';
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
      document.getElementById('mhsNIM').value = m.NIM || '';
      document.getElementById('mhsNIM').disabled = true;
      document.getElementById('mhsNama').value = m.Nama || '';
      document.getElementById('mhsTempat').value = m.TempatLahir || '';
      document.getElementById('mhsTgl').value = m.TanggalLahir || '';
      document.getElementById('mhsFakultas').value = m.Fakultas || '';
      document.getElementById('mhsProdi').value = m.Prodi || '';
      document.getElementById('mhsEmail').value = '';
      document.getElementById('mhsWA').value = m.WA || '';
      document.getElementById('mhsProgram').value = m.ProgramTahfizh || 'Nontahfizh';
      document.getElementById('mhsJenjang').value = m.Jenjang || 'S1';
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

// ============ MANAJEMEN UJIAN ============
async function loadPendaftaran(){
  document.getElementById('tbodyUjian').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;"><div class="spinner"></div></td></tr>';
  var filter = {};
  var st = document.getElementById('filterStatusUjian').value;
  var jn = document.getElementById('filterJenisUjian').value;
  if(st) filter.status = st;
  if(jn) filter.jenis = jn;
  try{
    var res = await apiCall('getPendaftaran', {filter:filter});
    var data = res.data || [];
    if(!data.length){
      document.getElementById('tbodyUjian').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray-500);">Tidak ada data</td></tr>';
      return;
    }
    document.getElementById('tbodyUjian').innerHTML = data.map(function(d){
      var statusClass = d.Status === 'Selesai' ? 'badge-success' : (d.Status === 'Dijadwalkan' ? 'badge-info' : (d.Status === 'Menunggu' ? 'badge-warning' : 'badge-danger'));
      var action = d.Status === 'Menunggu' ? '<button class="btn btn-primary btn-sm" onclick="openJadwal(\''+d.ID+'\')"><i class="fas fa-calendar-plus"></i> Jadwal</button>' : '';
      return '<tr>' +
        '<td style="font-family:monospace;">'+d.NIM+'</td>' +
        '<td style="font-weight:600;">'+d.Nama+'</td>' +
        '<td><span class="badge badge-'+d['Jenis Ujian']+'">'+d['Jenis Ujian']+'</span></td>' +
        '<td>'+d.Tahap+'</td>' +
        '<td><span class="badge '+statusClass+'">'+d.Status+'</span></td>' +
        '<td>'+(d.Penguji || '—')+'</td>' +
        '<td>'+(d['Tanggal Ujian'] || '—')+'</td>' +
        '<td>'+action+'</td>' +
      '</tr>';
    }).join('');
  }catch(e){
    document.getElementById('tbodyUjian').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Gagal memuat</td></tr>';
  }
}
function openJadwal(id){
  document.getElementById('jadwalId').value = id;
  document.getElementById('jadwalPenguji').value = '';
  document.getElementById('jadwalTgl').value = '';
  document.getElementById('jadwalWaktu').value = '';
  document.getElementById('modalJadwal').classList.add('show');
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

// ============ PORTAL DOSEN ============
async function loadDaftarDosen(){
  document.getElementById('listUjianDosen').innerHTML = '<div class="spinner"></div>';
  var jenis = document.getElementById('filterJenisDosen').value;
  try{
    var res = await apiCall('getUjianDosen', {username:currentUser.username, jenis:jenis});
    var data = res.data || [];
    window_daftarDosenData = data;
    if(!data.length){
      document.getElementById('listUjianDosen').innerHTML = '<div class="card"><div class="empty-state"><div class="icon">📭</div>Tidak ada peserta ujian yang ditugaskan</div></div>';
      return;
    }
    document.getElementById('listUjianDosen').innerHTML = data.map(function(d,idx){
      var jenisKey = d['Jenis Ujian'] || '';
      var waLink = d.WA ? 'https://wa.me/'+d.WA+'?text='+encodeURIComponent('Assalamualaikum '+d.Nama+', saya '+currentUser.nama+' penguji Anda. Mari koordinasi jadwal ujian.') : '';
      return '<div class="card" style="margin-bottom:14px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">' +
          '<div>' +
            '<div style="font-family:monospace; font-size:11px; color:var(--gray-500);">'+d.NIM+'</div>' +
            '<div style="font-weight:700; font-size:15px;">'+d.Nama+'</div>' +
            '<div style="margin-top:6px;"><span class="badge badge-'+jenisKey+'">'+jenisKey+' Tahap '+d.Tahap+'</span> ' +
            '<span style="font-size:11px; color:var(--gray-500); margin-left:8px;">'+(d.Jenjang || 'S1')+' | '+(d['Program Tahfizh'] || '—')+'</span></div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            (waLink ? '<a href="'+waLink+'" target="_blank" class="btn-wa"><i class="fab fa-whatsapp"></i> Chat Mahasiswa</a>' : '') +
            '<div style="font-size:11px; color:var(--gray-500); margin-top:8px;">WA: '+(d.WA || '—')+'</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:14px; display:flex; gap:8px;">' +
          '<button class="btn btn-primary" onclick="openInputNilai('+idx+')"><i class="fas fa-edit"></i> Input Nilai</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }catch(e){
    document.getElementById('listUjianDosen').innerHTML = '<div class="card"><div class="empty-state"><div class="icon">⚠️</div>Gagal memuat data</div></div>';
  }
}
function openInputNilai(idx){
  var d = window_daftarDosenData[idx];
  if(!d) return;
  document.getElementById('nilaiId').value = d.ID;
  document.getElementById('nilaiJenjang').value = d.Jenjang || 'S1';
  document.getElementById('nilaiJenis').value = d['Jenis Ujian'];
  var jenis = d['Jenis Ujian'], jenjang = d.Jenjang || 'S1';
  var kkm = jenis === 'tahsin' ? (jenjang === 'S1' ? 90 : 80) : 70;
  document.getElementById('nilaiPesertaInfo').innerHTML = '<strong>'+d.Nama+'</strong> ('+d.NIM+')<br>Jenis: <strong>'+jenis+' Tahap '+d.Tahap+'</strong><br>Jenjang: '+jenjang+' | Program: '+(d['Program Tahfizh'] || '—');
  document.getElementById('kkmInfo').textContent = 'KKM: '+kkm;
  document.getElementById('nilaiInput').value = '';
  document.getElementById('nilaiCatatan').value = '';
  document.getElementById('nilaiPreview').classList.remove('show');
  document.getElementById('modalNilai').classList.add('show');
}
function cekKKM(){
  var val = parseFloat(document.getElementById('nilaiInput').value) || 0;
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
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
  try{
    var res = await apiCall('inputNilai', {id:id, nilai:nilai, catatan:catatan, penguji:currentUser.nama});
    if(res.success){ showToast('Berhasil','Nilai tersimpan: '+nilai); closeModal('modalNilai'); loadDaftarDosen(); }
    else showToast('Gagal', res.message, true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
  finally{ btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan Nilai'; }
}

// ============ PERSURATAN ============
function openSuratForm(jenis){
  currentSuratJenis = jenis;
  var titles = {undangan:'Surat Undangan',tugas:'Surat Tugas',keterangan:'Surat Keterangan',keputusan:'Surat Keputusan',permohonan:'Surat Permohonan'};
  document.getElementById('suratFormTitle').textContent = titles[jenis] || 'Buat Surat';
  document.getElementById('suratPerihal').value = '';
  document.getElementById('suratFields').innerHTML = buildSuratFields(jenis);
  navigate('surat-form');
}
function buildSuratFields(jenis){
  var fg = function(label,id,type){
    type = type || 'text';
    if(type === 'textarea') return '<div class="form-group"><label class="form-label">'+label+'</label><textarea class="form-textarea" id="'+id+'"></textarea></div>';
    return '<div class="form-group"><label class="form-label">'+label+'</label><input class="form-input" id="'+id+'" type="'+type+'"/></div>';
  };
  if(jenis === 'undangan') return fg('Kepada / Ditujukan','sf-kepada')+fg('Hari','sf-hari')+fg('Tanggal Acara','sf-tanggal','date')+fg('Waktu','sf-waktu')+fg('Tempat','sf-tempat')+fg('Agenda','sf-agenda','textarea');
  if(jenis === 'tugas') return fg('Nama','sf-nama')+fg('NIP / NIDN','sf-nip')+fg('Jabatan','sf-jabatan')+fg('Hari','sf-hari')+fg('Tanggal','sf-tanggal','date')+fg('Waktu','sf-waktu')+fg('Tempat','sf-tempat');
  if(jenis === 'keterangan') return fg('NIM Mahasiswa','sf-nim')+fg('Nama Mahasiswa','sf-nama')+fg('Fakultas','sf-fakultas')+fg('Prodi','sf-prodi')+fg('Program Tahfizh','sf-program')+fg('Isi Keterangan','sf-keterangan','textarea');
  if(jenis === 'keputusan') return fg('Menimbang','sf-menimbang','textarea')+fg('Mengingat','sf-mengingat','textarea')+fg('Menetapkan','sf-menetapkan')+fg('Pertama','sf-pertama','textarea')+fg('Kedua','sf-kedua','textarea');
  if(jenis === 'permohonan') return fg('Kepada','sf-kepada')+fg('Isi Permohonan','sf-isi','textarea');
  return '';
}
function collectSuratData(){
  var data = {jenis:currentSuratJenis, perihal:document.getElementById('suratPerihal').value.trim()};
  document.querySelectorAll('#suratFields input, #suratFields textarea').forEach(function(el){ data[el.id.replace('sf-','')] = el.value.trim(); });
  return data;
}
async function previewSurat(){
  var data = collectSuratData();
  if(!data.perihal){ showAlert('alertSurat','Perihal wajib diisi'); return; }
  try{
    var res = await apiCall('buatSurat', {data:data, preview:true});
    if(res.success){ var w = window.open('','_blank'); w.document.write(res.html); w.document.close(); showToast('Preview','Surat di tab baru'); }
    else showAlert('alertSurat', res.message || 'Gagal');
  }catch(e){ showAlert('alertSurat','Gagal terhubung'); }
}
async function simpanSurat(){
  var data = collectSuratData();
  if(!data.perihal){ showAlert('alertSurat','Perihal wajib diisi'); return; }
  try{
    var res = await apiCall('buatSurat', {data:data});
    if(res.success){ showAlert('alertSurat','✓ Surat disimpan! Nomor: '+res.nomorSurat, true); showToast('Surat Tersimpan', res.nomorSurat); }
    else showAlert('alertSurat', res.message || 'Gagal');
  }catch(e){ showAlert('alertSurat','Gagal terhubung'); }
}

// ============ TRANSKRIP & SERTIFIKAT ============
async function bukaTranskrip(nim){
  var n = nim || document.getElementById('transkripNIM').value.trim();
  if(!n){ showToast('Peringatan','Masukkan NIM',true); return; }
  try{
    var res = await apiCall('getTranskrip', {nim:n});
    if(res.success){ var w = window.open('','_blank'); w.document.write(res.html); w.document.close(); }
    else showToast('Gagal', res.message || 'Tidak ditemukan', true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}
async function bukaSertifikat(){
  var nim = document.getElementById('sertifikatNIM').value.trim();
  if(!nim){ showToast('Peringatan','Masukkan NIM',true); return; }
  try{
    var res = await apiCall('getSertifikat', {nim:nim});
    if(res.success){ var w = window.open('','_blank'); w.document.write(res.html); w.document.close(); }
    else showToast('Tidak Dapat Dicetak', res.message || 'Belum tersedia', true);
  }catch(e){ showToast('Error','Gagal terhubung',true); }
}

// ============ API HELPER ============
async function apiCall(action, data){
  var payload = {action:action, token:currentToken || '', data:data || {}};
  var res = await fetch(GAS_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  return await res.json();
}

// ============ UTILITY ============
function showAlert(id, msg, isSuccess){
  var el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg;
  el.className = 'alert show ' + (isSuccess ? 'alert-success' : 'alert-error');
  setTimeout(function(){ el.classList.remove('show'); }, 5000);
}
function showToast(title, msg, isError){
  var t = document.getElementById('appToast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMsg').textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(function(){ t.classList.remove('show'); }, 4000);
}
function closeModal(id){
  var el = document.getElementById(id);
  if(el) el.classList.remove('show');
}
function toggleMobileMenu(){
  document.getElementById('appNavMenu').classList.toggle('open');
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function(){
  checkSession();
  if(currentToken){
    if(!window.location.hash || window.location.hash === '#login'){
      window.location.hash = currentUser.role === 'admin' ? '#dashboard' : '#ujian-dosen';
    }
  }
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  document.querySelectorAll('.app-nav-menu a[data-nav]').forEach(function(a){
    a.addEventListener('click', function(){ document.getElementById('appNavMenu').classList.remove('open'); });
  });
  console.log('LTTQ PTIQ v1.2 initialized.');
});

// Export to window
window.navigate = navigate;
window.switchLoginTab = switchLoginTab;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.submitRegistrasi = submitRegistrasi;
window.debounceCari = debounceCari;
window.cariMahasiswa = cariMahasiswa;
window.daftarSatuUjian = daftarSatuUjian;
window.dashNav = dashNav;
window.loadMahasiswa = loadMahasiswa;
window.filterMahasiswa = filterMahasiswa;
window.openModalMhs = openModalMhs;
window.saveMahasiswa = saveMahasiswa;
window.loadRegistrasi = loadRegistrasi;
window.approveRegistrasi = approveRegistrasi;
window.rejectRegistrasi = rejectRegistrasi;
window.loadPendaftaran = loadPendaftaran;
window.openJadwal = openJadwal;
window.saveJadwal = saveJadwal;
window.loadDaftarDosen = loadDaftarDosen;
window.openInputNilai = openInputNilai;
window.cekKKM = cekKKM;
window.submitNilai = submitNilai;
window.openSuratForm = openSuratForm;
window.previewSurat = previewSurat;
window.simpanSurat = simpanSurat;
window.bukaTranskrip = bukaTranskrip;
window.bukaSertifikat = bukaSertifikat;
window.closeModal = closeModal;
window.toggleMobileMenu = toggleMobileMenu;

})();