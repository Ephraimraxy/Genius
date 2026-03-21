const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

async function check() {
  const filePath = path.join('d:', 'Junks', 'TODAY', 'Publish AI', 'tools', 'test.pdf');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  console.log('Pages:', data.numpages);
  console.log('--- Metadata ---');
  console.log(JSON.stringify(data.info, null, 2));
  console.log('--- Text Snippet (First 1000 chars) ---');
  console.log(data.text.substring(0, 1000));
}

check();
