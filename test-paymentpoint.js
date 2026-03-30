import fetch from 'node-fetch';

const PAYMENTPOINT_API_KEY = process.env.PAYMENTPOINT_API_KEY;
const PAYMENTPOINT_BUSINESS_ID = process.env.PAYMENTPOINT_BUSINESS_ID;
const PAYMENTPOINT_SECRET_KEY = process.env.PAYMENTPOINT_SECRET_KEY;

async function testPaymentPoint() {
  if (!PAYMENTPOINT_API_KEY || !PAYMENTPOINT_BUSINESS_ID || !PAYMENTPOINT_SECRET_KEY) {
    throw new Error('Set PAYMENTPOINT_API_KEY, PAYMENTPOINT_BUSINESS_ID, and PAYMENTPOINT_SECRET_KEY before running this test.');
  }

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
