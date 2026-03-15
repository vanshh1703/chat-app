import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

const filesToDownload = [
    { url: 'https://unpkg.com/@vladmandic/face-api/model/tiny_face_detector_model-weights_manifest.json', name: 'tiny_face_detector_model-weights_manifest.json' },
    { url: 'https://unpkg.com/@vladmandic/face-api/model/tiny_face_detector_model.bin', name: 'tiny_face_detector_model.bin' },
    { url: 'https://unpkg.com/@vladmandic/face-api/model/face_landmark_68_tiny_model-weights_manifest.json', name: 'face_landmark_68_tiny_model-weights_manifest.json' },
    { url: 'https://unpkg.com/@vladmandic/face-api/model/face_landmark_68_tiny_model.bin', name: 'face_landmark_68_tiny_model.bin' }
];

const download = (originalUrl, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const requestUrl = (urlStr) => {
            https.get(urlStr, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    let location = response.headers.location;
                    if (location && location.startsWith('/')) {
                        location = 'https://unpkg.com' + location; // handle unpkg relative redirects
                    }
                    requestUrl(location);
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        };
        requestUrl(originalUrl);
    });
};

(async () => {
    try {
        for (const file of filesToDownload) {
            console.log(`Downloading ${file.name}...`);
            await download(file.url, path.join(modelsDir, file.name));
        }
        console.log('Done downloading models!');
    } catch(err) {
        console.error('Error downloading:', err);
        process.exit(1);
    }
})();
