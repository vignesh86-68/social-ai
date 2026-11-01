const express = require('express');
const request = require('supertest');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const {
  uploadPostMedia,
  processAndSaveImage,
} = require('../src/services/mediaService');
const errorHandler = require('../src/middleware/errorHandler');

const outputDirectory = path.join(process.cwd(), 'uploads', 'posts');
const createdFiles = [];

const createImage = (format, options = {}) => {
  const { width = 64, height = 48 } = options;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  })
    .withMetadata(options.orientation ? { orientation: options.orientation } : {})
    [format]()
    .toBuffer();
};

const uploadApp = express();
uploadApp.post('/upload', uploadPostMedia.array('images', 4), (req, res) => {
  res.json({ count: req.files.length });
});
uploadApp.use(errorHandler);

describe('Sharp media processing', () => {
  afterEach(async () => {
    await Promise.all(
      createdFiles.splice(0).map((filename) =>
        fs.promises.unlink(path.join(outputDirectory, filename)).catch(() => {})
      )
    );
  });

  it.each(['jpeg', 'png', 'webp'])(
    'processes valid %s input into WebP output',
    async (format) => {
      const input = await createImage(format);
      const result = await processAndSaveImage(input);
      createdFiles.push(result.filename);

      const metadata = await sharp(path.join(outputDirectory, result.filename)).metadata();
      expect(result.url).toMatch(/^\/uploads\/posts\/.+\.webp$/);
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(64);
      expect(metadata.height).toBe(48);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.iptc).toBeUndefined();
    }
  );

  it('auto-orients and resizes large images without enlarging smaller images', async () => {
    const input = await createImage('jpeg', {
      width: 4000,
      height: 1000,
      orientation: 6,
    });
    const result = await processAndSaveImage(input);
    createdFiles.push(result.filename);

    const metadata = await sharp(path.join(outputDirectory, result.filename)).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(2048);
    expect(metadata.orientation).toBeUndefined();
  });

  it('rejects corrupted image data', async () => {
    await expect(processAndSaveImage(Buffer.from('not an image'))).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/invalid image|processing failed/i),
    });
  });

  it('rejects unsupported upload MIME types before processing', async () => {
    const response = await request(uploadApp)
      .post('/upload')
      .attach('images', Buffer.from('plain text'), {
        filename: 'payload.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/unsupported file format/i);
  });

  it('rejects uploads exceeding the 5MB limit', async () => {
    const response = await request(uploadApp)
      .post('/upload')
      .attach('images', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/5MB limit/i);
  });
});
