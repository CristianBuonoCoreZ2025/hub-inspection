require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function updateUserByEmail(email, updates) {
  // First get the user ID
  const listRes = await fetch(url + '/auth/v1/admin/users?per_page=100', {
    headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey }
  });
  const listData = await listRes.json();
  const user = listData.users?.find(u => u.email === email);
  if (!user) return { error: 'User not found: ' + email };
  
  // Update the user
  const res = await fetch(url + '/auth/v1/admin/users/' + user.id, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + serviceKey,
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) return { error: data };
  return { user: data };
}

async function login(email, password) {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  return { status: res.status, data };
}

(async () => {
  console.log('🔐 Seteando password Paoloxvito099 para cristian.buono-core...\n');
  
  const result = await updateUserByEmail('cristian.buono-core@mclarens.com', {
    password: 'Paoloxvito099'
  });
  
  if (result.error) {
    console.log('✗ Error:', JSON.stringify(result.error));
    return;
  }
  console.log('✓ Password actualizado');
  
  // Probar login
  console.log('\n🔐 Probando login con Paoloxvito099...\n');
  const loginResult = await login('cristian.buono-core@mclarens.com', 'Paoloxvito099');
  if (loginResult.status === 200) {
    console.log('✓ Login OK!');
    console.log('  User:', loginResult.data.user.email);
  } else {
    console.log('✗ Login falló:', JSON.stringify(loginResult.data));
  }
  
  // También setear para otros usuarios conocidos si los necesitas
  console.log('\n📋 Passwords actuales:');
  console.log('  cristian.buono-core@mclarens.com → Paoloxvito099');
  console.log('  Todos los demás → McLarens2025!');
})();
