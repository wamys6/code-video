// Original "借伞" example. Include character-motion.js and the two named WAV files at build time.
const film = {
  title: '借伞',
  filename: 'umbrella-dialogue.webm',
  width: 960,
  height: 540,
  fps: 30,
  frameCount: 224,
  bitrate: 3_500_000,
  audioClips: [
    { src: audioAssets.offer, at: 3.12, offset: .10, duration: 1.42, gain: .91 },
    { src: audioAssets.thanks, at: 5.00, offset: .10, duration: .81, gain: .94 },
  ],
};

const { poseAt, celAt, footAt, limb, limbToward, mouthAt } = characterMotion;
const W = film.width, H = film.height, GROUND = 436;
const TAU = 2 * Math.PI;
const ANKLE = GROUND - 6;
const upperLeg = 53, lowerLeg = 51;
const upperArm = 49, lowerArm = 45;
const clamp = t => Math.min(1, Math.max(0, t));
const blend = (a, b, t) => a + (b - a) * t;
const smooth = t => { const u = clamp(t); return u * u * (3 - 2 * u); };
const pointBetween = (a, b, t) => ({ x: blend(a.x, b.x, t), y: blend(a.y, b.y, t) });

// Measured against the same local WAVs as audioClips, in the source file's seconds.
function dialogueCues(clip, sourceCues) {
  return sourceCues.map(([start, end, shape]) => ({
    from: clip.at + start - clip.offset,
    to: clip.at + end - clip.offset,
    shape,
  }));
}

const offerMouth = dialogueCues(film.audioClips[0], [
  [.137,.19,'small'], [.19,.36,'open'], [.36,.447,'wide'],
  [1.020,1.10,'small'], [1.10,1.245,'wide'], [1.245,1.32,'small'], [1.32,1.462,'wide'],
]);
const thanksMouth = dialogueCues(film.audioClips[1], [
  [.137,.19,'small'], [.19,.31,'wide'], [.31,.40,'open'],
  [.40,.46,'small'], [.46,.59,'wide'], [.59,.68,'open'], [.68,.865,'wide'],
]);

const walkingX = [[0,504],[17,519],[34,543],[51,567],[68,591],[78,605]]
  .map(([frame,x]) => ({ frame, pose:{x}, easing:'linear' }));
const rightFootSwings = [[0,17,531,14],[34,51,578,16],[68,78,600,8]]
  .map(([from,to,x,height]) => ({ from,to,x,height }));
const leftFootSwings = [[17,34,554,15],[51,68,614,14]]
  .map(([from,to,x,height]) => ({ from,to,x,height }));
const turning = [
  {frame:0,value:'right'}, {frame:79,value:'right-three-quarter'},
  {frame:84,value:'front'}, {frame:88,value:'left-three-quarter'}, {frame:92,value:'left'},
];
const bodyTurn = [
  { frame:0, pose:{ yaw:1.25 } }, { frame:78, pose:{ yaw:1.25 } }, { frame:94, pose:{ yaw:-1.16 } },
];
// Straighten the carrying arm as it passes down through front view. Both elbow solutions
// nearly meet at full extension, so changing sides through the turn does not pop the joint.
const gripTurn = [[0,48,45],[78,48,45],[85,0,93.9],[87,0,93.9],[95,-34,48]]
  .map(([frame,x,y]) => ({frame,pose:{x,y}}));
const ownerKeys = [{frame:0,value:'offer'}, {frame:139,value:'thanks'}];
const shared = { x:507, y:292 };
const released = { x:448, y:323 };
const helper = {
  offer: { coat:'#698e88', light:'#9bc2ac', edge:'#405966', hair:'#283d55', hairLight:'#486680', skin:'#f3c9ae', cheek:'#dfac9b', trousers:'#385067', shoe:'#243344', button:'#e8d6a2' },
  thanks: { coat:'#cf9c6c', light:'#f2cfa3', edge:'#8a5c63', hair:'#633e49', hairLight:'#a26065', skin:'#f4cdb3', cheek:'#df9a97', trousers:'#59485c', shoe:'#3e344a', button:'#ffe0a9' },
};

