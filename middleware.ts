// T009: Middleware for write-protection (POST routes require auth)
import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Allow all GET requests (read-only mode for unauthenticated)
  if (method === "GET") {
    return NextResponse.next();
  }

  // Allow auth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Block POST/PUT/DELETE on /api/* if not authenticated
  if (pathname.startsWith("/api/") && !req.auth) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/api/:path*"],
};
