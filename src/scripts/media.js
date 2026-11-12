async function resize(img,width,quality){
  const ratio=Math.min(1,width/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/webp',quality);
  if(!data.startsWith('data:image/webp;base64,'))throw new Error('此浏览器无法生成网页图片，请换用新版浏览器。');
  return data.split(',')[1];
}
export async function prepareImage(file,withThumb){
  if(!file.type.startsWith('image/')||file.type==='image/svg+xml'||file.size>32*1024*1024)throw new Error('请选择小于 32 MB 的照片。');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    img.src=url;
    try{await img.decode()}catch{throw new Error('这张照片无法解码，请导出为 JPG 或 PNG 再试。')}
    const path='media/'+crypto.randomUUID(),src=path+'.webp',thumb=withThumb?path+'-sm.webp':src;
    const files=[{path:src,base64:await resize(img,1600,.8)}];
    if(withThumb)files.push({path:thumb,base64:await resize(img,480,.72)});
    return {src,thumb,files};
  }finally{URL.revokeObjectURL(url);}
}
