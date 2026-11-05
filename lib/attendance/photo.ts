const MAX_FILE_BYTES=8*1024*1024;
export const MAX_PHOTO_LENGTH=90_000;
export async function prepareProfilePhoto(file:File):Promise<string> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP photo. For HEIC, export it as JPG first.');
  if(file.size>MAX_FILE_BYTES)throw new Error('Choose a photo smaller than 8 MB.');
  let bitmap:ImageBitmap;
  try {bitmap=await createImageBitmap(file);} catch {throw new Error('This image could not be opened. Try a different JPG or PNG.');}
  try {
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>64_000_000)throw new Error('Choose a smaller image (up to 64 megapixels).');
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo editing is unavailable in this browser.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);
    const side=Math.min(bitmap.width,bitmap.height);
    ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
    // Re-encoding strips EXIF/GPS metadata and keeps team downloads small.
    const result=canvas.toDataURL('image/jpeg',.82);
    if(!result.startsWith('data:image/jpeg;base64,')||result.length>MAX_PHOTO_LENGTH)throw new Error('This image is too detailed. Try a smaller photo.');
    return result;
  } finally {bitmap.close();}
}
