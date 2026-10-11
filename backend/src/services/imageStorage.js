import { getCloudinary, IMAGE_FOLDER } from '../config/cloudinary.js';

// Object methods form the isolated test boundary; tests never contact Cloudinary.
export const imageStorage = {
  upload(buffer, publicId) {
    return new Promise((resolve, reject) => {
      const stream = getCloudinary().uploader.upload_stream({
        public_id: publicId,
        asset_folder: IMAGE_FOLDER,
        resource_type: 'image',
        type: 'upload',
        allowed_formats: ['jpg', 'png', 'webp'],
        overwrite: false,
        timeout: 60000,
      }, (error, result) => error ? reject(new Error('Image upload failed.')) : resolve(result));
      stream.on('error', () => reject(new Error('Image upload failed.')));
      stream.end(buffer);
    });
  },
  async destroy(publicId) {
    const result = await getCloudinary().uploader.destroy(publicId, {
      resource_type: 'image', type: 'upload', invalidate: true, timeout: 30000,
    });
    if (!['ok', 'not found'].includes(result.result)) throw new Error('Image cleanup failed.');
  },
};
