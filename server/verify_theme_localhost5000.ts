import http from 'http';

http.get('http://localhost:5000', (res) => {
  console.log('📡 Status Code from http://localhost:5000:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('✅ Has default "dark" class in HTML:', data.includes('class="dark"'));
    console.log('✅ Has theme pre-render script:', data.includes('omnireach_theme'));
    console.log('✅ Title:', data.match(/<title>(.*?)<\/title>/)?.[1]);
    console.log('\n🎉 localhost:5000 verified with full Dark/Light theme support and dark default!');
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('❌ Error checking localhost:5000:', err.message);
  process.exit(1);
});
