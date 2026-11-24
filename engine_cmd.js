function createCommodities(C){
  var META={
    GC:{name:'Or',unit:'USD/oz',dec:2,point:0.1},
    SI:{name:'Argent',unit:'USD/oz',dec:3,point:0.005},
    CL:{name:'Pétrole WTI',unit:'USD/baril',dec:2,point:0.01},
    BZ:{name:'Pétrole Brent',unit:'USD/baril',dec:2,point:0.01},
    HG:{name:'Cuivre',unit:'USD/lb',dec:4,point:0.0005},
    NG:{name:'Gaz naturel',unit:'USD/MMBtu',dec:3,point:0.001},
    ZW:{name:'Blé',unit:'USc/bushel',dec:2,point:0.25},
    ZC:{name:'Maïs',unit:'USc/bushel',dec:2,point:0.25}
  };
  function ema(arr,n){var k=2/(n+1),e=arr[0],out=[e];for(var i=1;i<arr.length;i++){e=arr[i]*k+e*(1-k);out.push(e);}return out;}
  function atr(rows,n){
    var trs=[];
    for(var i=1;i<rows.length;i++){
      var h=rows[i][2],l=rows[i][3],pc=rows[i-1][4];
      trs.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
    }
    var a=trs.slice(0,n).reduce(function(s,x){return s+x;},0)/n;
    for(var j=n;j<trs.length;j++) a=(a*(n-1)+trs[j])/n;
    return a;
  }
  function rsi(cl,n){
    var g=0,l=0;
    for(var i=1;i<=n;i++){var d=cl[i]-cl[i-1];if(d>0)g+=d;else l-=d;}
    g/=n;l/=n;
    for(var i=n+1;i<cl.length;i++){var d2=cl[i]-cl[i-1];g=(g*(n-1)+Math.max(d2,0))/n;l=(l*(n-1)+Math.max(-d2,0))/n;}
    if(l===0) return 100;
    return 100-100/(1+g/l);
  }
  var out=[];
  Object.keys(C).forEach(function(k){
    var meta=META[k]||{name:k,unit:'',dec:2,point:0.01};
    var rows=C[k].rows;
    if(!rows||rows.length<70) return;
    var cl=rows.map(function(r){return r[4];});
    var hi=rows.map(function(r){return r[2];});
    var lo=rows.map(function(r){return r[3];});
    var i=cl.length-1;
    var A=atr(rows,14);
    var e20=ema(cl,20),e50=ema(cl,50);
    var last=cl[i],live=C[k].live||last;
    var mom5=cl[i]/cl[i-5]-1,mom20=cl[i]/cl[i-20]-1,mom60=cl[i]/cl[i-60]-1;
    var slope20=(e20[i]-e20[i-20])/e20[i-20];
    var s=0.4*Math.tanh(mom20/0.06)+0.3*Math.tanh((last-e50[i])/(2*A))+0.3*Math.tanh(slope20/0.04);
    var agree=0;
    if(mom5>0)agree++; if(last>e20[i])agree++; if(last>e50[i])agree++;
    var direction=s>0.25?1:(s<-0.25?-1:0);
    if(direction<0) agree=3-agree;
    var conf=Math.round(30+42*Math.min(1,Math.abs(s)/1.2)+5*agree);
    if(direction===0) conf=Math.round(conf*0.6);
    var hi5=Math.max.apply(null,hi.slice(-5)),lo5=Math.min.apply(null,lo.slice(-5));
    var hi20=Math.max.apply(null,hi.slice(-20)),lo20=Math.min.apply(null,lo.slice(-20));
    var entry=null,stop=null,tps=[null,null,null],alt=null,note='';
    if(direction===0){
      note='Pas d\'avantage directionnel : attendre la cassure de '+hi20.toFixed(meta.dec)+' ou la perte de '+lo20.toFixed(meta.dec)+'.';
    } else if(direction>0){
      entry=live;
      stop=Math.min(lo5-0.3*A,entry-1.0*A);
      if(entry-stop>2.5*A) stop=entry-2.5*A;
      tps=[entry+(entry-stop),entry+2*(entry-stop),entry+3*(entry-stop)];
      alt=e20[i]>stop+0.5*A&&e20[i]<entry?e20[i]:null;
      note=entry-e20[i]>1.2*A
        ? 'Tendance haussière mais prix tendu : privilégier un repli vers '+e20[i].toFixed(meta.dec)+', stop sous '+lo5.toFixed(meta.dec)+'.'
        : 'Tendance haussière, entrée au marché avec stop sous le plus bas des 5 dernières séances.';
    } else {
      entry=live;
      stop=Math.max(hi5+0.3*A,entry+1.0*A);
      if(stop-entry>2.5*A) stop=entry+2.5*A;
      tps=[entry-(stop-entry),entry-2*(stop-entry),entry-3*(stop-entry)];
      alt=e20[i]<stop-0.5*A&&e20[i]>entry?e20[i]:null;
      note=e20[i]-entry>1.2*A
        ? 'Tendance baissière mais prix tendu : privilégier un rebond vers '+e20[i].toFixed(meta.dec)+', stop au-dessus de '+hi5.toFixed(meta.dec)+'.'
        : 'Tendance baissière, entrée au marché avec stop au-dessus du plus haut des 5 dernières séances.';
    }
    var risk=entry!==null?Math.abs(entry-stop):null;
    out.push({
      key:k,name:meta.name,unit:meta.unit,dec:meta.dec,point:meta.point,
      live:+live.toFixed(meta.dec),lastClose:+last.toFixed(meta.dec),
      chg1d:+((live/cl[i-1]-1)*100).toFixed(2),chg5d:+(mom5*100).toFixed(2),
      chg20d:+(mom20*100).toFixed(2),chg60d:+(mom60*100).toFixed(2),
      atr:+A.toFixed(meta.dec),atrPct:+(A/last*100).toFixed(2),
      ema20:+e20[i].toFixed(meta.dec),ema50:+e50[i].toFixed(meta.dec),
      rsi:Math.round(rsi(cl,14)),
      score:+s.toFixed(2),direction:direction,confidence:Math.max(12,Math.min(88,conf)),
      entry:entry!==null?+entry.toFixed(meta.dec):null,
      stop:stop!==null?+stop.toFixed(meta.dec):null,
      tp1:tps[0]!==null?+tps[0].toFixed(meta.dec):null,
      tp2:tps[1]!==null?+tps[1].toFixed(meta.dec):null,
      tp3:tps[2]!==null?+tps[2].toFixed(meta.dec):null,
      altEntry:alt!==null?+alt.toFixed(meta.dec):null,
      risk:risk!==null?+risk.toFixed(meta.dec):null,
      riskPct:risk!==null?+(risk/live*100).toFixed(2):null,
      note:note,hi20:+hi20.toFixed(meta.dec),lo20:+lo20.toFixed(meta.dec),
      spark:cl.slice(-60).map(function(v){return +v.toFixed(meta.dec);})
    });
  });
  return out;
}
