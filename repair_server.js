const fs = require('fs');
const path = require('path');

// Use absolute path for Windows
const filePath = 'd:\\Junks\\TODAY\\Publish AI\\server.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Use very stable markers that haven't changed
const startMarker = "const journalLogoBase64 = getBase64Image('journal-logo.png');";
const nsukMarker = "const nsukLogoBase64 = getBase64Image('Nasarawa-State-University.jpg');";
const endMarker = "const executablePaths = [";

const startIndex = content.indexOf(nsukMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const prefix = content.substring(0, startIndex + nsukMarker.length);
    const suffix = content.substring(endIndex);
    
    // Inject the cleaned middle part
    const middle = `

  // Content Scrubbing Layer: Eliminates Ghost Headers & Layout Bloat
  const scrubbedContent = paper.formatted_content
    .replace(/<div class="header-sheet"[\\s\\S]*?<\\/div>/g, '') 
    .replace(/<div class="paper-sheet"[^>]*>/g, '')           
    .replace(/<\\/div>\\s*<div class="paper-sheet"[^>]*>/g, '') 
    .replace(/page-break-after:\\s*always/gi, 'page-break-after: auto') 
    .replace(/\\`\\`\\`html|\\`\\`\\`/g, '');                            

  const fullHtml = \\`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { 
          margin: 35mm 15mm 25mm 15mm; 
          size: A4;
        }
        body { 
          font-family: serif; 
          background: white; 
          margin: 0; 
          padding: 0; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
          font-size: 10.5pt; 
          color: #1e293b; 
        }
        * { box-sizing: border-box; }
        
        .academic-content {
          font-family: serif;
          font-size: 10.5pt;
          line-height: 1.4;
          text-align: justify;
          color: #1e293b;
          padding: 0 5mm;
        }
        .academic-content p {
          text-align: justify;
          margin-bottom: 0.8em;
          orphans: 3;
          widows: 3;
        }
        .academic-content h1, .academic-content h2, .academic-content h3 {
          color: #0f172a;
          margin-top: 1.2em;
          margin-bottom: 0.4em;
          font-weight: 600 !important;
          line-height: 1.2;
          text-align: left !important;
          page-break-after: avoid;
        }
        .academic-content h1 { font-size: 1.6em; margin-bottom: 0.8em; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.5em; }
        .academic-content h2 { font-size: 1.3em; border-left: 3.5px solid #800000; padding-left: 12px; }
        .academic-content h3 { font-size: 1.15em; font-style: italic; color: #475569; }
        
        table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
        th { background: #f8fafc; font-weight: bold; color: #475569; }
        
        img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="academic-content">
        \\${scrubbedContent}
      </div>
    </body>
    </html>
  \\`;

  `;
    
    fs.writeFileSync(filePath, prefix + middle + suffix, 'utf8');
    console.log('SUCCESS: server.ts repaired successfully.');
} else {
    console.error('ERROR: Markers not found!', { startIndex, endIndex });
    process.exit(1);
}
