const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// Inisialisasi klien Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

exports.socraticReflection = async (req, res) => {
  const { topik_fisika, jawaban_awal_siswa } = req.body;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Model yang cepat dan efisien
      max_tokens: 300,
      system: `Kamu adalah AI Reflection Companion untuk platform MeaningEdu. 
      Tugasmu adalah merespons jawaban siswa menggunakan metode Socratic questioning. 
      JANGAN PERNAH memberikan jawaban langsung. Berikan 1 pertanyaan lanjutan yang merangsang metakognisi siswa agar mereka berpikir lebih dalam tentang topik Fisika. 
      Gunakan bahasa Indonesia yang sederhana, empatik, dan mudah dipahami oleh siswa di daerah pedesaan atau pesisir (wilayah 3T).`,
      messages: [
        {
          role: "user",
          content: `Topik Fisika: ${topik_fisika}. Jawaban awalku: "${jawaban_awal_siswa}"`
        }
      ]
    });

    res.status(200).json({
      pertanyaan_ai: response.content[0].text
    });
  } catch (error) {
    console.error("Error dari Anthropic API:", error);
    res.status(500).json({ message: 'Gagal menghubungi AI Companion' });
  }
};