// T008: AuthButton component (SignIn/SignOut)
"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="bg-white/95 backdrop-blur-xl rounded-full px-4 py-2.5 shadow-lg shadow-black/5 text-sm text-gray-300">
        ...
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-xl rounded-full px-4 py-2 shadow-lg shadow-black/5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
          {(session.user?.name ?? "U")[0].toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-600 truncate max-w-[80px]">
          {session.user?.name ?? "User"}
        </span>
        <button
          onClick={() => signOut()}
          className="text-xs text-gray-400 hover:text-pink-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("microsoft-entra-id")}
      className="bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-500 hover:to-purple-500 rounded-full px-5 py-2.5 shadow-lg shadow-blue-200/50 text-sm font-semibold text-white transition-all whitespace-nowrap"
    >
      Sign in
    </button>
  );
}
