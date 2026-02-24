import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
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
    });
} catch (e) {
    console.warn('Could not load .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taydakggvqgywyizhinr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'menevse.cihan@gmail.com';
    console.log(`Checking for user with email: ${email}`);

    // Check public.users
    const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (publicError) console.error('Public User Error:', publicError.message);
    else {
        console.log('Public User Found:', publicUser.ad_soyad);

        // Fetch permissions manually
        const { data: perms, error: permsError } = await supabase
            .from('user_permissions')
            .select('permission_id')
            .eq('user_id', publicUser.id);

        if (permsError) console.error('Permissions Error:', permsError.message);
        else console.log('Permissions Found:', perms?.map(p => p.permission_id));
    }

    if (publicError) console.error('Public User Error:', publicError.message);
    else console.log('Public User Found:', publicUser);

    // Check auth.users (requires admin)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);

    if (authError) console.error('Auth User Error:', authError.message);
    else console.log('Auth User Found:', authUser ? authUser.id : 'No');
}

checkUser();
