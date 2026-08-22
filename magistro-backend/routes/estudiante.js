const express = require('express');
const pool = require('../db/pool');
const { requireEstudiante } = require('../middleware/auth');

const router = express.Router();
router.use(requireEstudiante);

// Devuelve únicamente lo que le corresponde ver a ESTE estudiante:
// datos de la comisión + cronograma/bibliografía (compartidos), y sus
// propias notas, asistencia y actividades (nunca las de sus compañeros).
router.get('/data', async (req, res) => {
  try {
    const { comisionId, studentId, dni } = req.estudiante;

    const q = await pool.query(
      `SELECT c.data AS com_data, m.nombre AS materia_nombre, m.data AS materia_data, d.nombre AS docente_nombre
       FROM comisiones c
       LEFT JOIN materias m ON m.id = c.materia_id
       JOIN docentes d ON d.id = c.docente_id
       WHERE c.id = $1`,
      [comisionId]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Curso no encontrado.' });

    const { com_data: com, materia_nombre, materia_data, docente_nombre } = q.rows[0];
    const students = Array.isArray(com.students) ? com.students : [];
    const propioIdx = students.findIndex(s => s.id === studentId);
    const propio = propioIdx >= 0 ? students[propioIdx] : students.find(s => s.dni === dni);
    if (!propio) return res.status(404).json({ error: 'No encontramos tus datos en este curso.' });
    const si = propioIdx >= 0 ? propioIdx : students.findIndex(s => s === propio);

    const att = com.attendance || { dates: [], records: {} };
    const misRegistros = (att.records && att.records[propio.id]) || {};

    // ── Actividades: com.workRecords se guarda con clave `${indice}_${workId}` ──
    const unidades = com.unidades || [];
    const unitWorks = com.unitWorks || {};
    const workRecords = com.workRecords || {};
    const misTrabajos = {};
    unidades.forEach(u => {
      const works = unitWorks[u.id] || [];
      if (!works.length) return;
      misTrabajos[u.id] = {
        unidad: { id: u.id, numero: u.numero, nombre: u.nombre },
        trabajos: works.map(w => {
          const r = workRecords[`${si}_${w.id}`] || { entregado: '', concepto: '' };
          return { id: w.id, name: w.name, entregado: r.entregado || '', concepto: r.concepto || '' };
        })
      };
    });

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
      },
      actividades: misTrabajos,
      biblio: (materia_data && materia_data.biblio) || [],
      materiales: (materia_data && materia_data.materiales) || [],
      tablon: (com.tablon || []).slice().sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tus datos.' });
  }
});

module.exports = router;

