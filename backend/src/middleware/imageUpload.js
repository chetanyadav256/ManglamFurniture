import multer from 'multer';

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const types = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
export const imageError = (status, message) => Object.assign(new Error(message), { status });

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_IMAGES, fileSize: MAX_IMAGE_BYTES + 1, fields: 0, parts: MAX_IMAGES + 1, fieldNameSize: 100, headerPairs: 100 },
  fileFilter(req, file, callback) {
    callback(types.has(file.mimetype) ? null : imageError(415, 'Only JPEG, PNG and WebP images are accepted.'), true);
  },
}).array('images', MAX_IMAGES);

export async function parseImages(req, res) {
  if (!req.is('multipart/form-data')) throw imageError(415, 'Use multipart/form-data with the images field.');
  if (Number(req.get('content-length')) > MAX_IMAGES * MAX_IMAGE_BYTES + 64 * 1024) {
    throw imageError(413, 'Upload exceeds the request size limit.');
  }
  await new Promise((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer);
      reject(imageError(400, 'Upload interrupted.'));
    };
    req.once('aborted', aborted);
    const timer = setTimeout(() => req.destroy(), 30000);
    parser(req, res, (error) => {
      clearTimeout(timer);
      req.removeListener('aborted', aborted);
      if (!error) return resolve();
      if (error instanceof multer.MulterError) {
        return reject(imageError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
          error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be at most 5 MB.' : 'Use only the images field with at most five files and no text fields.'));
      }
      reject(error.status ? error : imageError(400, 'Invalid multipart upload.'));
    });
  });
  if (!req.files?.length) throw imageError(400, 'Select at least one image.');
  for (const file of req.files) {
    if (file.size > MAX_IMAGE_BYTES) throw imageError(413, 'Each image must be at most 5 MB.');
    const b = file.buffer;
    let format;
    if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      && b.readUInt32BE(8) === 13 && b.toString('ascii', 12, 16) === 'IHDR'
      && b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0
      && b.length >= 45 && b.toString('ascii', b.length - 8, b.length - 4) === 'IEND') format = 'png';
    if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255
      && b[b.length - 2] === 255 && b[b.length - 1] === 217) format = 'jpg';
    if (b.length >= 20 && b.toString('ascii', 0, 4) === 'RIFF' && b.readUInt32LE(4) === b.length - 8
      && b.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(b.toString('ascii', 12, 16))) format = 'webp';
    if (!format || format !== types.get(file.mimetype)) throw imageError(415, 'Image content does not match an accepted format.');
    file.detectedFormat = format;
  }
}
