
const fs = require('fs');
const path = 'c:\\Users\\ricar\\AppData\\Local\\Programs\\Antigravity\\resources\\app\\extensions\\antigravity\\dist\\extension.js';
const outPath = 'c:\\Users\\ricar\\Antigravity Omni-Quota\\snippet_out_4.txt';

try {
    const content = fs.readFileSync(path, 'utf8');
    const target = 'setupRoutes';
    const index = content.indexOf(target);
    
    if (index === -1) {
        fs.writeFileSync(outPath, 'TARGET NOT FOUND');
    } else {
        const start = Math.max(0, index - 500);
        const end = Math.min(content.length, index + 500);
        const snippet = content.substring(start, end);
        fs.writeFileSync(outPath, snippet);
        console.log('Snippet written to file.');
    }
} catch (e) {
    console.log('ERROR:', e.message);
}
