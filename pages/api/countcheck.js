import mongoose from 'mongoose';
import BurnRecord from '../../lib/models'; // Assuming the model is in the 'models' directory

// Connect to MongoDB
const connectToDatabase = async () => {
  if (mongoose.connections[0].readyState) {
    // Already connected to the database
    return;
  }

  // Replace this with your MongoDB URI
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name';

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw new Error('Failed to connect to MongoDB');
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { walletAddress } = req.query;

  if (!walletAddress) {
    return res.status(400).json({ success: false, message: 'Wallet address is required' });
  }

  try {
    // Connect to the database
    await connectToDatabase();

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
