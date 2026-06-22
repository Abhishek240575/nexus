import { EgressClient, EncodedFileOutput, S3Upload } from 'livekit-server-sdk';

const egressClient = new EgressClient(
  process.env.LIVEKIT_URL!.replace('wss://', 'https://'),
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

const s3Upload = (): S3Upload => ({
  accessKey:  process.env.R2_ACCESS_KEY!,
  secret:     process.env.R2_SECRET_KEY!,
  bucket:     process.env.R2_BUCKET!,
  endpoint:   process.env.R2_ENDPOINT!,
  region:     'auto',
  forcePathStyle: true,
});

export const startRoomRecording = async (
  roomName: string,
  spaceId:  string
): Promise<string> => {
  const filepath = `spaces/${spaceId}/{time}.mp4`;

  const fileOutput = new EncodedFileOutput({
    filepath,
    output: { case: 's3', value: s3Upload() },
  });

  const info = await egressClient.startRoomCompositeEgress(roomName, {
    layout: 'speaker',
    encodedFile: fileOutput,
  });

  return info.egressId;
};

export const stopRecording = async (egressId: string): Promise<void> => {
  await egressClient.stopEgress(egressId);
};

export const getRecordingUrl = (filename: string): string => {
  return `${process.env.R2_PUBLIC_URL}/${filename}`;
};
