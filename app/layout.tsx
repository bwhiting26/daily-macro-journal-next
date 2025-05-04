import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextUIProvider } from "@nextui-org/react";
import { NotificationProvider } from "./context/NotificationContext";
import "./globals.css";

export const metadata = {
  title: "Daily Macro Journal",
  description: "Track your macros and achieve your fitness goals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>{children}</NotificationProvider>
      </body>
    </html>
  );
}