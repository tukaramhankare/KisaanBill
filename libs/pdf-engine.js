/* =============================================================
   KisaanBill PDF Engine v2  —  libs/pdf-engine.js
   Pure JS PDF 1.4 generator. No dependencies. Fully offline.
   Fixed: proper text BT/ET, correct stream byte-length,
          correct xref offsets, Latin-1 safe output.
   ============================================================= */
(function(root){
'use strict';

/* ── helpers ── */
function esc(s){
  return String(s||'')
    .replace(/\\/g,'\\\\')
    .replace(/\(/g,'\\(')
    .replace(/\)/g,'\\)');
}

function encLatin1(s){
  /* convert JS string to latin-1 byte array, drop non-latin chars */
  var out=[];
  for(var i=0;i<s.length;i++){
    var c=s.charCodeAt(i);
    out.push(c<256?c:63); /* 63='?' */
  }
  return out;
}

function bytesToStr(arr){
  var s='';
  for(var i=0;i<arr.length;i++) s+=String.fromCharCode(arr[i]);
  return s;
}

/* ── PDF page ── */
function Page(w,h){
  this.w=w; this.h=h;
  this.stream='';       /* raw PDF operators */
  this._fs=10;
  this._bold=false;
}

/* append operator */
Page.prototype.op=function(s){ this.stream+=s+'\n'; };

Page.prototype.setFont=function(bold,size){
  this._bold=bold; this._fs=size;
  this.op('/'+(bold?'F2':'F1')+' '+size+' Tf');
};

Page.prototype.setFill=function(r,g,b){
  this.op(r.toFixed(3)+' '+g.toFixed(3)+' '+b.toFixed(3)+' rg');
};

Page.prototype.setStroke=function(r,g,b){
  this.op(r.toFixed(3)+' '+g.toFixed(3)+' '+b.toFixed(3)+' RG');
};

Page.prototype.setLineWidth=function(w){
  this.op(w.toFixed(2)+' w');
};

/* filled rect — y=0 at top of page */
Page.prototype.fillRect=function(x,y,w,h){
  var py=this.h-y-h;
  this.op(x.toFixed(2)+' '+py.toFixed(2)+' '+
          w.toFixed(2)+' '+h.toFixed(2)+' re f');
};

/* stroked line */
Page.prototype.hLine=function(x1,x2,y){
  var py=this.h-y;
  this.op(x1.toFixed(2)+' '+py.toFixed(2)+' m '+
          x2.toFixed(2)+' '+py.toFixed(2)+' l S');
};

/*
  drawText — place a single-line string.
  align: 'left'|'right'|'center'
  charW is estimated at fontSize * 0.52 for Helvetica
*/
Page.prototype.drawText=function(txt,x,y,align){
  var s=String(txt||'');
  if(!s.length) return;
  var cw=this._fs*0.52;
  var tx=x;
  if(align==='right')  tx=x-s.length*cw;
  if(align==='center') tx=x-s.length*cw/2;
  var py=this.h-y;
  /* use Tm (text matrix) for absolute positioning each call */
  this.op('BT 1 0 0 1 '+tx.toFixed(2)+' '+py.toFixed(2)+' Tm ('+esc(s)+') Tj ET');
};

/* ────────────────────────────────────────────────
   PDF Document
──────────────────────────────────────────────── */
function PDFDoc(){
  this.pages=[];
  this.cur=null;
}

PDFDoc.prototype.addPage=function(w,h){
  var pg=new Page(w||595,h||842);
  this.pages.push(pg);
  this.cur=pg;
  return pg;
};

/* convenience wrappers that forward to current page */
PDFDoc.prototype.setFont=function(b,sz){ this.cur.setFont(b,sz); return this; };
PDFDoc.prototype.setFill=function(r,g,b){ this.cur.setFill(r,g,b); return this; };
PDFDoc.prototype.setStroke=function(r,g,b){ this.cur.setStroke(r,g,b); return this; };
PDFDoc.prototype.setLineWidth=function(w){ this.cur.setLineWidth(w); return this; };
PDFDoc.prototype.fillRect=function(x,y,w,h){ this.cur.fillRect(x,y,w,h); return this; };
PDFDoc.prototype.hLine=function(x1,x2,y){ this.cur.hLine(x1,x2,y); return this; };
PDFDoc.prototype.text=function(t,x,y,al){ this.cur.drawText(t,x,y,al); return this; };

/* ── assemble PDF ── */
PDFDoc.prototype.buildBytes=function(){
  var self=this;
  var out=[]; /* array of byte-arrays / strings, all latin-1 */

  function emit(s){
    /* s is already a latin-1 safe string */
    out.push(s);
  }

  /* measure byte length of a latin-1 string */
  function bl(s){ return s.length; }

  var fontRes=
    '<</Font<<\n'+
    '/F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>\n'+
    '/F2<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>\n'+
    '>>>>\n';

  /* obj id plan:
     1 = catalog
     2 = pages dict
     3..3+N-1 = content streams  (one per page)
     3+N..3+2N-1 = page dicts
  */
  var N=self.pages.length;
  var streamIds=[];
  var pageIds=[];
  for(var i=0;i<N;i++){ streamIds.push(3+i); pageIds.push(3+N+i); }

  var parts=[];      /* final string parts */
  var offsets=[];    /* byte offset for each object (1-indexed) */
  var pos=0;

  function writeStr(s){
    parts.push(s);
    pos+=s.length;
  }

  /* PDF header */
  writeStr('%PDF-1.4\n%\xC2\xA9\xC3\xB8\n');

  /* write catalog obj 1 */
  offsets[1]=pos;
  writeStr('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');

  /* write pages obj 2 (kids list will be patched after) */
  offsets[2]=pos;
  var kidsStr=pageIds.map(function(id){return id+' 0 R';}).join(' ');
  writeStr('2 0 obj\n<</Type/Pages/Kids['+kidsStr+']/Count '+N+'>>\nendobj\n');

  /* write content streams */
  for(var pi=0;pi<N;pi++){
    var pg=self.pages[pi];
    var stream=pg.stream;
    /* length in bytes (latin-1) */
    var slen=encLatin1(stream).length;
    offsets[streamIds[pi]]=pos;
    writeStr(streamIds[pi]+' 0 obj\n<</Length '+slen+'>>\nstream\n'+stream+'\nendstream\nendobj\n');
  }

  /* write page dicts */
  for(var pi2=0;pi2<N;pi2++){
    var pg2=self.pages[pi2];
    offsets[pageIds[pi2]]=pos;
    writeStr(pageIds[pi2]+' 0 obj\n'+
      '<</Type/Page/Parent 2 0 R\n'+
      '/MediaBox[0 0 '+pg2.w.toFixed(2)+' '+pg2.h.toFixed(2)+']\n'+
      '/Contents '+streamIds[pi2]+' 0 R\n'+
      '/Resources '+fontRes+
      '>>\nendobj\n');
  }

  /* xref */
  var xrefPos=pos;
  var totalObjs=3+2*N; /* 1 catalog + 1 pages + N streams + N page dicts */
  writeStr('xref\n0 '+(totalObjs+1)+'\n');
  writeStr('0000000000 65535 f \n');
  for(var oi=1;oi<=totalObjs;oi++){
    var off=offsets[oi]||0;
    writeStr(('0000000000'+off).slice(-10)+' 00000 n \n');
  }

  /* trailer */
  writeStr('trailer\n<</Size '+(totalObjs+1)+'/Root 1 0 R>>\nstartxref\n'+xrefPos+'\n%%EOF\n');

  return parts.join('');
};

PDFDoc.prototype.save=function(filename){
  var content=this.buildBytes();
  /* convert to Uint8Array preserving Latin-1 bytes */
  var bytes=new Uint8Array(content.length);
  for(var i=0;i<content.length;i++) bytes[i]=content.charCodeAt(i)&0xFF;
  var blob=new Blob([bytes],{type:'application/pdf'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download=filename||'invoice.pdf';
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); },400);
};

root.KBPdf=PDFDoc;

})(typeof window!=='undefined'?window:this);
