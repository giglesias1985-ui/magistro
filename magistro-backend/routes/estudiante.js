const express = require('express');
const pool = require('../db/pool');
const { requireEstudiante } = require('../middleware/auth');

const router = express.Router();
router.use(requireEstudiante);

// Devuelve únicamente lo que le corresponde ver a ESTE estudiante:
// datos de la comisión + cronograma (compartido), y sus propias notas
// y asistencia (nunca las de sus compañeros).
router.get('/data', async (req, res) => {
  try {
    const { comisionId, studentId, dni } = req.estudiante;

    const q = await pool.query(
      `SELECT c.data AS com_data, m.nombre AS materia_nombre, d.nombre AS docente_nombre
       FROM comisiones c
       LEFT JOIN materias m ON m.id = c.materia_id
       JOIN docentes d ON d.id = c.docente_id
       WHERE c.id = $1`,
      [comisionId]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Curso no encontrado.' });

    const { com_data: com, materia_nombre, docente_nombre } = q.rows[0];
    const students = Array.isArray(com.students) ? com.students : [];
    const propio = students.find(s => s.id === studentId) || students.find(s => s.dni === dni);
    if (!propio) return res.status(404).json({ error: 'No encontramos tus datos en este curso.' });

    const att = com.attendance || { dates: [], records: {} };
    const misRegistros = (att.records && att.records[propio.id]) || {};

    res.json({
      estudiante: { nombre: propio.name || '', dni: propio.dni || dni },
      curso: {
        materia: materia_nombre || com.title || '',
        docente: docente_nombre || '',
        comision: com.comision || '',
        horario: com.horario || '',
        aula: com.aula || '',
        periodo: com.periodo || ''
      },
      notas: {
        p1: propio.p1 ?? '',
        p2: propio.p2 ?? '',
        rec: propio.rec ?? ''
      },
      cronograma: {
        planning: com.planning || null,
        unidades: com.unidades || []
      },
      asistencia: {
        dates: att.dates || [],
        skipWeeks: com.skipWeeks || {},
        misRegistros
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tus datos.' });
  }
});

module.exports = router;
