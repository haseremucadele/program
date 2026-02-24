
// Usage: npx tsx test-signup.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://taydakggvqgywyizhinr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheWRha2dndnFneXd5aXpoaW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjIyMzUsImV4cCI6MjA4MDk5ODIzNX0.FPKTrSKcnN1p5kacOOrYwPJ3QdAcsIxC8sJ1qnTISBg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
    const email = `test.user.${Date.now()}@example.com`;
    const password = 'TestUser123!';

    console.log(`[TEST] Attempting to sign up user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('[TEST] Signup failed:', error.message);
        process.exit(1);
    }

    console.log('[TEST] Signup successful!');
    console.log('User ID:', data.user?.id);
    console.log('Is Anon:', data.user?.is_anonymous);

    if (data.user) {
        console.log('[TEST] Attempting to create profile record...');
        const { error: profileError } = await supabase.from('users').insert([
            {
                auth_id: data.user.id,
                email: email,
                ad_soyad: 'Test User',
                unvan: 'beden_iscisi',
                ilce: 'Karesi',
            },
        ]);

        if (profileError) {
            console.error('[TEST] Profile creation failed:', profileError.message);
        } else {
            console.log('[TEST] Profile created successfully!');
        }
    }
}

testSignup();
