// Independent single-pixel controls: identical blocks, separate textures, each mip read separately.
export function compressionControls(gl) {
  const shader = (kind, source) => {
    const s = gl.createShader(kind); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}');
  const fs = shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;uniform highp sampler2D image;uniform float level;out vec4 colour;void main(){colour=textureLod(image,vec2(.5),level);}');
  const program = gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program); gl.uniform1i(gl.getUniformLocation(program,'image'),0);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const target = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,target);
  gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,1,1);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('control framebuffer incomplete');
  gl.viewport(0,0,1,1); gl.disable(gl.BLEND); gl.disable(gl.DITHER); gl.disable(gl.DEPTH_TEST);
  const astc = new Uint8Array([0xfc,0xfd,255,255,255,255,255,255,0xcc,0xcc,0x66,0x66,0x33,0x33,0x99,0x99]);
  const etc = new Uint8Array([0xcc,0x66,0x33,0,0,0,0,0]);
  const rgba = new Uint8Array([153,0x10,0x92,0x49,0x24,0x92,0x49,0x24,...etc]);
  const formats = [{name:'RGBA8',format:gl.RGBA8,block:null,expected:[204,102,51,153]}];
  if (gl.getExtension('WEBGL_compressed_texture_astc')) formats.push(
    {name:'ASTC-linear',format:0x93b0,block:astc,expected:[204,102,51,153]},
    {name:'ASTC-sRGB',format:0x93d0,block:astc,expected:[154,34,8,153]});
  if (gl.getExtension('WEBGL_compressed_texture_etc')) formats.push(
    {name:'ETC2-linear',format:0x9274,block:etc,expected:[206,104,53,255]},
    {name:'ETC2-sRGB',format:0x9275,block:etc,expected:[157,35,9,255]},
    {name:'EAC-linear',format:0x9278,block:rgba,expected:[206,104,53,155]},
    {name:'EAC-sRGB',format:0x9279,block:rgba,expected:[157,35,9,155]});
  const rows = [];
  try {
    for (const format of formats) for (const levels of [1,4]) {
      const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,levels === 1 ? gl.NEAREST : gl.NEAREST_MIPMAP_NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D,levels,format.format,8,8);
      for (let level=0;level<levels;level++) {
        const size=8>>level;
        if (format.block === null) {
          const data=new Uint8Array(size*size*4);
          for(let i=0;i<data.length;i+=4) data.set(format.expected,i);
          gl.texSubImage2D(gl.TEXTURE_2D,level,0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,data);
        } else {
          const blocks=Math.ceil(size/4)**2; const data=new Uint8Array(blocks*format.block.length);
          for(let i=0;i<blocks;i++) data.set(format.block,i*format.block.length);
          gl.compressedTexSubImage2D(gl.TEXTURE_2D,level,0,0,size,size,format.format,data);
        }
      }
      const uploadError=gl.getError(); const reads=[];
      for(let level=0;level<levels;level++) {
        gl.uniform1f(gl.getUniformLocation(program,'level'),level); gl.drawArrays(gl.TRIANGLES,0,3);
        const pixel=new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        reads.push({level,rgba:[...pixel],error:gl.getError()});
      }
      rows.push({format:format.name,levels,expected:format.expected,uploadError,reads});
      gl.deleteTexture(texture);
    }
  } finally {
    gl.deleteFramebuffer(fb); gl.deleteTexture(target); gl.deleteVertexArray(vao);
    gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
  }
  return rows;
}
