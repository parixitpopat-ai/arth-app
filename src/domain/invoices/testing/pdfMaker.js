// TEST-ONLY helper: writes tiny valid PDFs (and deliberately broken ones) so the pdf.js path can be tested with no real invoice and no PDF library.
// makePdf([{ texts:[{str,x,y,size}], image:{x,y,w,h} }]) -> Uint8Array. Text uses Helvetica; an image is a 2x2 raw RGB picture scaled to w x h.
// "₹" (U+20B9) is written as byte 185, which the font's Differences table names uni20B9 so pdf.js reads it back as ₹.
const esc = s => String(s).replace(/[\\()]/g, m => "\\" + m).replace(/\u20B9/g, "\\271");

export function makePdf(pages) {
  const objs = []; const add = body => { objs.push(body); return objs.length; };
  const catalog = add(""), pagesObj = add(""), font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [185 /uni20B9] >> >>");
  const kids = [];
  for (const pg of pages) {
    let content = "", xobj = "";
    for (const t of pg.texts || []) content += `BT /F1 ${t.size || 8} Tf ${t.x} ${t.y} Td (${esc(t.str)}) Tj ET\n`;
    if (pg.image) {
      const { x, y, w, h } = pg.image, img = add(`<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 12 >>\nstream\n${String.fromCharCode(255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 200, 200)}\nendstream`);
      content += `q ${w} 0 0 ${h} ${x} ${y} cm /Im1 Do Q\n`; xobj = `/XObject << /Im1 ${img} 0 R >>`;
    }
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Contents ${stream} 0 R /Resources << /Font << /F1 ${font} 0 R >> ${xobj} >> >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((b, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, c => c.charCodeAt(0) & 255);
}
