const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const AUDIO_DIR = path.join(__dirname, 'audios');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);

// 🔹 Rota para listar vozes disponíveis (limite de 50)
app.get('/voices', (req, res) => {
  exec('kokoro-tts --list-voices', (error, stdout) => {
    if (error) return res.status(500).json({ error: error.message });

    const lines = stdout.split('\n').filter(l => l.trim().length > 0);
    const voices = lines.slice(0, 50).map(line => line.trim());
    res.json({ voices });
  });
});

// 🔹 Rota para gerar o áudio real
app.post('/generate', (req, res) => {
  const { text, voice } = req.body;
  if (!text || !voice)
    return res.status(400).json({ error: 'Texto e voz são obrigatórios.' });

  const outputFile = path.join(AUDIO_DIR, `${uuidv4()}.mp3`);
  const command = `kokoro-tts --text "${text.replace(/"/g, '\\"')}" --voice "${voice}" --output "${outputFile}"`;

  const process = exec(command);

  process.on('exit', (code) => {
    if (code !== 0) return res.status(500).json({ error: 'Erro ao gerar áudio.' });
    res.json({ audioUrl: `/audios/${path.basename(outputFile)}` });
  });
});

app.use('/audios', express.static(AUDIO_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
