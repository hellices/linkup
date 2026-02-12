// T008: AuthButton component (SignIn/SignOut)
"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow text-sm text-gray-400">
        ...
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow">
        <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
          {session.user?.name ?? "User"}
        </span>
        <button
          onClick={() => signOut()}
          className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("microsoft-entra-id")}
      className="bg-white/90 backdrop-blur rounded-lg px-4 py-2 shadow text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
    >
      Sign in with Microsoft
    </button>
  );
}
