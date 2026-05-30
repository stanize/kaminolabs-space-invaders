"use client";

import dynamic from "next/dynamic";

const SpaceInvaders = dynamic(() => import("./components/SpaceInvaders"), {
  ssr: false,
  loading: () => (
    <div className="text-gray-500 font-mono text-sm">Loading...</div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050510] flex items-center justify-center">
      <SpaceInvaders />
    </main>
  );
}