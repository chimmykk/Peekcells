import connectDB from './dbconnect'; // Adjust path as needed
import BurnRecord from '../../lib/models';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { walletAddress } = req.query;

  if (!walletAddress) {
    return res.status(400).json({ success: false, message: 'Wallet address is required' });
  }

  try {
    // Connect to the database using imported function
    await connectDB();

    // Find the burn record for the given address
    const burnRecord = await BurnRecord.findOne({ walletAddress });

    if (!burnRecord) {
      return res.status(404).json({ success: false, message: 'Burn record not found for the given address' });
    }

    return res.status(200).json({ success: true, walletAddress, burnCount: burnRecord.burnCount });
  } catch (error) {
    console.error('Error retrieving burn record:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
