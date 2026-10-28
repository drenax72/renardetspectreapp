import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'logo-uploader',
        configureServer(server) {
          const syncPlaylistsManifest = () => {
            try {
              const TRACK_TRANSLATIONS: Record<string, string> = {
                'verdant glade': 'Clairière Verdoyante',
                'sunlit canopy': 'Canopée Ensoleillée',
                'pastoral haven': 'Havre Pastoral',
                'forgotten grove': 'Bosquet Oublié',
                'elder roots': 'Racines Anciennes',
                'silent thicket': 'Fourré Silencieux',
                'cold calculation': 'Froid Calcul',
                'dark counsel': 'Sombre Conseil',
                'iron siege': 'Siège de Fer',
                'blood and iron': 'Le Sang et le Fer',
                'verdant threshold': 'Seuil Verdoyant',
                'sylvan haven': 'Refuge Sylvestre',
                'village dawn': 'Aube sur le Village',
                'ancient glade': 'Clairière Ancestrale',
                'forgotten glade': 'Clairière Oubliée',
                'the gloomwood': "Le Bois d'Ombre",
                'silent siege': 'Siège Silencieux',
                'cold calculus': 'Calcul Glacial',
                'obsidian dread': "Terreur d'Obsidienne",
                'siege of ashes': 'Siège de Cendres',
              };

              const getFiles = (dirName: string) => {
                const dirPath = path.resolve(process.cwd(), 'public/audio', dirName);
                if (!fs.existsSync(dirPath)) return [];
                const files = fs.readdirSync(dirPath);
                const audioFiles = files.filter(f => !f.startsWith('.') && /\.(mp3|wav|ogg|m4a|mp4|aac|flac)$/i.test(f));
                
                const byNumber = new Map<number, { name: string; filename: string; num: number; url: string }>();
                let unnumberedIndex = 100;
                
                for (const f of audioFiles) {
                  const match = f.match(/^\s*(\d+)/) || f.match(/(\d+)/);
                  const parsedNum = match ? parseInt(match[1], 10) : ++unnumberedIndex;
                  const sortNum = parsedNum === 91 ? 10 : parsedNum;

                  const cleanRaw = f.replace(/\.[^/.]+$/, '').trim();
                  const rawWithoutNum = cleanRaw.replace(/^\s*\d+\s*[-_.]?\s*/, '').trim();
                  const key = rawWithoutNum.toLowerCase().replace(/\s+/g, ' ');
                  const translatedName = TRACK_TRANSLATIONS[key] || rawWithoutNum || cleanRaw;
                  
                  const existing = byNumber.get(sortNum);
                  if (!existing || translatedName.length >= existing.name.length) {
                    byNumber.set(sortNum, {
                      name: translatedName,
                      filename: f,
                      num: sortNum,
                      url: `/audio/${dirName}/${encodeURIComponent(f).replace(/%20/g, ' ')}`
                    });
                  }
                }

                return Array.from(byNumber.values()).sort((a, b) => a.num - b.num);
              };

              const data = {
                'playlist-1': getFiles('playlist-1'),
                'playlist-2': getFiles('playlist-2'),
              };

              fs.writeFileSync(path.resolve(process.cwd(), 'public/audio/playlists.json'), JSON.stringify(data, null, 2));
              const distAudio = path.resolve(process.cwd(), 'dist/audio');
              if (fs.existsSync(distAudio)) {
                fs.writeFileSync(path.resolve(distAudio, 'playlists.json'), JSON.stringify(data, null, 2));
              }
              return data;
            } catch (err) {
              return null;
            }
          };

          const syncSfxManifest = () => {
            try {
              const audioExtRegex = /\.(mp3|wav|ogg|m4a|mp4|mpeg|aac|flac)$/i;
              const findSfxFile = (cat: 'grabuge' | 'renards' | 'fantomes') => {
                const subDirCandidates = cat === 'renards' ? ['renards', 'renard'] : cat === 'fantomes' ? ['fantomes', 'fantome'] : ['grabuge'];
                for (const dirName of subDirCandidates) {
                  const dirPath = path.resolve(process.cwd(), 'public/audio/sfx', dirName);
                  if (fs.existsSync(dirPath)) {
                    const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.') && audioExtRegex.test(f));
                    if (files.length > 0) {
                      // Préférer le fichier original déposé par l'utilisateur
                      const chosen = files.find(f => !['renards.mp3', 'fantomes.mp3', 'grabuge.mp4', 'grabuge.mp3'].includes(f)) || files[0];
                      const chosenExt = path.extname(chosen).toLowerCase();

                      // Créer des copies / alias avec noms simples et standardisés
                      try {
                        const standardAlias = `${cat}${chosenExt}`;
                        const sourceFile = path.resolve(dirPath, chosen);
                        const aliasFile = path.resolve(dirPath, standardAlias);
                        if (chosen !== standardAlias && fs.existsSync(sourceFile)) {
                          fs.copyFileSync(sourceFile, aliasFile);
                        }

                        // Synchroniser également vers dist/audio/sfx
                        const distDir = path.resolve(process.cwd(), 'dist/audio/sfx', dirName);
                        if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
                        fs.copyFileSync(sourceFile, path.resolve(distDir, chosen));
                        fs.copyFileSync(sourceFile, path.resolve(distDir, standardAlias));
                      } catch (_) {}

                      return {
                        category: cat,
                        filename: chosen,
                        url: `/api/sfx-audio/${cat}`,
                        exists: true,
                      };
                    }
                  }
                }

                const sfxBaseDir = path.resolve(process.cwd(), 'public/audio/sfx');
                if (fs.existsSync(sfxBaseDir)) {
                  const files = fs.readdirSync(sfxBaseDir).filter(f => !f.startsWith('.') && audioExtRegex.test(f));
                  const matched = files.find(f => {
                    const lower = f.toLowerCase();
                    return subDirCandidates.some(prefix => lower.startsWith(prefix));
                  });
                  if (matched) {
                    return {
                      category: cat,
                      filename: matched,
                      url: `/api/sfx-audio/${cat}`,
                      exists: true,
                    };
                  }
                }

                return {
                  category: cat,
                  filename: null,
                  url: null,
                  exists: false,
                };
              };

              const sfxData = {
                grabuge: findSfxFile('grabuge'),
                renards: findSfxFile('renards'),
                fantomes: findSfxFile('fantomes'),
              };

              fs.writeFileSync(path.resolve(process.cwd(), 'public/audio/sfx.json'), JSON.stringify(sfxData, null, 2));
              const distAudio = path.resolve(process.cwd(), 'dist/audio');
              if (fs.existsSync(distAudio)) {
                fs.writeFileSync(path.resolve(distAudio, 'sfx.json'), JSON.stringify(sfxData, null, 2));
              }
              return sfxData;
            } catch (err) {
              return null;
            }
          };

          syncPlaylistsManifest();
          syncSfxManifest();

          if (server.watcher) {
            server.watcher.on('add', (f: string) => { 
              if (f && f.includes('public/audio')) {
                syncPlaylistsManifest();
                syncSfxManifest();
              }
            });
            server.watcher.on('unlink', (f: string) => { 
              if (f && f.includes('public/audio')) {
                syncPlaylistsManifest();
                syncSfxManifest();
              }
            });
            server.watcher.on('change', (f: string) => { 
              if (f && f.includes('public/audio')) {
                syncPlaylistsManifest();
                syncSfxManifest();
              }
            });
          }

          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/sfx-audio/')) {
              try {
                const parts = req.url.split('/api/sfx-audio/')[1]?.split('?')[0]?.toLowerCase();
                const cat = parts?.startsWith('renard') ? 'renards' : parts?.startsWith('fantom') ? 'fantomes' : 'grabuge';
                const subDir = cat;
                const dirPath = path.resolve(process.cwd(), 'public/audio/sfx', subDir);
                if (fs.existsSync(dirPath)) {
                  const audioExtRegex = /\.(mp3|wav|ogg|m4a|mp4|mpeg|aac|flac)$/i;
                  const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.') && audioExtRegex.test(f));
                  if (files.length > 0) {
                    const chosen = files.find(f => !['renards.mp3', 'fantomes.mp3', 'grabuge.mp4', 'grabuge.mp3'].includes(f)) || files[0];
                    const fullPath = path.resolve(dirPath, chosen);
                    const stat = fs.statSync(fullPath);
                    const ext = path.extname(chosen).toLowerCase();
                    const mime = ext === '.mp4' ? 'video/mp4' : ext === '.wav' ? 'audio/wav' : ext === '.ogg' ? 'audio/ogg' : 'audio/mpeg';
                    res.statusCode = 200;
                    res.setHeader('Content-Type', mime);
                    res.setHeader('Content-Length', stat.size);
                    res.setHeader('Accept-Ranges', 'bytes');
                    fs.createReadStream(fullPath).pipe(res);
                    return;
                  }
                }
                res.statusCode = 404;
                res.end('Not found');
                return;
              } catch (e) {
                res.statusCode = 500;
                res.end(String(e));
                return;
              }
            }

            if (req.url === '/api/sfx-files' || req.url?.startsWith('/api/sfx-files')) {
              try {
                const data = syncSfxManifest() || {
                  grabuge: { category: 'grabuge', filename: null, url: null, exists: false },
                  renards: { category: 'renards', filename: null, url: null, exists: false },
                  fantomes: { category: 'fantomes', filename: null, url: null, exists: false },
                };
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                res.end(JSON.stringify(data));
                return;
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(err) }));
                return;
              }
            }

            if (req.url === '/api/upload-sfx') {
              if (req.method === 'POST') {
                const chunks: any[] = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                  try {
                    const raw = Buffer.concat(chunks).toString('utf8');
                    const parsed = JSON.parse(raw);
                    const category = parsed.category as 'grabuge' | 'renards' | 'fantomes';
                    const filename = (parsed.filename || `${category}.mp3`).replace(/[^a-zA-Z0-9._-]/g, '_');
                    const match = (parsed.audio || '').match(/^data:audio\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
                    if (!match) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: 'Format audio base64 invalide' }));
                      return;
                    }
                    const buffer = Buffer.from(match[1], 'base64');
                    const targetDir = path.resolve(process.cwd(), 'public/audio/sfx', category);
                    fs.mkdirSync(targetDir, { recursive: true });
                    const targetPath = path.resolve(targetDir, filename);
                    fs.writeFileSync(targetPath, buffer);

                    const distTargetDir = path.resolve(process.cwd(), 'dist/audio/sfx', category);
                    if (fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
                      fs.mkdirSync(distTargetDir, { recursive: true });
                      fs.writeFileSync(path.resolve(distTargetDir, filename), buffer);
                    }

                    const manifest = syncSfxManifest();
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, sfx: manifest }));
                  } catch (err) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: String(err) }));
                  }
                });
                return;
              }
            }

            if (req.url === '/api/audio-files' || req.url?.startsWith('/api/audio-files')) {
              try {
                const data = syncPlaylistsManifest() || {
                  'playlist-1': [],
                  'playlist-2': [],
                };

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.end(JSON.stringify(data));
                return;
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(err) }));
                return;
              }
            }

            if (req.url === '/api/upload-logo' || req.url === '/api/sync-logo') {
              if (req.method === 'POST') {
                const chunks: any[] = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                  const raw = Buffer.concat(chunks);
                  try {
                    let fileBuf = raw;
                    try {
                      const text = raw.toString('utf8');
                      const parsed = JSON.parse(text);
                      if (parsed && parsed.image && typeof parsed.image === 'string') {
                        const match = parsed.image.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
                        if (match) {
                          fileBuf = Buffer.from(match[1], 'base64');
                        }
                      }
                    } catch (_) {}

                    const targets = [
                      path.resolve(process.cwd(), 'public/CELINE2.png'),
                      path.resolve(process.cwd(), 'public/image.png'),
                      path.resolve(process.cwd(), 'public/renard-spectre-logo.png'),
                      path.resolve(process.cwd(), 'dist/CELINE2.png'),
                      path.resolve(process.cwd(), 'dist/image.png'),
                      path.resolve(process.cwd(), 'dist/renard-spectre-logo.png'),
                    ];
                    for (const t of targets) {
                      try {
                        fs.mkdirSync(path.dirname(t), { recursive: true });
                        fs.writeFileSync(t, fileBuf);
                      } catch (_) {}
                    }
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                  } catch (e) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: String(e) }));
                  }
                });
                return;
              } else {
                res.statusCode = 405;
                res.end();
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
