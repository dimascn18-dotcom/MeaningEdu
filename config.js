// Konfigurasi publik frontend MeaningEdu.
// File ini dipakai bersama oleh halaman web dan Service Worker agar alamat API
// tidak tersebar di beberapa tempat.
(function exposeMeaningEduConfig(scope) {
  scope.MEANINGEDU_CONFIG = Object.freeze({
    API_BASE_URL: 'https://meaning-edu-3pes.vercel.app'
  });
})(typeof self !== 'undefined' ? self : window);
