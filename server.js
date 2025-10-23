// server.js
// Node.js backend que usa o CLI kokoro-tts instalado no container.
// Endpoints:
// GET  /voices         -> lista vozes/idiomas (consulta kokoro-tts --list or --list-voices)
// POST /generate       -> inicia geração (retorna id de job) e cria mp3
// GET  /progress/:id   -> SSE stream com logs / progresso
// GET  /audios/:file   -> serve os mp3

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/audios', express.static(path.join(__dirname, 'audios')));

if (!fs.existsSync('audios')) fs.mkdirSync('audios');

// job store: id -> child/stdout buffer
const jobs = {};

// Helper: tenta listar vozes via kokoro-tts CLI
app.get('/voices', async (req, res) => {
  // tenta executar kokoro-tts --list or kokoro-tts --list-voices
  const tryCommands = [['kokoro-tts','--list-voices'], ['kokoro-tts','--list'], ['kokoro-tts','--voices']];
  let out = '';
  for (const cmd of tryCommands) {
    try {
      out = await execCommandGetOutput(cmd[0], cmd.slice(1));
      if (out && out.trim()) break;
    } catch (e) {
      // continue trying next variant
    }
  }

  // Se não retornou nada, devolve um fallback básico
  if (!out || !out.trim()) {
    const fallback = {
      languages: [{ code: 'pt', name: 'Português' }, { code: 'en', name: 'English' }],
      voices: [
        { id: 'pt_female_1', name: 'PT Female 1', lang: 'pt' },
        { id: 'pt_male_1', name: 'PT Male 1', lang: 'pt' },
        { id: 'en_female_1', name: 'EN Female 1', lang: 'en' }
      ]
    };
    return res.json(fallback);
  }

  // tenta parse básico: cada linha que contenha "lang" ou "voice"
  const languages = new Map();
  const voices = [];

  out.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line) return;
    // formatos comuns: "af_bella (pt) - Bella" or "voice: af_bella | lang: pt"
    const m1 = line.match(/([a-z0-9_]+)\s*\(?([a-z]{2})\)?\s*-?\s*(.*)/i);
    if (m1) {
      const id = m1[1];
      const lang = (m1[2] || '').toLowerCase();
      const name = m1[3] ? m1[3].trim() : id;
      voices.push({ id, name, lang });
      languages.set(lang, true);
    } else {
      // fallback: try split by whitespace
      const parts = line.split(/\s+/);
      if (parts.length >= 1) {
        voices.push({ id: parts[0], name: parts.slice(1).join(' ') || parts[0], lang: 'pt' });
        languages.set('pt', true);
      }
    }
  });

  const langs = Array.from(languages.keys()).map(l => ({ code: l, name: l }));
  res.json({ languages: langs, voices });
});

// inicia geração de áudio
app.post('/generate', (req, res) => {
  const { text, voice, language } = req.body || {};
  if (!text || !voice || !language) return res.status(400).json({ error: 'text, voice and language required' });

  const id = uuidv4();
  const outFile = path.join('audios', `${id}.mp3`);

  // Spawn kokoro-tts CLI: tenta usar stdin for text
  // comando: kokoro-tts --voice <voice> --lang <language> --output <file>
  const args = ['--voice', voice, '--lang', language, '--output', outFile];
  // Some CLI versions accept text via stdin, others via -t flag; we'll pipe via stdin.
  const child = spawn('kokoro-tts', args, { stdio: ['pipe', 'pipe', 'pipe'] });

  jobs[id] = { child, logs: [] };

  child.stdout.on('data', (data) => {
    const s = data.toString();
    jobs[id].logs.push({ t: Date.now(), o: s });
    // keep log buffer small
    if (jobs[id].logs.length > 200) jobs[id].logs.shift();
    console.log(`[kokoro ${id}]`, s.trim());
  });
  child.stderr.on('data', (data) => {
    const s = data.toString();
    jobs[id].logs.push({ t: Date.now(), o: s });
    console.error(`[kokoro ${id} ERR]`, s.trim());
  });

  child.on('error', (err) => {
    jobs[id].logs.push({ t: Date.now(), o: `ERROR: ${err.message}` });
  });

  child.on('close', (code) => {
    jobs[id].finished = true;
    jobs[id].exitCode = code;
    jobs[id].outFile = outFile;
    jobs[id].logs.push({ t: Date.now(), o: `PROCESS_EXIT ${code}` });
  });

  // write text to stdin
  child.stdin.write(text);
  child.stdin.end();

  // return job id
  res.json({ id });
});

// SSE endpoint para progresso/logs
app.get('/progress/:id', (req, res) => {
  const id = req.params.id;
  const job = jobs[id];
  if (!job) return res.status(404).end('no job');

  // setup SSE
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  const sendLogs = () => {
    const last = job._lastSent || 0;
    const newLogs = job.logs.slice(last);
    if (newLogs.length) {
      newLogs.forEach(l => {
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify(l.o)}\n\n`);
      });
      job._lastSent = job.logs.length;
    }
    // if finished, send finished event with file url
    if (job.finished) {
      const fileUrl = `/audios/${path.basename(job.outFile)}`;
      res.write(`event: finished\n`);
      res.write(`data: ${JSON.stringify({ code: job.exitCode||0, url: fileUrl })}\n\n`);
      return res.end();
    }
  };

  // send any existing logs immediately
  sendLogs();
  const interval = setInterval(() => {
    if (res.writableEnded) return clearInterval(interval);
    sendLogs();
    // keep-alive comment
    res.write(': keepalive\n\n');
  }, 700);

  req.on('close', () => clearInterval(interval));
});

// utilidade simples para executar comando e pegar stdout
function execCommandGetOutput(cmd, args=[]) {
  return new Promise((resolve, reject) => {
    try {
      const p = spawn(cmd, args);
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', (code) => {
        if (code === 0) resolve(out || err);
        else resolve(out || err); // return whatever
      });
      p.on('error', (e) => reject(e));
    } catch (e) { reject(e); }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