function line(ctx, points, ink, weight) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.strokeStyle = ink;
  ctx.lineWidth = weight;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.stroke();
}

function circle(ctx,x,y,rx,ry,color) {
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,0,TAU);
  ctx.fill();
}

const paths = new Map();
function path(ctx, outline, color, stroke, weight = 1.5) {
  if (!paths.has(outline)) paths.set(outline, new Path2D(outline));
  const shape = paths.get(outline);
  if (color) { ctx.fillStyle = color; ctx.fill(shape); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = weight; ctx.lineJoin = 'round'; ctx.stroke(shape); }
}

function background(ctx, frame) {
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#263951');
  sky.addColorStop(1,'#607a8a');
  ctx.fillStyle=sky;
  ctx.fillRect(0,0,W,H);
  path(ctx,'M0 134 L185 97 L335 151 L335 392 L0 400 Z','#405570');
  path(ctx,'M495 132 L630 80 L741 145 L741 389 L495 393 Z','#475e73');
  path(ctx,'M729 97 L960 46 L960 400 L729 381 Z','#384f6a');
  for (let y=169; y<350; y+=32) {
    for (let x=29; x<950; x+=46) {
      if (x>335 && x<505) continue;
      const lit = (x * 11 + y) % 9 < 3;
      ctx.fillStyle = lit ? '#d7ad85' : '#2c4059';
      ctx.fillRect(x, y, 12, 9);
    }
  }
  for (let i=0; i<74; i++) {
    const x = (i * 127 + frame * .12) % (W + 80) - 30;
    const y = (i * 197 + frame * (4.5 + (i % 5))) % 420 - 25;
    line(ctx,[{x,y},{x:x+4,y:y+14}],'#b5d5e444',1.1);
  }
  const pavement = ctx.createLinearGradient(0,390,0,540);
  pavement.addColorStop(0,'#4d6379');
  pavement.addColorStop(1,'#27394e');
  ctx.fillStyle=pavement;
  ctx.fillRect(0,398,W,142);
  path(ctx,'M0 460 L960 427 L960 433 L0 467 Z','#a6bdbe20');
  path(ctx,'M0 474 L960 446 L960 447 L0 478 Z','#371d3540');
  circle(ctx,232,459,190,4,'#b6d4d322');
  circle(ctx,747,454,138,4,'#eccc9f28');
  path(ctx,'M0 0 L960 0 L960 82 L0 110 Z','#342b40');
  path(ctx,'M0 83 L960 52 L960 74 L0 112 Z','#72504f');
  path(ctx,'M0 99 L960 65 L960 70 L0 106 Z','#c99272');
  for (const x of [140,772]) {
    const halo=ctx.createRadialGradient(x,134,4,x,134,128);
    halo.addColorStop(0,'#ffd9a254');
    halo.addColorStop(1,'#ffd9a200');
    circle(ctx,x,134,128,128,halo);
    line(ctx,[{x,y:59},{x,y:116}],'#493748',4);
    ctx.save();
    ctx.translate(x,128);
    path(ctx,'M-30 8 Q-20 -16 0 -19 Q20 -16 30 8 Q0 22 -30 8 Z','#a97963','#d19c77');
    circle(ctx,0,8,26,4,'#ffdb9e');
    ctx.restore();
  }
}

function gazeDirection(cel) {
  return cel.startsWith('left') ? -1 : 1;
}

