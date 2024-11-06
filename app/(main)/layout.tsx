import Image from "next/image";
import bgImg from "@/public/halo.png";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <body className="bg-black">
      <div className="absolute inset-x-0 flex justify-center"></div>

      <div className="isolate">{children}</div>
    </body>
  );
}
