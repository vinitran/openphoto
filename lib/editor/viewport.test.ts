import { describe,it,expect } from 'vitest';
import { fitImage,previewSize,zoomAt,isCameraRaw } from './viewport';

describe('Image display and pixel zoom',()=>{
  it('fits portrait and panorama without cropping or changing aspect ratio',()=>{
    for(const [w,h] of [[4000,6000],[12000,2000],[100,100]]){
      const fit=fitImage(w,h,686,552);
      expect(fit.width).toBeLessThanOrEqual(686);
      expect(fit.height).toBeLessThanOrEqual(552);
      expect(fit.width/fit.height).toBeCloseTo(w/h);
      expect(fit.width*(1/fit.scale)).toBeCloseTo(w);
      expect(fit.height*(1/fit.scale)).toBeCloseTo(h);
    }
  });
  it('keeps the image point under the cursor invariant during zoom and reverses correctly',()=>{
    const before={zoom:.5,x:120,y:-30},anchor={x:50,y:80};
    const after=zoomAt(before,2,anchor);
    expect((anchor.x-after.x)/after.zoom).toBeCloseTo((anchor.x-before.x)/before.zoom);
    expect((anchor.y-after.y)/after.zoom).toBeCloseTo((anchor.y-before.y)/before.zoom);
    expect(zoomAt(after,.5,anchor)).toEqual(before);
  });
  it('uses source detail at 1:1 and accounts for Retina when fitting',()=>{
    expect(previewSize(4000,6000,1,2)).toBe(6000);
    expect(previewSize(4000,6000,.1,2)).toBe(1200);
    expect(previewSize(4000,6000,.5,2)).toBe(6000);
    expect(previewSize(4000,6000,8,2)).toBe(6000);
    expect(previewSize(12000,8000,1,2)).toBeLessThanOrEqual(8192);
  });
  it('recognizes RAW files without mistaking ordinary file names for camera RAW',()=>{
    expect(isCameraRaw('photo.CR3')).toBe(true);
    expect(isCameraRaw('photo.dng')).toBe(true);
    expect(isCameraRaw('draw')).toBe(false);
    expect(isCameraRaw('photo.jpg')).toBe(false);
  });
});
