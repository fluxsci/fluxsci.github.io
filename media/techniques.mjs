/** Original teaching slides. These are native Flux objects and tracks, not a
 * recreation of the player. The caller supplies the reviewed Flux ops module. */
export function createTechniques(ops) {
  const deck = ops.createDeck({id:'docs-techniques',title:'Flux · in practice',stage:{width:800,height:440},theme:'flux-light',withTitleSlide:false});
  const ink='#242a30', muted='#62686b', blue='#205ea6', teal='#24837b', violet='#7852aa';
  const text=(s,value,x,y,w,h,size=16,color=muted,family='Arial')=>ops.addSlideText(deck,s.id,{text:value,x,y,width:w,height:h,fontSize:size,color,fontFamily:family,sizing:'fixed'});
  const shape=(s,id,type,x,y,width,height,fill=blue,extra={})=>{ops.addElement(deck,s.id,{id,type,name:id,x,y,width,height,rotation:0,opacity:1,fill,stroke:fill,strokeWidth:0,...(type==='rect'?{cornerRadius:9}:{}),...extra});return id;};
  const scene=(id,name,sub)=>{const s=ops.addSlide(deck,{id,name,layout:'blank',background:'#fffefa'});text(s,'FLUX / ANIMATION STUDIES',32,24,730,20,11,blue);text(s,name,32,57,740,48,32,ink,'Georgia');text(s,sub,33,112,730,42,16);return s;};
  const step=s=>ops.addBeat(deck,s.id,{id:s.id+'-play',label:s.name,advance:'click'});
  const rule=(s,id,x,y,w)=>shape(s,id,'rect',x,y,w,1,'#deded6',{cornerRadius:0});
  {
    const s=scene('appear','Bring the next idea into view.','Three entrance effects. One shared start and duration.');
    const b=step(s);
    for(const [i,label,preset,color] of [[0,'Fade','fade',blue],[1,'Pop','popIn',teal],[2,'Wipe','writeOn',violet]]){
      const x=78+i*244;shape(s,`appear-guide-${i}`,'rect',x,199,152,117,'transparent',{stroke:'#deded6',strokeWidth:1});
      const id=shape(s,`appear-${i}`,'rect',x,199,152,117,color);text(s,label,x,340,170,27,18,ink);
      ops.setAnimation(deck,s.id,b.id,{id:`appear-track-${i}`,target:id,preset,duration:1500,start:0,easing:'smooth'});
    }
  }
  {
    const s=scene('change','Same object. A new state.','Change moves, resizes and recolours the selected object.');const b=step(s);
    shape(s,'change-origin','rect',82,223,105,105,'transparent',{stroke:'#bec6ce',strokeWidth:1,dash:[5,5]});
    shape(s,'change-destination','rect',494,212,208,125,'transparent',{stroke:'#bec6ce',strokeWidth:1,dash:[5,5]});
    rule(s,'change-path',212,276,252);text(s,'Design',83,355,180,26);text(s,'After step 1',494,355,210,26);
    const id=shape(s,'change-object','rect',82,223,105,105,blue);
    ops.setTransform(deck,s.id,b.id,id,{state:{x:494,y:212,width:208,height:125,fill:teal},duration:1900,easing:'smooth'});
  }
  {
    const s=scene('ghost','One source. Three destinations.','Ghost creates independent copies; the original stays in place.');const b=step(s);
    const id=shape(s,'ghost-source','ellipse',88,253,70,70,blue);
    text(s,'Original',61,351,140,25);text(s,'Independent copies',443,403,290,26);
    for(const [i,y]of [176,261,346].entries())shape(s,`ghost-guide-${i}`,'ellipse',555,y-10,54,54,'transparent',{stroke:'#bec6ce',strokeWidth:1,dash:[4,4]});
    ops.addGhostTransform(deck,s.id,b.id,id,{count:3,original:'stay',duration:1900,easing:'smooth',states:[{x:555,y:166,width:54,height:54,fill:teal},{x:555,y:251,width:54,height:54,fill:blue},{x:555,y:336,width:54,height:54,fill:violet}]});
  }
  {
    const s=scene('become','Let one shape become another.','A hand-off carries the source outline into its destination.');const b=step(s);
    const a=shape(s,'become-source','ellipse',93,221,126,126,blue);
    const z=shape(s,'become-target','rect',525,217,166,134,teal,{cornerRadius:5});
    shape(s,'become-outline','rect',525,217,166,134,'transparent',{stroke:'#bec6ce',strokeWidth:1,dash:[5,5],cornerRadius:5});
    text(s,'Source',112,368,160,28);text(s,'Destination',546,368,190,28);
    ops.becomeTransform(deck,s.id,b.id,a,z,{mode:'handoff',duration:2100,easing:'smooth'});
  }
  {
    const s=scene('easing','The same journey, six different timings.','All six travel the same distance in 2.4 seconds.');const b=step(s);
    const curves=[['Linear',{easing:'linear'}],['Smooth',{easing:'smooth'}],['Enter',{easing:'enter'}],['Overshoot',{curve:{kind:'bezier',p:[.34,1.56,.64,1]}}],['Bouncy',{curve:{kind:'spring',bounce:.35}}],['Steps',{curve:{kind:'steps',n:8}}]];
    curves.forEach(([label,timing],i)=>{const y=174+i*38;rule(s,`ease-guide-${i}`,184,y+12,470);text(s,label,33,y-1,143,29,15,ink);shape(s,`ease-end-${i}`,'ellipse',642,y,24,24,'transparent',{stroke:'#bcc6cb',strokeWidth:1});const id=shape(s,`ease-dot-${i}`,'ellipse',172,y,24,24,[blue,teal,violet,'#ad593c','#87620a','#526782'][i],{name:label});ops.setTransform(deck,s.id,b.id,id,{state:{x:642},duration:2400,...timing});});
  }
  {
    const s=scene('emphasis','Keep the context. Direct attention.','The next step highlights one result and dims its neighbours.');const b=step(s);
    for(let i=0;i<3;i++){const id=shape(s,`emphasis-${i}`,'rect',80+i*244,215,150,112,[blue,teal,violet][i]);text(s,['Context','Focus','Context'][i],80+i*244,351,190,28,18,ink);ops.setAnimation(deck,s.id,b.id,{id:`emphasis-track-${i}`,target:id,preset:i===1?'highlight':'dim',duration:1100,start:0});}
  }
  return deck;
}
