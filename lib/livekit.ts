import { AccessToken } from 'livekit-server-sdk';

export interface TokenRequest {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}

export interface TokenResponse {
  token: string;
  url: string;
}

export async function generateLiveKitToken(
  roomName: string,
  participantName: string,
  participantIdentity: string
): Promise<TokenResponse> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://mockly-9f912h29.livekit.cloud';

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API key and secret are required');
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: '1h', // Token expires in 1 hour
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return {
    token,
    url: wsUrl,
  };
}

export async function createRoomToken(roomName: string, userId: string): Promise<TokenResponse> {
  return generateLiveKitToken(
    roomName,
    `user-${userId}`,
    `user-${userId}`
  );
}
