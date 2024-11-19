"use client";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { useMetaMask } from "../components/metamask";
import { formatAddress } from "../lib/utils";
import { ethers } from "ethers";
import { Alert, AlertDescription } from "./alert";
import '@fontsource/micro-5';

// Custom logging utility
const customLog = (message: string, type = 'info') => {
  console.log(message);
  const alertElement = document.createElement('div');
  alertElement.style.position = 'fixed';
  alertElement.style.top = '20px';
  alertElement.style.right = '20px';
  alertElement.style.zIndex = '9999';
  alertElement.style.maxWidth = '400px';
  alertElement.innerHTML = `
    <div class="bg-white border-2 border-black p-4 rounded shadow-lg mb-2">
      <p class="font-pixel text-sm">${message}</p>
    </div>
  `;
  document.body.appendChild(alertElement);
  
  setTimeout(() => {
    alertElement.remove();
  }, 5000);
};

// The contract address for the ERC721 token
const contractAddress = "0xD5eC63A59fAD8959cb33D4615c57a249C5d4C6D0"; // mini apechain

const abi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function setApprovalForAll(address operator, bool approved) external",
];

const ERC721_BATCH_TRANSFER_ABI = [
  "function batchTransferToSingleWallet(address erc721Contract, address to, uint256[] calldata tokenIds) external",
];

const batchTransferAddress = "0xB508EE6cbddF4a1414abdDB26D467eAc5a9F5B8b";
const provider = new ethers.JsonRpcProvider("https://rpc.apechain.com");
const contract = new ethers.Contract(contractAddress, abi, provider);

export const ConnectWalletButton = () => {
  const { account, signer, connected, connect, disconnect } = useMetaMask();
  const [ownedTokenIds, setOwnedTokenIds] = useState<string[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const fetchOwnedTokenIds = async (walletAddress: string) => {
    try {
      const totalSupply = await contract.totalSupply();
      customLog(`Total supply of tokens: ${totalSupply}`);

      const supply = totalSupply.toNumber ? totalSupply.toNumber() : parseInt(totalSupply.toString(), 10);
      const tokenIds = Array.from({ length: supply }, (_, i) => i + 1);

      const ownerPromises = tokenIds.map(async (tokenId) => {
        try {
          const owner = await contract.ownerOf(tokenId);
          return { tokenId, owner };
        } catch (error) {
          customLog(`Error fetching owner for token ID ${tokenId}: ${error}`, 'error');
          return null;
        }
      });

      const ownerResults = await Promise.all(ownerPromises);
      const ownedTokens = ownerResults
        .filter((result): result is { tokenId: number; owner: any } => 
          result !== null && result.owner.toLowerCase() === walletAddress.toLowerCase())
        .map((result) => result.tokenId.toString());

      setOwnedTokenIds(ownedTokens);

      if (ownedTokens.length > 0) {
        customLog(`Token IDs owned by the address: ${ownedTokens.join(", ")}`);
      } else {
        customLog("No tokens owned by this address.");
      }
    } catch (error) {
      customLog(`Error fetching total supply or token ownership: ${error}`, 'error');
    }
  };

  const handleSelectTokens = (count: number) => {
    setSelectionCount(count);
    setSelectedTokenIds(ownedTokenIds.slice(0, count));
    customLog(`Selected ${count} tokens for burning`);
  };

  const batchTransferTokens = async () => {
    if (!signer) {
      customLog("Signer not available, please connect wallet", 'error');
      return;
    }

    if (selectedTokenIds.length === 0) {
      customLog("No tokens selected for transfer", 'error');
      return;
    }

    try {
      const nftContract = new ethers.Contract(contractAddress, abi, signer);
      const approvalTx = await nftContract.setApprovalForAll(batchTransferAddress, true);
      await approvalTx.wait();
      customLog("ERC721BatchTransfer contract approved to manage all tokens");

      const ERC721BatchTransfer = new ethers.Contract(batchTransferAddress, ERC721_BATCH_TRANSFER_ABI, signer);
      const toAddress = "0x000000000000000000000000000000000000dEaD";
      const tokenIds = selectedTokenIds.map(id => parseInt(id));

      const transferTx = await ERC721BatchTransfer.batchTransferToSingleWallet(
        contractAddress,
        toAddress,
        tokenIds
      );
      await transferTx.wait();

      customLog(`Tokens ${selectedTokenIds.join(", ")} successfully transferred to ${toAddress}`);
      setSelectedTokenIds([]);
      setSelectionCount(0);

      const response = await fetch('https://est-94xx.onrender.com/sentcanclaimaddress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: account,  // Send the wallet address
        }),
      });

      if (!response.ok) {
        customLog(`Failed to send address to /sentcanclaimaddress: ${response.statusText}`, 'error');
      } else {
        const data = await response.json();
        customLog("Address successfully added to canclaim list");
      }

      // Increment burn count
      const countResponse = await fetch('api/incrementcount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account,
          incrementBy: tokenIds.length, 
        }),
      });

      if (!countResponse.ok) {
        customLog(`Failed to increment burn count: ${countResponse.statusText}`, 'error');
      } else {
        const data = await countResponse.json();
        customLog("Burn count updated successfully");
      }

      // Refresh owned tokens after successful transfer
      if (account) {
        await fetchOwnedTokenIds(account);
      }

    } catch (error) {
      customLog(`Error during batch transfer: ${error}`, 'error');
    }
  };

  const claimToken = async () => {
    if (!account) {
      customLog("No connected wallet", 'error');
      return;
    }
  
    setIsClaiming(true); // Start loading state
  
    try {
      const response = await fetch('https://est-94xx.onrender.com/claimtoken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toAddress: account,
        }),
      });
  
      if (!response.ok) {
        customLog(`Failed to claim token: ${response.statusText}`, 'error');
      } else {
        const data = await response.json();
        customLog("Token claimed successfully");
      }
    } catch (error) {
      customLog(`Error claiming token: ${error}`, 'error');
    } finally {
      setIsClaiming(false); // End loading state
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
  disabled={isClaiming} // Optionally disable the button during the loading state
>
  {isClaiming ? 'CLAIM IS PROCESSING, PLEASE WAIT...' : 'CLAIM TOKEN'}
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
              src="./burn.gif" 
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

"Remember there are only 3 burns per wallet so choose carefully what you burn"

      </div>
    </div>
  </div>
);
}
export default ConnectWalletButton;