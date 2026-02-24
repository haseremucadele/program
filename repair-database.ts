const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
// const dotenv = require('dotenv'); // Not needed as we parse manually

// Load .env.local manually for connection strings
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key && value) {
                process.env[key] = value;
            }
        }
    });
} catch (e) {
    console.warn('Could not load .env.local', e);
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
}

async function repairDatabase() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase
    });

    try {
        await client.connect();
        console.log('Connected successfully.');

        // 1. Read permissions.sql
        const sqlPath = path.resolve(process.cwd(), 'permissions.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing permissions.sql...');
        // Execute the entire SQL file
        await client.query(sqlContent);
        console.log('permissions.sql executed successfully.');

        // 2. Explicitly call the initialization for Cihan Menevşe to be sure
        console.log('Restoring permissions for menevse.cihan@gmail.com...');

        // Find user ID first
        const userRes = await client.query("SELECT id, unvan FROM public.users WHERE email = 'menevse.cihan@gmail.com'");
        if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            console.log(`User found: ID=${user.id}, Unvan=${user.unvan}`);

            // Call the function we just created/updated in permissions.sql
            // Note: pg library uses $1, $2 for parameterized queries
            await client.query("SELECT public.initialize_user_permissions($1, $2)", [user.id, user.unvan]);
            console.log('Permissions initialized.');
        } else {
            console.error('User menevse.cihan@gmail.com not found!');
        }

    } catch (err) {
        console.error('Database Repair Failed:', err);
    } finally {
        await client.end();
    }
}

repairDatabase();
