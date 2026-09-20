function lindungiBlokMatematika(teks) {
  const blok = [];
  const teksTerlindungi = teks.replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g, match => {
    const token = `MEANINGEDU_MATH_BLOCK_${blok.length}`;
    blok.push({ token, source: match });
    return token;
  });

  return {
    teksTerlindungi,
    pulihkan(hasil) {
      let dipulihkan = hasil;
      for (const item of blok) {
        if (!dipulihkan.includes(item.token)) {
          throw new Error('AI mengubah placeholder matematika.');
        }
        dipulihkan = dipulihkan.split(item.token).join(item.source);
      }
      return dipulihkan;
    }
  };
}

module.exports = { lindungiBlokMatematika };
