export function fitImage(width:number,height:number,availableWidth:number,availableHeight:number){
  const scale=Math.min(1,Math.max(1,availableWidth)/Math.max(1,width),Math.max(1,availableHeight)/Math.max(1,height));
  return {scale,width:width*scale,height:height*scale};
}

export function zoomAt(view:{zoom:number;x:number;y:number},zoom:number,anchor={x:0,y:0}){
  const ratio=zoom/view.zoom;
  return {zoom,x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio};
}

// Bound the full-image buffer; very large images need a future tiled renderer.
export function previewSize(width:number,height:number,scale:number,dpr:number){
  const long=Math.max(width,height);
  const memoryLimit=Math.sqrt(24_000_000/(width*height))*long;
  return Math.max(1,Math.ceil(Math.min(long,8192,memoryLimit,long*scale*Math.max(1,dpr))));
}

export function isCameraRaw(name:string){
  return /\.(dng|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|rw2|pef|3fr|fff|iiq|rwl|raw)$/i.test(name);
}
