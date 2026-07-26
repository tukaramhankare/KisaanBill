/* =============================================================
   KisaanBill Excel Engine v2  —  libs/excel-engine.js
   Generates valid .xlsx (Office Open XML) in pure JavaScript.
   No external dependencies. 100% offline.
   Uses stored (uncompressed) ZIP format for reliability.
   ============================================================= */
(function(root){
'use strict';

/* ── CRC-32 ── */
var CRC_TABLE=(function(){
  var t=new Int32Array(256);
  for(var n=0;n<256;n++){
    var c=n;
    for(var k=0;k<8;k++) c=((c&1)?0xEDB88320^(c>>>1):(c>>>1));
    t[n]=c;
  }
  return t;
})();

function crc32(buf,off,len){
  var c=-1;
  for(var i=off;i<off+len;i++) c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8);
  return (c^-1)>>>0;
}

/* ── Encode UTF-8 string to Uint8Array ── */
function strBytes(s){
  if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(s);
  /* fallback for very old browsers */
  var s2=unescape(encodeURIComponent(s));
  var b=new Uint8Array(s2.length);
  for(var i=0;i<s2.length;i++) b[i]=s2.charCodeAt(i);
  return b;
}

/* ── Uint16 / Uint32 little-endian writers ── */
function u16(v){ return [(v)&0xFF,(v>>8)&0xFF]; }
function u32(v){ return [(v)&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF]; }

/* ── Concat Uint8Arrays ── */
function concat(arrays){
  var total=0;
  for(var i=0;i<arrays.length;i++) total+=arrays[i].length;
  var out=new Uint8Array(total);
  var pos=0;
  for(var j=0;j<arrays.length;j++){ out.set(arrays[j],pos); pos+=arrays[j].length; }
  return out;
}

function fromList(list){
  var arrs=list.map(function(x){
    return (x instanceof Uint8Array)?x:new Uint8Array(x);
  });
  return concat(arrs);
}

/* ── ZIP stored entry ── */
function ZipEntry(name, data){
  /* name as bytes */
  var nameBytes=strBytes(name);
  var dataBytes=(data instanceof Uint8Array)?data:strBytes(data);
  var crc=crc32(dataBytes,0,dataBytes.length);
  var sz=dataBytes.length;
  var dt=0x5440; /* date: 2024-01-01 */
  var tm=0x0000;

  /* local file header */
  var lfh=fromList([
    [0x50,0x4B,0x03,0x04], /* sig */
    u16(20),               /* version needed */
    u16(0),                /* flags */
    u16(0),                /* compression: stored */
    u16(tm),u16(dt),       /* mod time/date */
    u32(crc),
    u32(sz),u32(sz),       /* compressed = uncompressed */
    u16(nameBytes.length),
    u16(0)                 /* extra len */
  ]);

  this.nameBytes=nameBytes;
  this.dataBytes=dataBytes;
  this.crc=crc;
  this.sz=sz;
  this.dt=dt; this.tm=tm;
  this.localHeader=lfh;
  this.localSize=lfh.length+nameBytes.length+dataBytes.length;
  this.localOffset=0; /* filled when writing */
}

/* ── ZIP builder ── */
function ZipBuilder(){
  this.entries=[];
}

ZipBuilder.prototype.add=function(name,data){
  this.entries.push(new ZipEntry(name,data));
  return this;
};

ZipBuilder.prototype.build=function(){
  var entries=this.entries;
  var parts=[];
  var offset=0;

  /* local entries */
  entries.forEach(function(e){
    e.localOffset=offset;
    parts.push(e.localHeader);
    parts.push(e.nameBytes);
    parts.push(e.dataBytes);
    offset+=e.localHeader.length+e.nameBytes.length+e.dataBytes.length;
  });

  /* central directory */
  var cdStart=offset;
  entries.forEach(function(e){
    var cdr=fromList([
      [0x50,0x4B,0x01,0x02], /* sig */
      u16(20),u16(20),        /* version made/needed */
      u16(0),                 /* flags */
      u16(0),                 /* stored */
      u16(e.tm),u16(e.dt),
      u32(e.crc),
      u32(e.sz),u32(e.sz),
      u16(e.nameBytes.length),
      u16(0),u16(0),          /* extra, comment */
      u16(0),u16(0),          /* disk start, int attrs */
      u32(0),                 /* ext attrs */
      u32(e.localOffset)
    ]);
    parts.push(cdr);
    parts.push(e.nameBytes);
    offset+=cdr.length+e.nameBytes.length;
  });

  var cdEnd=offset;
  var cdSize=cdEnd-cdStart;

  /* end of central directory */
  var eocd=fromList([
    [0x50,0x4B,0x05,0x06],
    u16(0),u16(0),              /* disk numbers */
    u16(entries.length),u16(entries.length),
    u32(cdSize),
    u32(cdStart),
    u16(0)
  ]);
  parts.push(eocd);

  return concat(parts);
};

/* ── XML escape ── */
function xe(v){
  return String(v===null||v===undefined?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Column letter ── */
function col(n){
  var s='';
  while(n>0){ s=String.fromCharCode(64+(n%26||26))+s; n=Math.floor((n-1)/26); }
  return s;
}

/* ── XLSX workbook ── */
function XLSXBook(){
  this.sheets=[];
}

XLSXBook.prototype.addSheet=function(name,rows){
  this.sheets.push({name:String(name||'Sheet'),rows:rows||[]});
  return this;
};

XLSXBook.prototype.generate=function(){
  var self=this;
  var zip=new ZipBuilder();

  /* [Content_Types].xml */
  var ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  self.sheets.forEach(function(_,i){
    ct+='<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  });
  ct+='</Types>';
  zip.add('[Content_Types].xml',ct);

  /* _rels/.rels */
  zip.add('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
    '</Relationships>');

  /* xl/_rels/workbook.xml.rels */
  var wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  self.sheets.forEach(function(_,i){
    wbRels+='<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>';
  });
  wbRels+='<Relationship Id="rId'+(self.sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>';
  zip.add('xl/_rels/workbook.xml.rels',wbRels);

  /* xl/workbook.xml */
  var wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets>';
  self.sheets.forEach(function(s,i){
    wb+='<sheet name="'+xe(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>';
  });
  wb+='</sheets></workbook>';
  zip.add('xl/workbook.xml',wb);

  /* xl/styles.xml */
  zip.add('xl/styles.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="3">'+
      '<font><sz val="10"/><name val="Calibri"/></font>'+
      '<font><b/><sz val="10"/><name val="Calibri"/></font>'+
      '<font><b/><sz val="11"/><color rgb="FF1A3A1A"/><name val="Calibri"/></font>'+
    '</fonts>'+
    '<fills count="2"><fill><patternFill patternType="none"/></fill>'+
    '<fill><patternFill patternType="gray125"/></fill></fills>'+
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="4">'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+  /* 0 normal */
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>'+  /* 1 bold */
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>'+  /* 2 title */
      '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0"/>'+  /* 3 number */
    '</cellXfs>'+
    '</styleSheet>');

  /* worksheets */
  self.sheets.forEach(function(sheet,si){
    var ws='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<sheetData>';
    sheet.rows.forEach(function(row,ri){
      if(!row||!row.length){ ws+='<row r="'+(ri+1)+'"/>'; return; }
      ws+='<row r="'+(ri+1)+'">';
      row.forEach(function(val,ci){
        var addr=col(ci+1)+(ri+1);
        if(val===null||val===undefined||val===''){
          ws+='<c r="'+addr+'"/>'; return;
        }
        var isNum=(typeof val==='number'||
                  (typeof val==='string'&&val!==''&&!isNaN(Number(val))&&val.trim()!==''));
        var num=isNum?Number(val):null;
        var s=0; /* style */
        if(ri===0) s=2;
        else if(isNum) s=3;

        if(isNum){
          ws+='<c r="'+addr+'" s="'+s+'"><v>'+num+'</v></c>';
        } else {
          ws+='<c r="'+addr+'" t="inlineStr" s="'+s+'"><is><t>'+xe(String(val))+'</t></is></c>';
        }
      });
      ws+='</row>';
    });
    ws+='</sheetData></worksheet>';
    zip.add('xl/worksheets/sheet'+(si+1)+'.xml',ws);
  });

  return zip.build();
};

XLSXBook.prototype.save=function(filename){
  var bytes=this.generate();
  var blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=filename||'workbook.xlsx';
  a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); },400);
};

root.KBExcel=XLSXBook;

})(typeof window!=='undefined'?window:this);
