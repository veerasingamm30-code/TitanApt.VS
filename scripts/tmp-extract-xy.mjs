import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const pdfPath = process.argv[2] || 'E:/VEERASINGAM/TitanApt.VS/Img-pdf/MOCK TEST.pdf.pdf';
const outPath = process.env.DUMP_OUT || 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt/mock-test-xy.txt';

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: false }).promise;
const lines = [];
lines.push(`PAGES: ${doc.numPages}`);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  // group items into lines by y
  const rows = [];
  let cur = null;
  for (const item of tc.items) {
    if (item.str === '') continue;
    const y = Math.round(item.transform[5] * 10) / 10;
    const x = Math.round(item.transform[4] * 10) / 10;
    if (!cur || Math.abs(cur.y - y) > 1.5) {
      cur = { y, x, text: '' };
      rows.push(cur);
    }
    cur.text += item.str + (item.hasEOL ? '' : '');
  }
  lines.push(`===== PAGE ${p} =====`);
  for (const r of rows) {
    if (r.text.trim() === '') continue;
    lines.push(`@${r.x.toFixed(1)}| ${r.text}`);
  }
}
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('wrote', outPath, 'pages', doc.numPages);
