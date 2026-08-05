import { Geist } from "next/font/google";
import localFont from "next/font/local";
import "@rainbow-me/rainbowkit/styles.css";
import { Metadata } from "next";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import { TooltipProvider } from "~~/components/ui/tooltip";
import "~~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const epilogue = localFont({
  src: "./fonts/Epilogue-VariableFont_wght.ttf",
  weight: "100 900",
  style: "normal",
  variable: "--font-accent",
});

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;
const imageUrl = `${baseUrl}/thumbnail.jpg`;

const title = "Mint Up Passes";
const titleTemplate = "%s | Mint Up Passes";
const description =
  "Discover and manage onchain Event Passes for Mint Up events.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: titleTemplate,
  },
  description,
  openGraph: {
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
    images: [
      {
        url: imageUrl,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [imageUrl],
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
  },
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      suppressHydrationWarning
      className={`${geist.variable} ${epilogue.variable}`}
    >
      <body className="font-sans" suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider>
            <ScaffoldEthAppWithProviders>
              {children}
            </ScaffoldEthAppWithProviders>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
