/*
 * FileBlobs - how a stored document or proof file is opened or downloaded in the static copy.
 */
(function () {
  'use strict';


  /* A stored document: the uploaded file itself, or (seeded documents) a small generated PDF placeholder */
  window.FileBlobs = {
    from(meta) {
      if (meta && meta.dataUrl) {
        const [head, data] = meta.dataUrl.split(',');
        const type = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
        const bytes = atob(data);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new Blob([arr], { type });
      }
      return FileBlobs.pdf(`${(meta && meta.title) || 'Document'} - ${(meta && meta.fileName) || ''}`, 'Synthetic development document - not a real personal document.');
    },
    pdf(title, line) {
      const text = (s) => s.replace(/[()\\]/g, '');
      const stream = `BT /F1 18 Tf 72 720 Td (${text(title)}) Tj ET\nBT /F1 11 Tf 72 690 Td (${text(line)}) Tj ET`;
      const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      ];
      let out = '%PDF-1.4\n';
      const offsets = [];
      objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
      out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return new Blob([out], { type: 'application/pdf' });
    },
  };
})();
