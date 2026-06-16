import "./globals.css";

export const metadata = {
  title: "Street Cup",
  description: "A polished browser soccer game built with Next.js."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
