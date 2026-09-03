import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "./AppProviders";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import Header from "./components/Header";
import { Box, CssBaseline, Link, Toolbar } from "@mui/material";
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
            <CssBaseline />
            <Box
              sx={{
                minHeight: "100dvh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Header />
              <Toolbar aria-hidden="true" />
              <Box
                component="main"
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  pt: 3,
                }}
              >
                {children}
              </Box>
              <Box component="footer" sx={{ py: 2, textAlign: "center" }}>
                <Link
                  href="https://commons.wikimedia.org/wiki/Commons:ImageAnnotateTool"
                  target="_blank"
                  rel="noreferrer"
                  color="primary"
                >
                  Documentation
                </Link>
              </Box>
            </Box>
          </NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  );
}
