require('dotenv').config();
const INRDealsService = require('./src/services/inrDealsService');

async function check() {
  try {
    const res = await INRDealsService.getCampaigns({ page_size: 1 });
    console.log("Shape of first campaign:", JSON.stringify(res.data[0], null, 2));
  } catch(e) { console.error(e) }
}
check();
