
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key && value) {
            envVars[key] = value;
        }
    }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPermissions() {
    console.log('Checking user permissions...');

    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, ad_soyad, unvan, email');

    if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
    }

    for (const user of users) {
        const { data: permissions, error: permsError } = await supabase
            .from('user_permissions')
            .select('permission_id')
            .eq('user_id', user.id);

        if (permsError) {
            console.error(`Error fetching permissions for ${user.ad_soyad}:`, permsError);
            continue;
        }

        const permissionList = permissions.map(p => p.permission_id);
        console.log(`User: ${user.ad_soyad} (${user.unvan})`);
        console.log(`Permissions: ${permissionList.join(', ')}`);
        console.log(`Has attendance:view? ${permissionList.includes('attendance:view') ? 'YES' : 'NO'}`);
        console.log('-----------------------------------');
    }
}

checkPermissions();
