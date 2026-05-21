const fetch = require('node-fetch');

async function testLogin() {
  const url = 'http://localhost:3000/api/auth/login';
  const body = {
    login: 'admin',
    senha: 'ecoscoreadmin'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testLogin();
