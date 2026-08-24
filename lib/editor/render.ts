import { Adjustments } from './types';

const vertexShader = `#version 300 es
in vec2 a_position; in vec2 a_texCoord; out vec2 v_texCoord;
void main(){ gl_Position=vec4(a_position,0.,1.); v_texCoord=a_texCoord; }`;

const fragmentShader = `#version 300 es
precision highp float; uniform sampler2D u_image; uniform vec2 u_resolution;
uniform float u_exposure,u_contrast,u_highlights,u_shadows,u_whites,u_blacks,u_temperature,u_tint,u_vibrance,u_saturation,u_clarity,u_vignette;
in vec2 v_texCoord; out vec4 outColor;
void main(){
  vec4 src=texture(u_image,v_texCoord); vec3 c=src.rgb*pow(2.,u_exposure);
  float light=(max(max(c.r,c.g),c.b)+min(min(c.r,c.g),c.b))*.5;
  float sm=pow(1.-clamp(light,0.,1.),2.); float hm=pow(clamp(light,0.,1.),2.);
  float tone=u_shadows*sm*.28+u_highlights*hm*.22+u_whites*hm*.13+u_blacks*sm*.11;
  c+=tone; c+=vec3(u_temperature+u_tint,-u_tint*.5,-u_temperature+u_tint);
  float cf=(1.015686*(u_contrast+1.))/(1.015686-u_contrast); c=cf*(c-.5)+.5;
  float mid=1.-abs(light-.5)*2.; c=(c-.5)*(1.+u_clarity*mid*.45)+.5;
  float gray=dot(c,vec3(.299,.587,.114)); float mx=max(max(c.r,c.g),c.b); float avg=(c.r+c.g+c.b)/3.;
  float vib=1.+u_vibrance*(1.-abs(mx-avg)); c=vec3(gray)+(c-vec3(gray))*((1.+u_saturation)*vib);
  vec2 centered=v_texCoord-.5; float edge=smoothstep(.24,.72,length(centered)); c*=1.-edge*u_vignette*.75;
  outColor=vec4(clamp(c,0.,1.),src.a);
}`;

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const value = gl.createShader(type); if (!value) throw new Error('Không thể tạo WebGL shader.');
  gl.shaderSource(value, source); gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) || 'WebGL shader lỗi.');
  return value;
}

function renderWebGL(canvas: HTMLCanvasElement, image: HTMLImageElement, width: number, height: number, a: Adjustments) {
  canvas.width = width; canvas.height = height;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true }); if (!gl) return false;
  const program = gl.createProgram(); if (!program) return false;
  gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertexShader)); gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragmentShader)); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Không thể khởi tạo WebGL.');
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program,'a_position'), tex = gl.getAttribLocation(program,'a_texCoord');
  gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0); gl.enableVertexAttribArray(tex); gl.vertexAttribPointer(tex,2,gl.FLOAT,false,16,8);
  const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  const uniforms: Record<string,number>={ u_exposure:a.exposure,u_contrast:a.contrast/100,u_highlights:a.highlights/100,u_shadows:a.shadows/100,u_whites:a.whites/100,u_blacks:a.blacks/100,u_temperature:a.temperature/500,u_tint:a.tint/500,u_vibrance:a.vibrance/100,u_saturation:a.saturation/100,u_clarity:a.clarity/100,u_vignette:a.vignette/100 };
  for(const [name,value] of Object.entries(uniforms)) gl.uniform1f(gl.getUniformLocation(program,name),value);
  gl.viewport(0,0,width,height); gl.drawArrays(gl.TRIANGLES,0,6); return true;
}

function renderFallback(canvas: HTMLCanvasElement, image: HTMLImageElement, width: number, height: number, a: Adjustments) {
  canvas.width=width; canvas.height=height; const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas không khả dụng.');
  const brightness=Math.pow(2,a.exposure)*100; ctx.filter=`brightness(${brightness}%) contrast(${100+a.contrast}%) saturate(${100+a.saturation+a.vibrance*.5}%)`; ctx.drawImage(image,0,0,width,height); ctx.filter='none';
}

export function renderImage(canvas: HTMLCanvasElement, image: HTMLImageElement, adjustments: Adjustments, maxDimension = 1800) {
  const scale=Math.min(1,maxDimension/Math.max(image.naturalWidth,image.naturalHeight)); const width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
  try { if(!renderWebGL(canvas,image,width,height,adjustments)) renderFallback(canvas,image,width,height,adjustments); } catch { renderFallback(canvas,image,width,height,adjustments); }
}

export async function exportRenderedImage(image: HTMLImageElement, adjustments: Adjustments, type: 'image/jpeg'|'image/png'|'image/webp'='image/jpeg', quality=.92) {
  const canvas=document.createElement('canvas'); renderImage(canvas,image,adjustments,Math.max(image.naturalWidth,image.naturalHeight));
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error('Không thể xuất ảnh.')),type,quality));
}
