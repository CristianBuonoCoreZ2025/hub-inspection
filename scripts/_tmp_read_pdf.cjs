const fs = require("fs");
const { PDFParse } = require("pdf-parse");

async function run() {
  for (const f of ["c:/Users/crist/Downloads/87615-19238.pdf", "c:/Users/crist/Downloads/acta.pdf"]) {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("FILE:", f);
    console.log("══════════════════════════════════════════════════════════════");
    const buf = fs.readFileSync(f);
    const uint8 = new Uint8Array(buf);
    const parser = new PDFParse(uint8);
    const data = await parser.getText();
    console.log(data);
  }
}

run().catch(console.error);
