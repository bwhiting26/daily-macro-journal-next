import type { AppProps } from "next/app";
import { NotificationProvider } from "./context/NotificationContext";
import "../styles/globals.css"; // Adjust path if needed

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NotificationProvider>
      <Component {...pageProps} />
    </NotificationProvider>
  );
}