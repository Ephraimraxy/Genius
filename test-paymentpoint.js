import fetch from 'node-fetch';

// The credentials from .env.example
const PAYMENTPOINT_API_KEY = "19085ad3e44547fa426b4f3906983aa116c5f558";
const PAYMENTPOINT_BUSINESS_ID = "efc92704614b5559c8d742ea71cd1c7641002022";
const PAYMENTPOINT_SECRET_KEY = "536f87279e4671e59ace4a04d132cd24cf5353a667b7b3d1423f778b886850967ccd01bfc189e782b17981eab823f0a4551aa6ac28fd0f520a364426";

async function testPaymentPoint() {
  console.log('Testing PaymentPoint Virtual Account Creation...');
  console.log('Using endpoint: https://api.paymentpoint.co/api/v1/createVirtualAccount');

  try {
    const response = await fetch('https://api.paymentpoint.co/api/v1/createVirtualAccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENTPOINT_SECRET_KEY}`,
        'api-key': PAYMENTPOINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test Setup',
        phoneNumber: '08012345678',
        bankCode: ['20946', '20897'],
        businessId: PAYMENTPOINT_BUSINESS_ID
      })
    });

    console.log(`\nHTTP Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    
    if (text.startsWith('<')) {
      console.log('RESPONSE IS HTML (Likely a 404 page):');
      console.log(text.substring(0, 500) + '... (truncated)');
    } else {
      console.log('RESPONSE JSON:');
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    }

  } catch (error) {
    console.error('Error hitting the API:', error);
  }
}

testPaymentPoint();
