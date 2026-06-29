import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// KODE TAMBAHAN UNTUK PENDAFTARAN ASISTEN LURING (SERVICE WORKER)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((pendaftaran) => {
        console.log('Sistem: Pendaftaran Asisten Lab Luring sukses dengan scope: ', pendaftaran.scope);
      })
      .catch((error) => {
        console.log('Sistem: Pendaftaran Asisten Lab Luring gagal: ', error);
      });
  });
}