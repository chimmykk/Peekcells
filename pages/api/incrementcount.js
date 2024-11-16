import connectDB from '../../lib/dbconnect';
import BurnRecord from '../../lib/models';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  await connectDB(); // Connect to the database

  const { walletAddress, incrementBy } = req.body;

  try {
    const result = await BurnRecord.findOneAndUpdate(
      { walletAddress },
      { $inc: { burnCount: incrementBy } },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: 'Burn count updated', result });
  } catch (error) {
    console.error('Error updating burn count:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
} 