// Empties the screenshot report folder once at the start of a capture run (see capture.spec.js).
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const out = path.join(__dirname, '..', '..', 'visual-report');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
};
