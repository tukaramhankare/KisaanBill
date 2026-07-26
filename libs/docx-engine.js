/* =============================================================
   KisaanBill DOCX Engine v2  —  libs/docx-engine.js
   Generates valid .docx (OOXML) in pure JavaScript.
   No external dependencies. 100% offline.
   ============================================================= */
(function(root){
'use strict';

/* ── CRC-32 (same as excel-engine, defined here independently) ── */
var CRC_TABLE=(function(){
  var t=new Int32Array(256);
  for(var n=0;n<256;n++){
    var c=n;
    for(var k=0;k<8;k++) c=((c&1)?0xEDB88320^(c>>>1):(c>>>1));
    t[n]=c;
  }
  return t;
})();
function crc32d(buf){
  var c=-1;
  for(var i=0;i<buf.length;i++) c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8);
  return (c^-1)>>>0;
}
function strB(s){
  if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(s);
  var e=unescape(encodeURIComponent(s));
  var b=new Uint8Array(e.length);
  for(var i=0;i<e.length;i++) b[i]=e.charCodeAt(i);
  return b;
}
function u16d(v){ return [(v)&0xFF,(v>>8)&0xFF]; }
function u32d(v){ return [(v)&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF]; }
function concatD(arrays){
  var total=0,pos=0,i;
  for(i=0;i<arrays.length;i++) total+=arrays[i].length;
  var out=new Uint8Array(total);
  for(i=0;i<arrays.length;i++){ out.set(arrays[i],pos); pos+=arrays[i].length; }
  return out;
}
function fromListD(list){
  return concatD(list.map(function(x){ return (x instanceof Uint8Array)?x:new Uint8Array(x); }));
}

function ZipBuilderD(){this.entries=[];}
ZipBuilderD.prototype.add=function(name,data){
  var nb=strB(name);
  var db=(data instanceof Uint8Array)?data:strB(data);
  this.entries.push({nb:nb,db:db,crc:crc32d(db),sz:db.length,offset:0});
  return this;
};
ZipBuilderD.prototype.build=function(){
  var parts=[],offset=0,entries=this.entries;
  entries.forEach(function(e){
    e.offset=offset;
    var lfh=fromListD([[0x50,0x4B,0x03,0x04],u16d(20),u16d(0),u16d(0),u16d(0),u16d(0),
      u32d(e.crc),u32d(e.sz),u32d(e.sz),u16d(e.nb.length),u16d(0)]);
    parts.push(lfh,e.nb,e.db);
    offset+=lfh.length+e.nb.length+e.db.length;
  });
  var cdStart=offset;
  entries.forEach(function(e){
    var cdr=fromListD([[0x50,0x4B,0x01,0x02],u16d(20),u16d(20),u16d(0),u16d(0),u16d(0),u16d(0),
      u32d(e.crc),u32d(e.sz),u32d(e.sz),u16d(e.nb.length),u16d(0),u16d(0),u16d(0),u16d(0),
      u32d(0),u32d(e.offset)]);
    parts.push(cdr,e.nb);
    offset+=cdr.length+e.nb.length;
  });
  var cdSize=offset-cdStart;
  var eocd=fromListD([[0x50,0x4B,0x05,0x06],u16d(0),u16d(0),
    u16d(entries.length),u16d(entries.length),u32d(cdSize),u32d(cdStart),u16d(0)]);
  parts.push(eocd);
  return concatD(parts);
};

/* ── XML helpers ── */
function xe(v){
  return String(v===null||v===undefined?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtCol(c){ return c?String(c).replace('#','').toUpperCase().padStart(6,'0'):'000000'; }

/* ════════════════════════════════════════════════
   DOCX Document
════════════════════════════════════════════════ */
function DocxDoc(){ this._body=[]; }

/* ─── Paragraph ─── */
DocxDoc.prototype.para=function(opts){
  opts=opts||{};
  /* runs: array of {text,bold,italic,size,color,under} or a plain string */
  var runs=[];
  if(typeof opts.text==='string' || typeof opts.text==='number'){
    runs=[{text:String(opts.text),bold:opts.bold,italic:opts.italic,
           size:opts.size,color:opts.color,under:opts.under}];
  } else if(Array.isArray(opts.text)){
    runs=opts.text.map(function(r){
      if(typeof r==='string') return {text:r};
      return r;
    });
  }

  var pPr='';
  if(opts.align && opts.align!=='left') pPr+='<w:jc w:val="'+opts.align+'"/>';
  var before=opts.spaceBefore||0, after=opts.spaceAfter||80;
  if(before||after) pPr+='<w:spacing w:before="'+before+'" w:after="'+after+'"/>';
  if(opts.indent) pPr+='<w:ind w:left="'+opts.indent+'"/>';

  var xml='<w:p>';
  if(pPr) xml+='<w:pPr>'+pPr+'</w:pPr>';

  runs.forEach(function(r){
    var rPr='';
    if(r.bold||opts.bold) rPr+='<w:b/><w:bCs/>';
    if(r.italic||opts.italic) rPr+='<w:i/><w:iCs/>';
    var sz=r.size||opts.size;
    if(sz) rPr+='<w:sz w:val="'+(sz*2)+'"/><w:szCs w:val="'+(sz*2)+'"/>';
    var col=r.color||opts.color;
    if(col) rPr+='<w:color w:val="'+fmtCol(col)+'"/>';
    if(r.under) rPr+='<w:u w:val="single"/>';

    var t=String(r.text===null||r.text===undefined?'':r.text);
    xml+='<w:r>';
    if(rPr) xml+='<w:rPr>'+rPr+'</w:rPr>';
    xml+='<w:t xml:space="preserve">'+xe(t)+'</w:t></w:r>';
  });

  xml+='</w:p>';
  this._body.push(xml);
  return this;
};

/* ─── Empty spacer ─── */
DocxDoc.prototype.space=function(pts){
  var twips=Math.round((pts||6)*20);
  this._body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="'+twips+'"/></w:pPr></w:p>');
  return this;
};

/* ─── Horizontal rule ─── */
DocxDoc.prototype.rule=function(){
  this._body.push(
    '<w:p><w:pPr>'+
    '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C8D4BC"/></w:pBdr>'+
    '<w:spacing w:before="60" w:after="60"/>'+
    '</w:pPr></w:p>');
  return this;
};

/* ─── Table ─── */
/*
  rows: array of arrays of cells.
  Each cell: {text, bold, color, bg, align, size, width (twips)}
  tableWidth: total table width in twips (default 9072)
*/
DocxDoc.prototype.table=function(rows, tableWidth){
  var tW=tableWidth||9072;
  var xml='<w:tbl>'+
    '<w:tblPr>'+
      '<w:tblW w:w="'+tW+'" w:type="dxa"/>'+
      '<w:tblBorders>'+
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="C8D4BC"/>'+
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="C8D4BC"/>'+
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="C8D4BC"/>'+
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="C8D4BC"/>'+
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="C8D4BC"/>'+
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="C8D4BC"/>'+
      '</w:tblBorders>'+
      '<w:tblCellMar>'+
        '<w:top w:w="60" w:type="dxa"/>'+
        '<w:left w:w="80" w:type="dxa"/>'+
        '<w:bottom w:w="60" w:type="dxa"/>'+
        '<w:right w:w="80" w:type="dxa"/>'+
      '</w:tblCellMar>'+
    '</w:tblPr>';

  rows.forEach(function(row){
    xml+='<w:tr>';
    row.forEach(function(cell){
      /* normalise */
      if(typeof cell==='string'||typeof cell==='number') cell={text:String(cell)};
      cell=cell||{};
      var cW=cell.width||Math.floor(tW/Math.max(row.length,1));

      xml+='<w:tc>';
      xml+='<w:tcPr><w:tcW w:w="'+cW+'" w:type="dxa"/>';
      if(cell.bg) xml+='<w:shd w:val="clear" w:color="auto" w:fill="'+fmtCol(cell.bg)+'"/>';
      xml+='</w:tcPr>';

      var rPr='';
      if(cell.bold) rPr+='<w:b/><w:bCs/>';
      var sz=cell.size;
      if(sz) rPr+='<w:sz w:val="'+(sz*2)+'"/><w:szCs w:val="'+(sz*2)+'"/>';
      if(cell.color) rPr+='<w:color w:val="'+fmtCol(cell.color)+'"/>';

      var pPr='';
      if(cell.align && cell.align!=='left') pPr='<w:pPr><w:jc w:val="'+cell.align+'"/></w:pPr>';

      var t=String(cell.text===null||cell.text===undefined?'':cell.text);
      xml+='<w:p>'+pPr+
        '<w:r>'+(rPr?'<w:rPr>'+rPr+'</w:rPr>':'')+
        '<w:t xml:space="preserve">'+xe(t)+'</w:t>'+
        '</w:r></w:p>';
      xml+='</w:tc>';
    });
    xml+='</w:tr>';
  });

  xml+='</w:tbl><w:p/>'; /* empty para required after table */
  this._body.push(xml);
  return this;
};

/* ─── Build & Save ─── */
DocxDoc.prototype.save=function(filename){
  var self=this;
  var zip=new ZipBuilderD();

  /* namespace shortcuts */
  var W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var PKG='http://schemas.openxmlformats.org/package/2006';
  var OD='http://schemas.openxmlformats.org/officeDocument/2006';

  zip.add('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<Types xmlns="'+PKG+'/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+
    '</Types>');

  zip.add('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<Relationships xmlns="'+PKG+'/relationships">'+
    '<Relationship Id="rId1" Type="'+OD+'/relationships/officeDocument" Target="word/document.xml"/>'+
    '</Relationships>');

  zip.add('word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<Relationships xmlns="'+PKG+'/relationships">'+
    '<Relationship Id="rId1" Type="'+OD+'/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>');

  zip.add('word/styles.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<w:styles xmlns:w="'+W+'">'+
    '<w:docDefaults><w:rPrDefault><w:rPr>'+
      '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'+
      '<w:sz w:val="20"/><w:szCs w:val="20"/>'+
    '</w:rPr></w:rPrDefault></w:docDefaults>'+
    '</w:styles>');

  var docBody=self._body.join('\n');
  var docXml=
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<w:document xmlns:w="'+W+'">'+
    '<w:body>'+
    '<w:sectPr>'+
      '<w:pgSz w:w="11906" w:h="16838"/>'+  /* A4 */
      '<w:pgMar w:top="960" w:right="960" w:bottom="960" w:left="960"/>'+
    '</w:sectPr>'+
    docBody+
    '</w:body></w:document>';

  zip.add('word/document.xml',docXml);

  var bytes=zip.build();
  var blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=filename||'document.docx';
  a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); },400);
};

root.KBDocx=DocxDoc;

})(typeof window!=='undefined'?window:this);
