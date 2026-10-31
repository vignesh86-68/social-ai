const sharp = require('sharp');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');

const POSTS_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'posts');
if (!fs.existsSync(POSTS_UPLOAD_DIR)) {
  fs.mkdirSync(POSTS_UPLOAD_DIR, { recursive: true });
}

// Memory storage so sharp can inspect and re-encode buffers before saving to disk
const uploadPostMedia = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image limit
    files: 4, // Max 4 images per post
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Unsupported file format. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
    }
  },
});

/**
 * Process an image buffer using Sharp:
 * 1. Validates real image binary structure.
 * 2. Strips all EXIF / geolocation metadata for privacy & security.
 * 3. Normalizes orientation.
 * 4. Resizes to max width 2048px (preserving aspect ratio).
 * 5. Re-encodes to optimized WebP format.
 * 6. Writes securely to uploads/posts directory.
 */
const processAndSaveImage = async (buffer) => {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata || !metadata.format) {
      throw ApiError.badRequest('Corrupted or invalid image structure');
    }

    const filename = `${uuidv4()}.webp`;
    const outputPath = path.join(POSTS_UPLOAD_DIR, filename);

    // Re-encode, remove metadata, auto-orient, cap dimensions
    const processed = await image
      .rotate() // auto-orient based on EXIF before stripping
      .resize({
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 4 })
      .toFile(outputPath);

    return {
      url: `/uploads/posts/${filename}`,
      filename,
      width: processed.width,
      height: processed.height,
    };
  } catch (err) {
    if (err.isOperational) throw err;
    throw ApiError.badRequest(`Image processing failed: ${err.message}`);
  }
};

module.exports = {
  uploadPostMedia,
  processAndSaveImage,
};

