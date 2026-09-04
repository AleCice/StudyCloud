const sharp = require('sharp');
const path = require('path');

const SOURCE = 'C:\\Users\\fight\\.gemini\\antigravity-ide\\brain\\a48775a3-1c79-4169-b103-3eef2dd049ba\\app_icon_1788539860344.jpg';
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

async function generate() {
  const sizes = [
    { name: 'icon-192x192.png', size: 192 },
    { name: 'icon-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(OUT_DIR, name));
    console.log(`OK ${name} (${size}x${size})`);
  }
  console.log('Done!');
}

generate().catch(console.error);
