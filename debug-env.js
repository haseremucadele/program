const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        const parts = line.split('=');
        if (parts.length > 1) {
            const key = parts[0];
            console.log(`Line ${i + 1}: ${key}=<HIDDEN>`);
        } else {
            console.log(`Line ${i + 1}: [No equals sign] ${line}`);
        }
    });
} catch (e) {
    console.error(e);
}
