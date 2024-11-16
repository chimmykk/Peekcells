
declare global {
    interface Window {
        account?:any;
      ethereum?: any; // or use a more specific type if you prefer
    }
  }
  
  export {};