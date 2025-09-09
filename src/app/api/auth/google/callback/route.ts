
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthTokens } from "@/services/google-auth-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/clients?error=Authentication failed", request.url));
  }

  try {
    const tokens = await getGoogleAuthTokens(code);
    // In a real app, you'd save these tokens securely, likely associated with the user's session.
    // For this example, we'll just redirect back with a success message.
    // We are not storing tokens, so the user will need to re-authenticate each time.
    return NextResponse.redirect(new URL("/clients?import=true", request.url));
  } catch (error) {
    console.error("Error fetching Google tokens:", error);
    return NextResponse.redirect(new URL("/clients?error=Failed to retrieve tokens", request.url));
  }
}