function drawHead(ctx, actor, frame, speaker) {
  const { style, hip, face } = actor;
  const front = face === 'front', quarter = face.endsWith('three-quarter');
  const direction = gazeDirection(face);
  const x = hip.x, y = hip.y - 112 + Math.sin(frame / 17 + actor.phase) * .9;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(direction,1);
  const isOffering = actor.name === 'offer';
  if (!isOffering) circle(ctx,-29,-25,19,19,style.hair);
  path(ctx,'M-39 21 Q-56 -2 -42 -29 Q-29 -52 2 -48 Q37 -50 46 -21 Q54 4 39 27 L23 38 L-30 38 Z',style.hair,style.edge,2);
  const faceShape = front || quarter
    ? 'M-35 -16 Q-25 -43 14 -37 Q40 -30 37 -4 L38 19 Q34 45 3 45 Q-26 44 -36 23 Q-41 3 -35 -16 Z'
    : 'M-34 -14 Q-19 -44 15 -37 Q41 -29 37 -7 L39 5 L49 14 Q51 18 44 20 L38 22 Q41 39 25 43 Q-3 49 -24 32 Q-45 17 -34 -14 Z';
  path(ctx,faceShape,style.skin,style.edge,1.8);
  path(ctx,'M-47 -10 Q-51 -32 -25 -45 Q4 -55 32 -39 Q48 -26 46 -7 Q35 -10 25 -24 Q22 -15 12 -10 L14 -25 Q0 -10 -19 -7 L-27 17 L-39 24 Q-43 9 -47 -10 Z',style.hair,style.edge,1.4);
  path(ctx,'M-38 -25 Q-6 -49 28 -33 Q5 -40 -12 -24 Q-31 -17 -35 -8 Z',style.hairLight);
  if (isOffering) line(ctx,[{x:-31,y:-10},{x:-21,y:-18}],'#e2c794',2);
  const eyes = front ? [-13,16] : quarter ? [1,23] : [19];
  const blink = Math.abs(frame - (isOffering ? 87 : 124)) < 2 || Math.abs(frame - (isOffering ? 197 : 205)) < 2;
  for (const at of eyes) {
    circle(ctx,at+4,19,8,4,style.cheek);
    if (blink) {
      ctx.save();
      ctx.translate(at,9);
      path(ctx,'M-6 0 Q0 5 6 0', null, style.edge, 1.8);
      ctx.restore();
      continue;
    }
    circle(ctx,at,9,7.6,7.8,'#fff2de');
    circle(ctx,at+(front ? .4 : 2),9,4.1,5.9,style.hair);
    circle(ctx,at+1.1,7,1.45,1.55,'#fff2de');
    ctx.save();
    ctx.translate(at,8);
    path(ctx,'M-7 0 Q-2 -7 7 -3',null,style.edge,1.7);
    ctx.restore();
  }
  const shape = mouthAt(speaker,frame,film.fps);
  const at = front ? 5 : quarter ? 15 : 32;
  if (shape === 'rest') {
    ctx.save();
    ctx.translate(at,29);
    path(ctx,'M-4 0 Q1 2 5 -1',null,'#9a5058',1.25);
    ctx.restore();
  } else {
    const size = { small:[2.9,2.0], wide:[7.0,2.2], open:[6,5.1], round:[4,4.8], closed:[4.5,.7] }[shape];
    circle(ctx, at, 29, size[0], size[1], '#7b4353');
    if (size[1] >= 4) circle(ctx, at, 31, size[0]*.55, 1.6, '#e89f9f');
  }
  ctx.restore();
}

function actorBody(ctx, actor, frame) {
  const { hip, style, face, legs } = actor;
  const direction = gazeDirection(face);
  const front = face === 'front';
  for (const leg of legs) {
    line(ctx,[leg.root,leg.joint,leg.end],'#344056',19);
    line(ctx,[leg.root,leg.joint,leg.end],style.trousers,15);
    circle(ctx,leg.end.x+Math.sin(actor.yaw)*6,leg.end.y+1.5,13,4.5,style.shoe);
  }
  ctx.save();
  ctx.translate(hip.x,hip.y);
  ctx.scale(direction,1);
  const shoulder = front ? 31 : face.endsWith('three-quarter') ? 28 : 24;
  const shape = 'M-' + shoulder + ' -53 Q-26 -69 -1 -76 Q23 -73 ' + shoulder +
    ' -55 L29 -4 Q-1 6 -30 -3 Z';
  path(ctx,shape,style.coat,style.edge,2.1);
  path(ctx,'M-15 -67 Q-3 -74 16 -62 L13 -54 L4 -57 L-4 -52 Z', style.light);
  path(ctx,'M12 -51 Q16 -30 14 -6', null, style.edge, 1.35);
  circle(ctx,15,-33,2.4,2.4,style.button);
  circle(ctx,15,-20,2.1,2.1,style.button);
  ctx.restore();
  drawHead(ctx,actor,frame,actor.name==='offer' ? offerMouth : thanksMouth);
}

