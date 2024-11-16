"use client";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { useMetaMask } from "../components/metamask"; // Ensure proper export/import
import { formatAddress } from "../lib/utils";
import WalletIcon from "../public/icons/WalletIcon"; // Ensure proper export/import
import { ethers } from "ethers";

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
      const response = await fetch('https://est-94xx.onrender.com:4000/claimtoken', {
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
  const LoadingPixel = () => (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-purple-500 animate-pulse"></div>
        <div className="absolute inset-2 border-4 border-purple-400 animate-pulse delay-150"></div>
        <div className="absolute inset-4 border-4 border-purple-300 animate-pulse delay-300"></div>
        <div className="absolute inset-6 border-4 border-purple-200 animate-pulse delay-500"></div>
      </div>
      <p className="mt-4 font-pixel text-white animate-pulse">Loading NFTs...</p>
    </div>
  );
  return (

    <div className="min-h-screen w-full bg-[#000000]">
      <div 
        className="fixed inset-0 bg-[url('https://png.pngtree.com/background/20221112/original/pngtree-nobody-interface-of-pixel-game-platform-picture-image_1962988.jpg')] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
          imageRendering: 'pixelated'
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      </div>
      
      <div className="relative min-h-screen z-10">
        <div className="container mx-auto p-8">
          {/* Connect Wallet Section */}
          <div className="flex justify-end mb-8">
            {connected ? (
              <Popover>
                <PopoverTrigger>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white font-pixel border-2 border-white px-6 py-3">
                    {account ? formatAddress(account) : "No Account"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="bg-purple-900 border-2 border-white">
                  <button
                    onClick={disconnect}
                    className="w-full px-4 py-2 text-white font-pixel hover:bg-purple-700"
                  >
                    Disconnect
                  </button>
                </PopoverContent>
              </Popover>
            ) : (
              <Button 
                onClick={connect}
                className="bg-purple-600 hover:bg-purple-700 text-white font-pixel border-2 border-white px-6 py-3"
              >
                <WalletIcon className="mr-2 h-4 w-4" /> Connect Wallet
              </Button>
            )}
          </div>

          {/* Main Content */}
          <div className="bg-black bg-opacity-80 p-8 rounded-lg border-2 border-purple-500 shadow-lg shadow-purple-500/50">
            <h2 className="font-pixel text-3xl text-white mb-6 text-center px-4 py-2 bg-purple-600 rounded-lg">
              Mini Ape Chain Burn Event
            </h2>
            
            {connected && isLoading ? (
              <LoadingPixel />
            ) : (
              <>
            <p className="font-pixel text-white mb-6 leading-relaxed">
  Get ready for something special! The Mini Ape Chain Burn Event is your chance to exchange
  your Mini Ape Chain NFTs for exclusive rewards while celebrating the Minis&apos; arrival on Ape Chain.
</p>

                <div className="space-y-8">
                  <div className="bg-purple-900 bg-opacity-50 p-6 rounded-lg border border-purple-400">
                    <h3 className="font-pixel text-2xl text-white mb-4">How It Works</h3>
                    <ul className="space-y-4 text-white font-pixel">
                      <li className="flex items-center">
                        <span className="text-purple-400 mr-2">→</span>
                        Burn 5 Minis: Receive the exclusive Curtis Hideaway NFT
                      </li>
                      <li className="flex items-center">
                        <span className="text-purple-400 mr-2">→</span>
                        Burn 15 Minis: Get Curtis Hideaway + a Based Minis NFT
                      </li>
                      <li className="flex items-center">
                        <span className="text-purple-400 mr-2">→</span>
                        Burn 25 Minis: All previous rewards + raffle entry for custom Mini animation
                      </li>
                    </ul>
                  </div>

                  <div className="bg-purple-900 bg-opacity-50 p-6 rounded-lg border border-purple-400">
                    <h3 className="font-pixel text-2xl text-white mb-4">About Curtis Hideaway</h3>
                    <p className="text-white font-pixel leading-relaxed">
      Curtis Hideaway is a cozy, vibrant scene capturing the Minis&apos; good vibes on Ape Chain,
      featuring Curtis and friends in their post-Ape Fest chill zone.
    </p>
                  </div>

                  {connected && ownedTokenIds.length > 0 && (
                    <div className="bg-purple-900 bg-opacity-50 p-6 rounded-lg border border-purple-400">
                      <h3 className="font-pixel text-2xl text-white mb-4">Burn Tokens</h3>
                      <select
                        onChange={(e) => handleSelectTokens(parseInt(e.target.value))}
                        className="w-full p-2 bg-purple-800 text-white font-pixel border-2 border-purple-500 rounded-md mb-4"
                      >
                        <option value="0">Select number of tokens</option>
                        <option value="5">5 Tokens</option>
                        <option value="10">10 Tokens</option>
                        <option value="15">15 Tokens</option>
                        <option value="20">20 Tokens</option>
                      </select>

                      <div className="flex space-x-4">
                        <Button 
                          onClick={batchTransferTokens} 
                          disabled={selectionCount === 0}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-pixel border-2 border-white disabled:opacity-50 px-6 py-3"
                        >
                          Burn Selected
                        </Button>
                        <Button 
                          onClick={claimToken}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-pixel border-2 border-white px-6 py-3"
                        >
                          Claim Token
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletButton;