// components/metamask.js
import { useEffect, useState } from "react";
import { ethers } from "ethers";

// Create a custom hook to manage MetaMask connection
export const useMetaMask = () => {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    // Set up provider and signer when MetaMask is available
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
    }
  }, []);

  const connect = async () => {
    if (!window.ethereum) {
      console.error("MetaMask not installed!");
      return;
    }

    try {
      // Request account access from MetaMask
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0];
      setAccount(account);

      // Get signer for transactions
      const signer = await provider.getSigner();
      setSigner(signer);

      setConnected(true);
    } catch (error) {
      console.error("Error connecting to MetaMask", error);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setSigner(null);
    setConnected(false);
  };

  return { account, signer, connected, connect, disconnect };
};
