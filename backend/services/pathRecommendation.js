// A suggestion needs an actual student click and another available path.
// Teacher-selected paths take precedence; otherwise suggest the first other path.
// MLI scores are deliberately not interpreted as diagnoses of an individual.
async function recommend(db, studentId, activityId) {
  const chosen = await db.query(`
    SELECT l.id, l.jalur_id, p.label FROM log_pilihan_jalur l
    JOIN jalur_aktivitas p ON p.id = l.jalur_id AND p.aktivitas_id = l.aktivitas_id
    WHERE l.siswa_id = $1 AND l.aktivitas_id = $2 AND l.event_type = 'explicit_choice'
    ORDER BY l.dipilih_at DESC, l.id DESC LIMIT 1`, [studentId, activityId]);
  const choice = chosen.rows[0];
  if (!choice) return null;
  const previous = await db.query('SELECT 1 FROM path_recommendation_decisions WHERE choice_log_id = $1 OR selected_choice_log_id = $1', [choice.id]);
  if (previous.rows.length) return null;
  const alternatives = await db.query(`
    SELECT id, label FROM jalur_aktivitas WHERE aktivitas_id = $1 AND id <> $2
    ORDER BY urutan ASC, id ASC`, [activityId, choice.jalur_id]);
  if (!alternatives.rows.length) return null;
  const teacher = await db.query(`
    SELECT recommended_path_id FROM pedagogical_interventions
    WHERE target_activity_id = $1 AND recommended_path_id IS NOT NULL
    ORDER BY created_at DESC, id DESC LIMIT 1`, [activityId]);
  const teacherPath = alternatives.rows.find(p => p.id === teacher.rows[0]?.recommended_path_id);
  const next = teacherPath || alternatives.rows[0];
  return {
    choice_log_id: choice.id, current_path_id: choice.jalur_id,
    current_path_label: choice.label, recommended_path_id: next.id,
    recommended_path_label: next.label,
    explanation: teacherPath
      ? `Anda memilih ${choice.label}. Guru menyediakan ${next.label} sebagai pilihan lain untuk aktivitas ini.`
      : `Anda memilih ${choice.label}. ${next.label} juga tersedia jika Anda ingin mencoba cara belajar lain.`,
    basis: { explicit_choice: true, alternate_path_available: true, teacher_suggestion: Boolean(teacherPath) },
    note: 'Ini pilihan tambahan berdasarkan aktivitas yang tersedia, bukan penilaian mutlak atas kemampuan Anda.'
  };
}
module.exports = { recommend };
