import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk';

const egressClient = new EgressClient(
  process.env.LIVEKIT_URL!.replace('wss://', 'https://'),
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

const buildS3Upload = (): S3Upload => {
  const upload = new S3Upload();
  upload.accessKey    = process.env.R2_ACCESS_KEY!;
  upload.secret       = process.env.R2_SECRET_KEY!;
  upload.bucket       = process.env.R2_BUCKET!;
  upload.endpoint     = process.env.R2_ENDPOINT!;
  upload.region       = 'auto';
  upload.forcePathStyle = true;
  return upload;
};

export const startRoomRecording = async (
  roomName: string,
  spaceId:  string
): Promise<string> => {
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: `spaces/${spaceId}/{time}.mp4`,
    output:   { case: 's3', value: buildS3Upload() },
  });

  const info = await egressClient.startRoomCompositeEgress(
    roomName,
    output,
    'speaker'
  );

  return info.egressId;
};

export const stopRecording = async (egressId: string): Promise<void> => {
  await egressClient.stopEgress(egressId);
};

export const getRecordingUrl = (filename: string): string => {
  return `${process.env.R2_PUBLIC_URL}/${filename}`;
};