function shoulder(actor, side) {
  return { x:actor.hip.x + side * 24 * Math.cos(actor.yaw), y:actor.hip.y - 60 };
}

function armPose(actor, side, target, bend, swing) {
  const root = shoulder(actor,side);
  if (target) return { side, root, ...limb(root,target,upperArm,lowerArm,bend) };
  const dx = side * 24 + swing;
  const hand = { x:root.x+dx, y:root.y+Math.sqrt(91 ** 2 - dx ** 2) };
  return { side, root, ...limbToward(root,hand,upperArm,lowerArm,{x:side,y:0}) };
}

function drawArm(ctx, style, arm, far) {
  ctx.save();
  ctx.globalAlpha = far ? .88 : 1;
  line(ctx,[arm.root,arm.joint,arm.end],style.edge,18);
  line(ctx,[arm.root,arm.joint,arm.end],style.coat,14.5);
  line(ctx,[arm.joint,pointBetween(arm.joint,arm.end,.8)],style.light,2.8);
  circle(ctx,arm.end.x,arm.end.y,6.8,7,style.edge);
  circle(ctx,arm.end.x,arm.end.y,5.6,5.8,style.skin);
  ctx.restore();
}

function legPoses(actor, feet) {
  const forward = Math.sin(actor.yaw);
  return feet.map((foot,i) => {
    const side = i ? 1 : -1;
    const root = { x:actor.hip.x + side * 9, y:actor.hip.y + 3 };
    const frontal = Math.abs(forward) < .2;
    // Profile knees flex to the toes. In a frontal projection, use a small outward bias.
    return { root, ...limbToward(root,foot,upperLeg,lowerLeg,
      {x:frontal ? side : Math.sign(forward),y:0}) };
  });
}

function drawActor(ctx, actor, frame) {
  const farSide = actor.yaw >= 0 ? 1 : -1;
  const far = actor.arms.find(arm => arm.side === farSide);
  const near = actor.arms.find(arm => arm.side !== farSide);
  drawArm(ctx,actor.style,far,true);
  actorBody(ctx,actor,frame);
  drawArm(ctx,actor.style,near,false);
}

function umbrella(ctx, at, rotation) {
  ctx.save();
  ctx.translate(at.x,at.y);
  ctx.rotate(rotation);
  path(ctx,'M-7 1 Q-11 20 -8 45 L-4 75 L0 91 L5 76 Q12 41 8 19 L7 2 Z',
    '#697eb1','#344763',2);
  path(ctx,'M-4 8 Q-1 36 0 79 M5 12 Q3 40 3 72',null,'#9da9cc',1.6);
  line(ctx,[{x:-8,y:35},{x:9,y:35}],'#e7c98a',4);
  path(ctx,'M0 0 L0 -18 Q0 -27 -7 -27 Q-12 -27 -13 -21',null,'#503e52',4.2);
  ctx.restore();
}

