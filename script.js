/************ CONFIG ************/
const CELL   = 40;
const COLS   = 20;
const ROWS   = 10;
const PATH_Y = 5;                 // centre row
const KILLS_PER_WAVE = 10;        // <- new rule

/************ CANVAS ************/
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');

/************ STATE ************/
let bits   = 200;
let lives  = 20;
let wave   = 1;
let enemies= [];
let towers = [];
let bullets= [];
let events = [];
let backup = null;

let spawnTimer      = 0;
let spawnInterval   = 120;        // frames between spawns
let killsThisWave   = 0;          // <- new counter

/************ TOWER SPECS ************/
const TOWER_SPECS = {
  docs:  {cost:50, dmg:12, range:3*CELL, color:'#4fc3f7', name:'Documents'},
  media: {cost:70, dmg:18, range:4*CELL, color:'#ba68c8', name:'Media'},
  code:  {cost:90, dmg:25, range:5*CELL, color:'#ffb74d', name:'Code'}
};

/************ ENEMY ************/
class Enemy{
  constructor(){
    this.x    = -CELL;
    this.y    = (PATH_Y + 0.5) * CELL;
    this.hp   = 50 + wave * 15;          // scales each wave
    this.maxHp= this.hp;
    this.speed= 0.8 + wave * 0.12;
    this.value= 10 + wave * 3;
  }
  update(){
    this.x += this.speed;
    if(this.x > cvs.width){
      const dmg = events.some(e=>e.title==='No backup') ? 2 : 1;
      lives -= dmg;
      return false;
    }
    return true;
  }
  draw(){
    ctx.fillStyle = '#e57373';
    ctx.beginPath(); ctx.arc(this.x,this.y,10,0,Math.PI*2); ctx.fill();
    // hp bar
    ctx.fillStyle='#000'; ctx.fillRect(this.x-15,this.y-20,30,4);
    ctx.fillStyle='#4caf50'; ctx.fillRect(this.x-15,this.y-20,30*(this.hp/this.maxHp),4);
  }
}

/************ TOWER ************/
class Tower{
  constructor(x,y,type){
    Object.assign(this, TOWER_SPECS[type]);
    this.x=x; this.y=y; this.type=type;
    this.rof=1; this.accuracy=1; this.cool=0;
  }
  update(){
    this.cool = Math.max(0,this.cool-1);
    if(this.cool) return;
    let tgt=null,best=Infinity;
    enemies.forEach(e=>{
      const d = Math.hypot(e.x-this.x,e.y-this.y);
      if(d<=this.range&&d<best){best=d;tgt=e;}
    });
    if(!tgt)return;
    this.cool=30*this.rof;
    if(Math.random()>this.accuracy)return;
    bullets.push({x:this.x,y:this.y,tx:tgt.x,ty:tgt.y,dmg:this.dmg,target:tgt,hit:false});
  }
  draw(){
    ctx.fillStyle=this.color;
    ctx.fillRect(this.x-15,this.y-15,30,30);
    ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText(this.name[0],this.x,this.y+4);
  }
}

/************ BULLETS ************/
function updateBullets(){
  bullets=bullets.filter(b=>{
    const dx=b.tx-b.x,dy=b.ty-b.y,dist=Math.hypot(dx,dy);
    if(dist<4&&!b.hit){
      b.hit=true;
      b.target.hp-=b.dmg;
      if(b.target.hp<=0){
        bits+=b.target.value;
        killsThisWave++;
      }
      return false;
    }
    b.x+=dx/dist*6; b.y+=dy/dist*6; return true;
  });
}
function drawBullets(){
  ctx.fillStyle='#ffeb3b';
  bullets.forEach(b=>ctx.fillRect(b.x-2,b.y-2,4,4));
}

/************ PATH ************/
function drawPath(){
  ctx.fillStyle='#333';
  ctx.fillRect(0,PATH_Y*CELL,cvs.width,CELL);
}

