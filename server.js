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

const AUDIO_DIR = path.join(__dirname, 'audios');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);

const jobs = {};

// Listar vozes (até 50)
app.get('/voices', async (req, res) => {
  try {
    const out = await execCommandGetOutput('kokoro-tts',['--list-voices']);
    const voices = [];
    out.split(/\r?\n/).forEach(line=>{
      line=line.trim();
      if(!line) return;
      const m=line.match(/([a-z0-9_]+)\s*\(?([a-z]{2})?\)?\s*-?\s*(.*)/i);
      if(m) voices.push({id:m[1],name:m[3]||m[1],lang:m[2]||'pt'});
    });
    return res.json({voices: voices.slice(0,50)});
  } catch(e){
    return res.json({voices:[
      {id:'pt_female_1',name:'PT Female 1',lang:'pt'},
      {id:'pt_male_1',name:'PT Male 1',lang:'pt'},
      {id:'en_female_1',name:'EN Female 1',lang:'en'}
    ]});
  }
});

// Gerar áudio
app.post('/generate', (req,res)=>{
  const { text, voice, language } = req.body || {};
  if(!text || !voice || !language) return res.status(400).json({error:'text, voice, language required'});

  const id = uuidv4();
  const outFile = path.join(AUDIO_DIR, `${id}.mp3`);
  const args = ['--voice', voice, '--lang', language, '--output', outFile];

  const child = spawn('kokoro-tts', args, { stdio:['pipe','pipe','pipe'] });
  jobs[id] = { child, logs: [] };

  child.stdout.on('data', d=>jobs[id].logs.push(d.toString()));
  child.stderr.on('data', d=>jobs[id].logs.push(d.toString()));
  child.on('close', code=>{
    jobs[id].finished=true;
    jobs[id].outFile = outFile;
  });

  child.stdin.write(text);
  child.stdin.end();

  res.json({id});
});

// SSE logs/progresso
app.get('/progress/:id', (req,res)=>{
  const id = req.params.id;
  const job = jobs[id];
  if(!job) return res.status(404).end('no job');

  res.set({
    'Content-Type':'text/event-stream',
    'Cache-Control':'no-cache',
    Connection:'keep-alive'
  });
  res.flushHeaders();

  const sendLogs = ()=>{
    if(job.logs.length){
      job.logs.forEach(l=>res.write(`data: ${JSON.stringify(l)}\n\n`));
      job.logs=[];
    }
    if(job.finished){
      res.write(`event: finished\ndata: ${JSON.stringify({url:`/audios/${path.basename(job.outFile)}`})}\n\n`);
      return res.end();
    }
  };

  const interval = setInterval(()=>{
    if(res.writableEnded) return clearInterval(interval);
    sendLogs();
  },500);

  req.on('close', ()=>clearInterval(interval));
});

function execCommandGetOutput(cmd,args=[]){
  return new Promise((resolve,reject)=>{
    try{
      const p = spawn(cmd,args);
      let out='';
      p.stdout.on('data',d=>out+=d.toString());
      p.stderr.on('data',d=>out+=d.toString());
      p.on('close',()=>resolve(out));
      p.on('error',e=>reject(e));
    }catch(e){reject(e);}
  });
}

app.use('/audios', express.static(AUDIO_DIR));

const PORT = process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Server running on ${PORT}`));
