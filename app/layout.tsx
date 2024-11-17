import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mini Apechain Burn",
  description: "Burn event for mini apechain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F4F4F5] min-h-screen w-full m-0 p-0 flex flex-col">
        <NavBar />
        <div className="flex-grow">{children}</div>
      </body>
    </html>
  );
}
