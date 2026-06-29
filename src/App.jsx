import React from 'react';
import ReflectionBox from './components/ReflectionBox';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
      <div>
        <h1 style={{ textAlign: 'center' }}>Platform MeaningEdu 🚀</h1>
        <p style={{ textAlign: 'center', color: '#666' }}>Ekosistem Pembelajaran Fisika Bermakna untuk Wilayah 3T</p>
        <hr style={{ margin: '30px 0', borderColor: '#eee' }} />
        
        {/* Memasang Komponen Kotak Jurnal Siswa */}
        <ReflectionBox idTopik="Fluida-Hidrostatis-XI" />
      </div>
    </div>
  );
}

export default App;