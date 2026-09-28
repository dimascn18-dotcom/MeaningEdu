// MeaningEdu — app.js
const API_BASE_URL = window.MEANINGEDU_CONFIG?.API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('Konfigurasi API MeaningEdu tidak tersedia. Pastikan config.js dimuat sebelum app.js.');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { localStorage.removeItem('user'); return null; }
}

// --- Navbar scroll effect ---
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if (!navbar) return;
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// --- Mobile Menu Toggle ---
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  const open = menu.classList.toggle('open');
  document.querySelector('.hamburger')?.setAttribute('aria-expanded', String(open));
}

// Close mobile menu when clicking a link
document.querySelectorAll('.mobile-menu a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.remove('open');
    document.querySelector('.hamburger')?.setAttribute('aria-expanded', 'false');
  });
});

// --- Feature Tabs ---
function switchTab(tab, btn) {
  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  // Remove active from all panels
  document.querySelectorAll('.feature-panel').forEach(p => p.classList.remove('active'));

  // Activate clicked button and panel
  btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');
}

// --- Smooth scroll offset for fixed navbar ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (target.matches('main,[tabindex]')) target.focus({ preventScroll:true });
    }
  });
});

// --- Animate elements on scroll ---
const observerOptions = {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
};
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Add fade-in class to cards and cards
const animatedEls = document.querySelectorAll(
  '.problem-card, .feature-card, .mli-card, .audience-card, .flow-step'
);
animatedEls.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = `opacity 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`;
  observer.observe(el);
});

// Visible state
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .problem-card.visible,
    .feature-card.visible,
    .mli-card.visible,
    .audience-card.visible,
    .flow-step.visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  </style>
`);

// --- PWA Service Worker registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW failed:', err));
  });
}
// Menangani proses Pendaftaran (Register)
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah halaman reload

    // Ambil data dari form
    const status = document.getElementById('authStatus');
    const submit = registerForm.querySelector('[type=submit]');
    submit.disabled = true; status.textContent = 'Mendaftarkan akun…';
    const nama = document.getElementById('nama').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const peran = document.getElementById('peran').value; // 'guru' atau 'siswa'
    const wilayah_sekolah = document.getElementById('wilayah').value; // opsional

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nama, email, password, peran, wilayah_sekolah })
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('registrationNotice', data.message || 'Pendaftaran berhasil. Silakan masuk.');
        window.location.href = 'login.html'; // Arahkan ke halaman login
      } else {
        status.textContent = data.message || 'Pendaftaran gagal. Periksa isian Anda.'; status.focus();
      }
    } catch (error) {
      console.error('Error saat pendaftaran:', error);
      status.textContent = 'Koneksi gagal. Isian tetap tersimpan di halaman; coba kirim kembali.'; status.focus();
    } finally { submit.disabled = false; }
  });
}
// Menangani proses Masuk (Login)
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  const notice = sessionStorage.getItem('registrationNotice');
  if (notice) { document.getElementById('authStatus').textContent = notice; sessionStorage.removeItem('registrationNotice'); }
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const status = document.getElementById('authStatus');
    const submit = loginForm.querySelector('[type=submit]');
    submit.disabled = true; status.textContent = 'Memeriksa akun…';
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // 1. Simpan Token JWT dan Data User di browser (localStorage)
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        status.textContent = 'Berhasil masuk. Membuka ruang belajar…';

        // 2. Arahkan ke dashboard yang sesuai dengan peran
        if (data.user.peran === 'admin') {
          window.location.href = 'admin.html';
        } else if (data.user.peran === 'guru') {
          window.location.href = 'dashboard-guru.html'; // Sesuaikan nama file Anda
        } else {
          window.location.href = 'workspace-siswa.html'; // Sesuaikan nama file Anda
        }
      } else {
        status.textContent = data.message || 'Email atau kata sandi tidak cocok.'; status.focus();
      }
    } catch (error) {
      console.error('Error saat login:', error);
      status.textContent = 'Koneksi gagal. Periksa jaringan lalu coba masuk kembali.'; status.focus();
    } finally { submit.disabled = false; }
  });
}
// Fungsi bantuan untuk melakukan fetch dengan Token JWT
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    alert('Sesi Anda telah habis. Silakan login kembali.');
    window.location.href = 'login.html';
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`, // Membawa tiket JWT
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    sessionStorage.setItem('registrationNotice', 'Sesi berakhir. Masuk kembali untuk melanjutkan. Antrean jurnal tetap tersimpan di perangkat.');
    window.location.href = 'login.html';
  }
  return response;
}

// Contoh Penggunaan Nanti:
// fetchWithAuth('/kelas')
//   .then(res => res.json())
//   .then(data => tampilkanKelas(data));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('mobileMenu')?.classList.contains('open')) {
    toggleMenu(); document.querySelector('.hamburger')?.focus();
  }
});
