import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export { cloudinary };

export const UPLOAD_PRESETS = {
  AVATAR:  'nexus_avatars',
  HEADER:  'nexus_headers',
  POST:    'nexus_posts',
  VIDEO:   'nexus_videos',
};
