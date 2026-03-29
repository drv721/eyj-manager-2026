import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  // Static serving for uploaded data
  app.use('/data', express.static(dataDir));

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'data/');
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });
  const upload = multer({ storage });

  // API Routes
  app.post("/api/upload", upload.array('files'), (req, res) => {
    console.log(`Received ${req.files?.length} files`);
    res.json({ 
      status: "ok", 
      message: "Files uploaded successfully",
      files: (req.files as Express.Multer.File[]).map(f => f.originalname)
    });
  });

  app.get("/api/files", (req, res) => {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      res.json({ files });
    } else {
      res.json({ files: [] });
    }
  });

  app.post("/api/reset", (req, res) => {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      for (const file of files) {
        fs.unlinkSync(path.join(dataDir, file));
      }
    }
    res.json({ status: "ok", message: "Data directory cleared" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
