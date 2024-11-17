"use client";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { useMetaMask } from "../components/metamask"; // Ensure proper export/import
import { formatAddress } from "../lib/utils";
import WalletIcon from "../public/icons/WalletIcon"; // Ensure proper export/import
import { ethers } from "ethers";
import '@fontsource/micro-5';


// The contract address for the ERC721 token
const contractAddress = "0xd8e909bB2a1733AAA95E62d6257a87fd0b4064A0";

// ERC-721 standard ABI for ownerOf and totalSupply functions
const abi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function setApprovalForAll(address operator, bool approved) external",
];

// The batch transfer ABI for ERC721BatchTransfer contract
const ERC721_BATCH_TRANSFER_ABI = [
  "function batchTransferToSingleWallet(address erc721Contract, address to, uint256[] calldata tokenIds) external",
];

// The ERC721BatchTransfer contract address (set to dead address for burning)
const batchTransferAddress = "0xB508EE6cbddF4a1414abdDB26D467eAc5a9F5B8b"; // Replace with actual address

// Connect to the ApeChain provider using rpc.apechain.com
const provider = new ethers.JsonRpcProvider("https://rpc.apechain.com"); // Use the correct RPC endpoint
const contract = new ethers.Contract(contractAddress, abi, provider);

export const ConnectWalletButton = () => {
  const { account, signer, connected, connect, disconnect } = useMetaMask();
  const [ownedTokenIds, setOwnedTokenIds] = useState<string[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [selectionCount, setSelectionCount] = useState<number>(0); // To track the number of tokens to select
  const [isLoading, setIsLoading] = useState<boolean>(false); // Add this line to define isLoading

  const fetchOwnedTokenIds = async (walletAddress: string) => {
    try {
      const totalSupply = await contract.totalSupply();
      console.log(`Total supply of tokens: ${totalSupply}`);
  
      // Ensure to handle BigNumber properly
      const supply = totalSupply.toNumber ? totalSupply.toNumber() : parseInt(totalSupply.toString(), 10);
      
      const tokenIds = Array.from({ length: supply }, (_, i) => i + 1); // Generate an array of token IDs
  
      // Fetch all token owners in parallel
      const ownerPromises = tokenIds.map(async (tokenId) => {
        try {
          const owner = await contract.ownerOf(tokenId);
          return { tokenId, owner };
        } catch (error) {
          console.error(`Error fetching owner for token ID ${tokenId}:`, error);
          return null; // Return null for tokens that fail
        }
      });
  
      const ownerResults = await Promise.all(ownerPromises);
  
      // Filter out null results and collect owned tokens
      const ownedTokens = ownerResults
        .filter((result): result is { tokenId: number; owner: any } => result !== null && result.owner.toLowerCase() === walletAddress.toLowerCase())
        .map((result) => result.tokenId.toString());
  
      setOwnedTokenIds(ownedTokens);
  
      if (ownedTokens.length > 0) {
        console.log(`Token IDs owned by the address: ${ownedTokens.join(", ")}`);
      } else {
        console.log("No tokens owned by this address.");
      }
    } catch (error) {
      console.error("Error fetching total supply or token ownership:", error);
    }
  };
  


  const handleSelectTokens = (count: number) => {
    setSelectionCount(count);
    setSelectedTokenIds(ownedTokenIds.slice(0, count)); // Select the first `count` tokens
  };

  const batchTransferTokens = async () => {
    if (!signer) {
      console.error("Signer not available, please connect wallet");
      return;
    }

    if (selectedTokenIds.length === 0) {
      console.error("No tokens selected for transfer");
      return;
    }

    try {
  
      const nftContract = new ethers.Contract(contractAddress, abi, signer);
      const approvalTx = await nftContract.setApprovalForAll(batchTransferAddress, true);
      await approvalTx.wait();
      console.log("ERC721BatchTransfer contract approved to manage all tokens");

      // Transfer tokens in a batch
      const ERC721BatchTransfer = new ethers.Contract(batchTransferAddress, ERC721_BATCH_TRANSFER_ABI, signer);
      const toAddress = "0x000000000000000000000000000000000000dEaD"; // Replace with actual address for burning or other destination

      const tokenIds = selectedTokenIds.map(id => parseInt(id));

      const transferTx = await ERC721BatchTransfer.batchTransferToSingleWallet(
        contractAddress,
        toAddress,
        tokenIds
      );
      await transferTx.wait();

      console.log(`Tokens ${selectedTokenIds.join(", ")} successfully transferred to ${toAddress}`);
      setSelectedTokenIds([]); // Clear selected tokens after transfer

      // Send a request to update the burn count
      const response = await fetch('api/incrementcount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account,
          incrementBy: tokenIds.length, 
        }),
      });

      if (!response.ok) {
        console.error("Failed to increment burn count:", response.statusText);
      } else {
        const data = await response.json();
        console.log("Burn count updated successfully:", data);
      }

    } catch (error) {
      console.error("Error during batch transfer:", error);
    }
  };

  const claimToken = async () => {
    if (!account) {
      console.error("No connected wallet");
      return;
    }

    try {
      const response = await fetch('https://est-94xx.onrender.com/claimtoken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toAddress: account, // Pass the connected wallet address
        }),
      });

      if (!response.ok) {
        console.error("Failed to claim token:", response.statusText);
      } else {
        const data = await response.json();
        console.log("Token claimed successfully:", data);
      }
    } catch (error) {
      console.error("Error claiming token:", error);
    }
  };

  useEffect(() => {
    if (account) {
      fetchOwnedTokenIds(account);
    }
  }, [account]);

