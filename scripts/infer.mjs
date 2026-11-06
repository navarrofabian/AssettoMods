const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function infer(f){
 const name=normalize(f.name).replace(/_/g,' '), folder=normalize(f.path).replace(/_/g,' '), t=folder+' '+name;
 let category='Sin clasificar',group='',subcategory='',scope='',country='',tags=[];
 const circuitWords=/\b(circuit|track|autodromo|obera|galvez|calafate|parana|posadas|santafe|rio.cuarto|buenos.aires|villicum|cabalen|rafaela|tandil|bolivar|baku|bathurst|cota|interlagos|melbourne|most|monaco|red.?bull.?ring|road.?america|singapore|marina.?bay|suzuka|zandvoort|spa2022|nordschleife|sonoma|tsukuba|southstar|alabama)\b/;
 const skin=/skinpack|skin.pack|extension/.test(name);
 if(skin)category='Skins';
 else if(circuitWords.test(t)||/\/circuitos|\/tracks/.test(folder))category='Circuitos';
 else if(/sol 2\./.test(name))category='Mejoras gráficas';
 else if(/\/(formulas|gts|argentinos|nascar|dtm|tcr|trans am|super.?autos|supercars|clasicos|tcc classic|rss mods|vrc mods|urd mods|asr mods|indy car|hypercars|dlcs\/cars)/.test(folder)||/formula|ferrari|porsche|lamborghini|camaro|mclaren|benetton|fw.clio|red.bull.rb1|kart|stock.car|radical|\bdtm\b|apvs.etc|pt pack/.test(name))category='Automóviles';
 if(category==='Circuitos'){
  const countries=[['AR',/nacionales|obera|galvez|calafate|parana|posadas|santafe|rio.cuarto|buenos.aires|villicum|cabalen|rafaela|tandil|bolivar/],['AZ',/baku/],['AU',/bathurst|melbourne/],['US',/cota|road.?america|southstar|alabama|sonoma/],['BR',/interlagos/],['MC',/monaco/],['CZ',/\bmost\b/],['AT',/red.?bull.?ring|redbullring/],['SG',/singapore|marina.?bay/],['BE',/\bspa\b|spa2022/],['JP',/suzuka|tsukuba/],['NL',/zandvoort/],['DE',/nordschleife/]];
  country=countries.find(([,re])=>re.test(t))?.[0]||'';scope=country?(country==='AR'?'Nacional':'Internacional'):'';
 }
 if(category==='Automóviles'){
  if(/formula|\bf[1234]\b|\bf1\d|\/indy car|rss2|rss_3|rss_4|vrc.*fa[_ -]/.test(t)){group='Fórmulas';subcategory=/rss2|\bf2\b/.test(t)?'F2':/formula.?3|\bf3\b|rss.?3/.test(t)?'F3':/\bf4\b|rss.?4/.test(t)?'F4':/indy|formula.na/.test(t)?'IndyCar':'F1';}
  else if(/gt3|gt4|gt2|gte|gt-m|gtm|gtn|\/gts|911.rsr/.test(t)){group='GTs';subcategory=/gt3|gt-m|gtm/.test(t)?'GT3':/gt4/.test(t)?'GT4':/gt2/.test(t)?'GT2':/gte|911.rsr/.test(t)?'GTE':'';}
  else if(/lmp|lmdh|hybrid.v8|499p|962c|919.hybrid|917.k|917.30|908.lh|mercedes.benz.clr|classic.endurance/.test(t)){group='Prototipos';}
  else if(/\/clasicos|\/tcc classic|classic|clasico|mustang.66|fusca.79/.test(t)){group='Clásicos';}
  else if(/nascar|stock.car|nextgen|hyperion|pickup|chevrolet.silverado|trans.am|ta2|touring|dtm|btcc|tcr|wtcr|supercars.australia|\btc.?20|turismo|stc2000|\btc del|\btc clasicos|tc bonaerense/.test(t)){group='Turismo';}
  else if(/super.autos|chiron|jesko|amg.one|911.r\b|turbo.s|carrera.s|spyder|boxster|cayman.s/.test(t)){group='Calle';}
  else group='Otros';
  if(/argentinos|tc202[46]|stc2000|tc bonaerense/.test(t))scope='Nacional';else if(/nascar|formula|dtm|btcc|gt3|gt4|indy|fia|lemans|lmdh/.test(t))scope='Internacional';
 }
 if(/nascar|stock.car|nextgen.camaro|hyperion|camping.world.truck/.test(t))tags.push('NASCAR');
 if(/\btc202[46]|turismo.carretera|tc.1982|\/tc 2005|tc del 40|tc clasicos|tc next gen/.test(t))tags.push('ACTC');
 if(/\bdtm\b/.test(t))tags.push('DTM');if(/\bbtcc\b/.test(t))tags.push('BTCC');if(/\btcr\b|wtcr/.test(t))tags.push('TCR');if(/indy.car|formula.na/.test(t))tags.push('IndyCar');
 return {category,group,subcategory,scope,country,tags,inferred:true};
}
export { infer };
