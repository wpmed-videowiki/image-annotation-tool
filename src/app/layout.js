import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "./AppProviders";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import Header from "./components/Header";
import { Box, CssBaseline } from "@mui/material";
import { getCurrentUserSummary } from "./lib/session";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VideoWiki: Image Annotation Tool",
  description:
    "A tool to annotate images from Wikimedia Commons and NC Commons",
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const user = await getCurrentUserSummary();
  return (
    <html lang={locale}>
      <body className={inter.className}>
        <AppProviders user={user}>
          <NextIntlClientProvider messages={messages}>
            <main>
              <Header />
              <CssBaseline />
              <Box sx={{ marginTop: 11 }}>{children}</Box>
            </main>
          </NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  );
}