return (
  <div className="min-h-screen w-full bg-[#8787FF]">
    {/* Hero Section */}
    <div className="container mx-auto px-4 pt-8">
      <div className="flex justify-end mb-8">
        {connected ? (
          <Popover>
            <PopoverTrigger>
              <Button className="bg-white hover:bg-gray-100 text-black font-pixel border-2 border-black px-6 py-2">
                {account ? formatAddress(account) : "No Account"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="bg-white border-2 border-black">
              <button
                onClick={disconnect}
                className="w-full px-4 py-2 text-black font-pixel hover:bg-gray-100"
              >
                Disconnect
              </button>
            </PopoverContent>
          </Popover>
        ) : (
          <Button 
            onClick={connect}
            className="bg-white hover:bg-gray-100 text-black font-pixel border-2 border-black px-6 py-2"
          >
            Connect wallet
          </Button>
        )}
      </div>

      <div className="text-center mb-16">
      <h1 className="font-pixel text-8xl text-white mb-8">
  MINI APE CHAIN BURN
</h1>

<p
  className="text-white max-w-3xl mx-auto leading-relaxed text-lg"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>
  GET READY FOR SOMETHING SPECIAL! THE MINI APE CHAIN BURN EVENT IS YOUR CHANCE TO 
  EXCHANGE YOUR MINI APE CHAIN NFTS FOR EXCLUSIVE REWARDS WHILE CELEBRATING THE MINIS' 
  ARRIVAL ON APE CHAIN.
</p>

      </div>
    </div>

    {/* How It Works Section */}
    <div className="bg-[#FFD15B] py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <img 
              src="./logo.png" 
              alt="Mini Ape" 
                       className="rounded-lg transform transition-transform hover:scale-110"
            />
          </div>
          <div className="space-y-6">
          <h2 
  className="font-pixel text-3xl mb-4" 
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold', color: 'white' }}
>
  HOW IT WORKS:
</h2>
            <div 
  className="space-y-4" 
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold', color: 'white' }}
>
  <p>
    BURN YOUR MINI APE CHAIN PIECES AND RECEIVE CURTIS HIDEAWAY, 
    A LIMITED-EDITION NFT (ONLY 100 AVAILABLE IN TOTAL)!
  </p>

  <br>
  </br>
  <p
  className="font-pixel text-white text-2xl mb-8 uppercase"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold', color: 'white' }}
>
  DEPENDING ON HOW MANY YOU BURN, YOU CAN UNLOCK ADDITIONAL REWARDS:
</p>


  <ul className="space-y-2">
    <li>• BURN 5 MINIS: RECEIVE THE EXCLUSIVE CURTIS HIDEAWAY NFT</li>
    <li>• BURN 15 MINIS: GET CURTIS HIDEAWAY + A BASED MINIS NFT</li>
    <li>• BURN 25 MINIS: RECEIVE CURTIS HIDEAWAY + A BASED MINIS NFT + 
        AN ENTRY INTO THE RAFFLE FOR A CUSTOM MINI ANIMATION
    </li>
  </ul>
</div>
<br>
</br>
<p
  className="font-pixel text-white text-sm mb-8 uppercase"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold', color: 'white' }}
>
  ACT FAST—CURTIS HIDEAWAY IS LIMITED, AND THIS PIECE IS YOUR GATEWAY TO AN ICONIC MOMENT FOR MINIS ON APE CHAIN.
</p>


          </div>
        </div>
      </div>
    </div>

    {/* About Curtis Section */}
    <div className="bg-[#9B8AC4] py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
          <h2
  className="font-pixel text-3xl text-white mb-4"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>
  ABOUT CURTIS HIDEAWAY
</h2>

<p
  className="font-pixel text-white leading-relaxed mb-4"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>
  Curtis Hideaway is a cozy, vibrant scene capturing the Minis’ good vibes on Ape Chain, featuring Curtis and friends in their post-Ape Fest chill zone. Each detail is a nod to the energy and creativity of the Based Minis community, and this piece is exclusively available through the burn event.
</p>
<br>

</br>

<h2
  className="font-pixel text-3xl text-white mb-4"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>
 WHY JOIN THIS BURNED?
</h2> 
<p
  className="font-pixel text-white leading-relaxed mb-4"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>


This event marks Peekcell’s first step onto Ape Chain, bringing Based Minis into a new world. It’s not just about owning exclusive art; it’s about being part of this milestone moment and celebrating the Minis spreading good vibes across collections and chains.


</p>
          </div>
          <div>
            <img 
              src="./curtis.png" 
              alt="Curtis Hideaway" 
               className="rounded-lg ml-auto transform transition-transform hover:scale-110"
            />
          </div>
        </div>
      </div>
    </div>

    {/* Burn Section */}
    <div className="bg-[#66CDAA] py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-8">
          <div className="text-center">
          <h2
  className="font-pixel text-4xl text-white mb-8"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>
  START YOUR BURN NOW
</h2>

            {connected && (
              <div className="max-w-md mx-auto space-y-4">
                <select
                  onChange={(e) => handleSelectTokens(parseInt(e.target.value))}
                  className="w-full p-3 bg-white text-black font-pixel border-2 border-black rounded-none"
                >
                  <option value="0">SELECT NUMBER OF TOKENS</option>
                  <option value="5">5 TOKENS</option>
                  <option value="15">15 TOKENS</option>
                  <option value="25">25 TOKENS</option>
                </select>

                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={batchTransferTokens}
                    disabled={selectionCount === 0}
                    className="bg-white hover:bg-gray-100 text-black font-pixel border-2 border-black px-6 py-2"
                  >
                    BURN SELECTED
                  </Button>
                  <Button 
                    onClick={claimToken}
                    className="bg-white hover:bg-gray-100 text-black font-pixel border-2 border-black px-6 py-2"
                  >
                    CLAIM TOKEN
                  </Button>
                </div>

                <div
  className="mt-8 font-pixel text-sm"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold', color: 'white' }}
>
  <p>HOW TO BURN:</p>
  <ol className="text-left list-decimal pl-6 space-y-2 mt-2">
    <li>CHOOSE YOUR BURN TIER: SELECT HOW MANY MINI APE CHAIN NFTS YOU WANT TO BURN—5, 15, OR 25.</li>
    <li>BURN YOUR MINIS: CLICK BURN TO SEND THE SELECTED NFTS TO THE BURN ADDRESS.</li>
    <li>CLAIM YOUR REWARD: CLICK CLAIM TOKEN TO RECEIVE YOUR NEW CURTIS HIDEAWAY NFT.</li>
  </ol>
</div>

              </div>
            )}
          </div>
          {/* Image section */}
          <div className="text-center">
            <img 
              src="./burn.png" 
              alt="Curtis Hideaway" 
              className="rounded-lg inline-block w-48 md:w-64"
            />
          </div>
        </div>
      </div>
    </div>

    {/* Footer Note */}
    <div className="bg-[#66CDAA] pb-16">
      <div className="container mx-auto px-4 text-center">
      <p
  className="font-pixel text-white text-sm mb-8"
  style={{ fontFamily: 'Roboto Condensed, sans-serif', fontWeight: 'bold' }}
>
  * FOR THOSE BURNING 15 OR 25 MINIS, I'LL PERSONALLY SEND THE BASED MINIS NFT TO YOUR WALLET AFTER THE BURN EVENT. IT'S THAT SIMPLE! LET'S GO.
</p>

      </div>
    </div>
  </div>
);
}
export default ConnectWalletButton;