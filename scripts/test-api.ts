async function testApi() {
  const res = await fetch('http://localhost:3000/api/marketplace/listings/search?type=RENT&limit=10');
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Total items:', data.items?.length);
  if (data.items?.length > 0) {
    console.log('Sample item:', JSON.stringify(data.items[0], null, 2));
  }
}

testApi().catch(console.error);

