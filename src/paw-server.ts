// paw-server/src/paw-server.ts
import express from 'express';
import cors from 'cors';
import pipelineRoutes from './routes/pipeline-routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/pipeline', pipelineRoutes);

app.listen(PORT, () => {
  console.log(`PAW server running on http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/pipeline/modules/:moduleId/intake');
  console.log('  POST /api/pipeline/modules/:moduleId/intake');
  console.log('  POST /api/pipeline/decide');
  console.log('  GET  /api/pipeline/users/:userId/rotation');
  console.log('  POST /api/pipeline/intake/assess');
  console.log('  POST /api/pipeline/generate');
  console.log('  POST /api/pipeline/evaluate');
});

export default app;
