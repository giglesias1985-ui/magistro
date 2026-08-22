require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const docenteRoutes = require('./routes/docente');
const estudianteRoutes = require('./routes/estudiante');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// API
app.use('/api', authRoutes);
app.use('/api/docente', docenteRoutes);
app.use('/api/estudiante', estudianteRoutes);

// Archivos estáticos: la app del docente y el portal del estudiante
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/docente.html'));

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAGISTRO backend escuchando en el puerto ${PORT}`);
});
