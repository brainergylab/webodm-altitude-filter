const fs = require('fs');
const file = './tests/example-exif-data/IMG_0001_1.tif';

const buffer = fs.readFileSync(file);
const startSlice = buffer.slice(0, 256 * 1024).toString('utf8');
const endSlice = buffer.slice(Math.max(0, buffer.length - 256 * 1024)).toString('utf8');
const text = startSlice + " " + endSlice;

let isPanel = false;

const calPicMatch = text.match(/Camera:CalibrationPicture=["']?(\d+)/i) || 
                    text.match(/<Camera:CalibrationPicture>(\d+)<\/Camera:CalibrationPicture>/i);
const hasPanelSerial = /Camera:PanelSerial/i.test(text);

console.log("calPicMatch:", calPicMatch ? calPicMatch[1] : null);
console.log("hasPanelSerial:", hasPanelSerial);

if ((calPicMatch && parseInt(calPicMatch[1], 10) === 2) || hasPanelSerial) {
    isPanel = true;
}

if (!isPanel) {
    console.error("❌ TEST FAILED: Panel image was not detected correctly by the fast regex parser.");
    process.exit(1);
}

console.log("✅ TEST PASSED: Panel image detected successfully.");
