import fs from 'fs';
import sharp from 'sharp';
import path from 'path';

async function generateIcons() {
  const svgPath = path.resolve('public', 'favicon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate 180x180 for apple-touch-icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('public', 'apple-touch-icon.png'));

  // Generate 192x192 for android/manifest
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('public', 'android-chrome-192x192.png'));

  // Generate 512x512 for manifest
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public', 'android-chrome-512x512.png'));

  // Generate 32x32 standard favicon
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.resolve('public', 'favicon-32x32.png'));

  // Delete the old Astro favicon.ico
  if (fs.existsSync(path.resolve('public', 'favicon.ico'))) {
    fs.unlinkSync(path.resolve('public', 'favicon.ico'));
  }
}

generateIcons().then(() => console.log('Icons generated successfully!')).catch(console.error);
