import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "./AppProviders";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

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
  return (
    <html lang={locale}>
      <head>
        <link
          rel="stylesheet"
          href="https://uicdn.toast.com/tui-image-editor/latest/tui-image-editor.css"
        />
      </head>
      <body className={inter.className}>
        <AppProviders>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  );
}
