import { NextResponse } from "next/server";

type LineProfileResponse = {
  displayName: string;
  userId: string;
  pictureUrl: string;
  statusMessage: string;
  language?: string;
};

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Missing LINE_CHANNEL_ACCESS_TOKEN" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(params.userId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `LINE API returned ${response.status}` },
        { status: response.status }
      );
    }

    const profile = (await response.json()) as LineProfileResponse;

    return NextResponse.json({
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage ?? ""
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