/************ BUILD SYSTEM ************/
let selectedType=null;
document.querySelectorAll('.towerBtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.towerBtn').forEach(b=>b.style.background='');
    btn.style.background='#4caf50'; selectedType=btn.dataset.type;
  });
});
cvs.addEventListener('click',e=>{
  if(!selectedType)return;
  const rect=cvs.getBoundingClientRect();
  const x=e.clientX-rect.left,y=e.clientY-rect.top;
  const gx=Math.floor(x/CELL)*CELL+CELL/2,gy=Math.floor(y/CELL)*CELL+CELL/2;
  if(Math.abs(gy-(PATH_Y+0.5)*CELL)<CELL)return;
  if(towers.some(t=>Math.hypot(t.x-gx,t.y-gy)<20))return;
  if(bits<TOWER_SPECS[selectedType].cost)return;
  towers.push(new Tower(gx,gy,selectedType));
  bits-=TOWER_SPECS[selectedType].cost; updateHud();
});

/************ EVENT CARDS ************/
const EVENT_CARDS=[
  {title:'No naming convention',text:'Towers 30% slower.',affect:t=>t.rof*=1.3,fix:t=>t.rof/=1.3},
  {title:'No versioning',text:'Bullets may miss.',affect:t=>t.accuracy=.7,fix:t=>t.accuracy=1},
  {title:'No backup',text:'Leaks do double damage.',affect:null,fix:null}
];
function pushEvent(){
  if(events.length)return;
  const ev={...EVENT_CARDS[Math.floor(Math.random()*EVENT_CARDS.length)]};
  events.push(ev);
  const card=document.getElementById('eventCard');
  card.innerHTML=`<b>${ev.title}</b><br>${ev.text}<br><button id="fixBtn">Fix (₿20)</button>`;
  document.getElementById('fixBtn').onclick=()=>{
    if(bits<20)return; bits-=20;
    towers.forEach(t=>{if(ev.fix)ev.fix(t);});
    events=[]; card.innerHTML='';
  };
  towers.forEach(t=>{if(ev.affect)ev.affect(t);});
}
setInterval(pushEvent,8000);

document.getElementById('backupBtn').onclick=()=>{
  if(bits<50)return;
  bits-=50; backup=Date.now();
  events=events.filter(ev=>ev.title!=='No backup');
  alert('Backup created – leaks now half damage.');
};

/************ HUD ************/
function updateHud(){
  document.getElementById('bits').textContent=bits;
  document.getElementById('lives').textContent=lives;
  document.getElementById('wave').textContent=wave;
}

/************ GAME LOOP ************/
function loop(){
  ctx.clearRect(0,0,cvs.width,cvs.height);
  drawPath();

  /* ---- spawn ---- */
  if(--spawnTimer<=0){
    enemies.push(new Enemy());
    spawnTimer=Math.max(25,120-wave*5);   // slightly faster each wave
  }

  /* ---- update ---- */
  enemies.forEach(e=>e.update());
  enemies=enemies.filter(e=>e.hp>0);
  towers.forEach(t=>t.update());
  updateBullets();

  /* ---- wave cleared? ---- */
  if(killsThisWave>=KILLS_PER_WAVE){
    wave++;
    killsThisWave=0;
    bits+=50+wave*10;          // bonus cash
    spawnTimer=90;             // short breather
  }

  /* ---- draw ---- */
  enemies.forEach(e=>e.draw());
  towers.forEach(t=>t.draw());
  drawBullets();
  updateHud();

  /* ---- lose ---- */
  if(lives<=0){
    const dlg=document.getElementById('loseDlg');
    document.getElementById('postMortem').innerHTML=
      `You survived to wave ${wave} and collected ${bits} bits.<br>
       Remember: naming conventions, version control, metadata and regular backups keep real servers alive!`;
    dlg.showModal();
    return;
  }
  requestAnimationFrame(loop);
}

/* ********** START ********** */
loop();
