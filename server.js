// server.js — backend Node.js leve com gTTS

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/audios", express.static(path.join(__dirname, "audios")));

if (!fs.existsSync(path.join(__dirname, "audios"))) {
  fs.mkdirSync(path.join(__dirname, "audios"));
}

// 🔹 Rota que obtém idiomas reais do gTTS
app.get("/voices", (req, res) => {
  const py = spawn("python3", ["-c", `
import json
from gtts.lang import tts_langs
langs = tts_langs()
print(json.dumps(langs))
  `]);

  let data = "";
  py.stdout.on("data", chunk => data += chunk.toString());
  py.stderr.on("data", err => console.error("Erro:", err.toString()));

  py.on("close", () => {
    try {
      const langs = JSON.parse(data);
      const arr = Object.entries(langs).map(([code, name]) => ({ code, name }));
      res.json({ languages: arr, voices: [{ id: "default", name: "Padrão" }] });
    } catch (e) {
      console.error("Falha ao obter idiomas:", e);
      res.status(500).json({ error: "Falha ao obter idiomas" });
    }
  });
});

// 🔹 Rota para gerar áudio com gTTS
app.post("/generate", (req, res) => {
  const { text, language } = req.body;
  if (!text || !language)
    return res.status(400).json({ error: "Texto e idioma são obrigatórios." });

  const id = uuidv4();
  const outputPath = path.join(__dirname, "audios", `${id}.mp3`);

  const py = spawn("python3", [
    "-c",
    `
from gtts import gTTS
gTTS(text=${JSON.stringify(text)}, lang='${language}').save('${outputPath}')
    `
  ]);

  py.on("close", (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      res.json({ url: "/audios/" + path.basename(outputPath) });
    } else {
      res.status(500).json({ error: "Falha ao gerar áudio." });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Servidor rodando na porta " + PORT));