function scenePose(frame) {
  const x = poseAt(walkingX,frame).x;
  const gait = frame < 78 ? Math.sin(Math.PI*frame/17) * (1 - smooth((frame-68)/10)) : 0;
  const feet = [
    footAt(frame,{x:489,y:ANKLE},rightFootSwings),
    footAt(frame,{x:518,y:ANKLE},leftFootSwings),
  ];
  const reach = upperLeg + lowerLeg - .1;
  // Lower the pelvis only where the current stance needs the extra reach.
  const minimumHipY = feet.map((foot,i) => {
    const horizontal = foot.x - (x + (i ? 9 : -9));
    return foot.y - 3 - Math.sqrt(Math.max(0, reach ** 2 - horizontal ** 2));
  });
  const offer = {
    name:'offer', style:helper.offer,
    hip:{x,y:Math.max(323.5 - 2.2*gait**2, ...minimumHipY)}, phase:.2,
    face:celAt(turning,frame), yaw:poseAt(bodyTurn,frame).yaw,
  };
  const thanks = {
    name:'thanks', style:helper.thanks, hip:{x:403,y:323.5},
    phase:.9, face:'right-three-quarter', yaw:.72,
  };
  offer.legs = legPoses(offer,feet);
  thanks.legs = legPoses(thanks,[{x:390,y:ANKLE},{x:416,y:ANKLE}]);

  const grip = poseAt(gripTurn,frame);
  const root = shoulder(offer,-1);
  const readyGrip={x:root.x+grip.x,y:root.y+grip.y};
  const transfer = frame < 134 ? pointBetween(readyGrip,shared,smooth((frame-111)/23))
    : pointBetween(shared,released,smooth((frame-145)/34));
  const rotation = blend(-.22,.19,smooth((frame-135)/21));
  const handSlot = distance => ({
    x:transfer.x-Math.sin(rotation)*distance,
    y:transfer.y+Math.cos(rotation)*distance,
  });
  const offerIdle = armPose(offer,-1,null,0,0);
  const offerSlot = handSlot(-6*smooth((frame-100)/11));
  const offerHand = pointBetween(offerSlot,offerIdle.end,smooth((frame-140)/26));
  const thanksIdle = armPose(thanks,1,null,0,0);
  const thanksHand = pointBetween(thanksIdle.end,handSlot(5),smooth((frame-120)/14));
  const freeArmSwing = (7.5*gait - 66) * (1 - smooth((frame-72)/10));
  offer.arms = [
    armPose(offer,-1,offerHand,frame<86 ? 1 : -1,0),
    armPose(offer,1,null,0,freeArmSwing),
  ];
  thanks.arms = [armPose(thanks,-1,null,0,0), armPose(thanks,1,thanksHand,1,0)];
  return { offer, thanks, transfer, rotation, owner:celAt(ownerKeys,frame) };
}

function drawFrame(ctx, frame) {
  const { offer, thanks, transfer, rotation, owner } = scenePose(frame);
  background(ctx,frame);
  const zoom = 1 + .13*smooth((frame-86)/48);
  ctx.save();
  ctx.translate(495,301);
  ctx.scale(zoom,zoom);
  ctx.translate(-495,-301);
  circle(ctx,offer.hip.x,GROUND+7,43,7,'#1d293875');
  circle(ctx,thanks.hip.x,GROUND+7,37,6,'#1d293875');
  drawActor(ctx,offer,frame);
  drawActor(ctx,thanks,frame);
  umbrella(ctx,transfer,rotation);
  const holder = owner === 'offer' ? offer : thanks;
  const gripping = holder.arms[owner === 'offer' ? 0 : 1];
  circle(ctx,gripping.end.x,gripping.end.y,5.6,5.8,holder.style.skin);
  ctx.restore();

  const lineOfDialogue = (frame>=94 && frame<137) ? '伞，给你。' : (frame>=150 && frame<176) ? '谢谢你。' : '';
  if (lineOfDialogue) {
    ctx.font='500 23px "Microsoft YaHei", sans-serif';
    ctx.textBaseline='middle';
    ctx.textAlign='center';
    ctx.fillStyle='#1e293dba';
    ctx.fillRect(400,480,160,39);
    ctx.fillStyle='#fff2d6';
    ctx.fillText(lineOfDialogue,480,500);
  }
}
