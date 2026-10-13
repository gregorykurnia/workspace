// Data layer: Cloudinary uploads. No DOM.
async function uploadCL(file,onProg){
  return new Promise((res,rej)=>{
    var fd=new FormData();fd.append('file',file);fd.append('upload_preset',CL_PRESET);
    var rt;
    if(/^image\//i.test(file.type)||/\.(png|jpg|jpeg|gif|webp|bmp|svg|tiff|ico)$/i.test(file.name)){rt='image';}
    else if(/^video\//i.test(file.type)||/\.(mp4|mov|avi|mkv|webm)$/i.test(file.name)){rt='video';}
    else{rt='raw';}
    var xhr=new XMLHttpRequest();
    xhr.open('POST','https://api.cloudinary.com/v1_1/'+CL_CLOUD+'/'+rt+'/upload');
    xhr.upload.onprogress=e=>{if(e.lengthComputable&&onProg)onProg(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{
      if(xhr.status===200){var r=JSON.parse(xhr.responseText);res({url:r.secure_url,name:file.name,cloudType:r.resource_type,format:r.format||file.name.split('.').pop().toLowerCase()});}
      else{
        var msg='Upload failed ('+xhr.status+')';
        try{var er=JSON.parse(xhr.responseText);msg=er.error&&er.error.message?er.error.message:msg;}catch(e){}
        if(xhr.status===400&&msg.toLowerCase().includes('format')){msg='This file format is not allowed in your Cloudinary preset. Go to Cloudinary → Settings → Upload → upload preset → Allowed formats, and add the format.';}
        else if(xhr.status===401){msg='Cloudinary auth error. Check your upload preset is set to Unsigned.';}
        rej(new Error(msg));
      }
    };
    xhr.onerror=()=>rej(new Error('Network error'));xhr.send(fd);
  });
}
