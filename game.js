// Monkey Escape (Phaser 3) — mobile friendly
// States: MENU -> DEMO (auto) or PLAY -> GAMEOVER (choose monkey again)
// Touch controls: left-joystick + sprint button on right
// Abilities:
//  - Jimi: fastest, stamina king
//  - Adamo: on a mini bike (better accel, wider turns)
//  - El Grande: baseline BUT penalized per intro text
// Intro: "Je code mieux que El grande donc le singe el grande est pénalisé"

const GAME_CONFIG = {
  width: 960,
  height: 540,
  backgroundColor: 0x121216,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game'
  },
  scene: []
};

// Utility
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function len(v){ return Math.hypot(v.x, v.y); }
function norm(v){
  const L = len(v);
  return L > 1e-6 ? {x: v.x/L, y: v.y/L} : {x:0,y:0};
}
function add(a,b){ return {x:a.x+b.x, y:a.y+b.y}; }
function sub(a,b){ return {x:a.x-b.x, y:a.y-b.y}; }
function mul(v,s){ return {x:v.x*s, y:v.y*s}; }
function lerp(a,b,t){ return a+(b-a)*t; }
function lerp2(a,b,t){ return {x:lerp(a.x,b.x,t), y:lerp(a.y,b.y,t)}; }

function lineIntersectsRect(p0, p1, r){
  // r: Phaser.Geom.Rectangle
  const segs = [
    [{x:r.x, y:r.y}, {x:r.right, y:r.y}],
    [{x:r.right, y:r.y}, {x:r.right, y:r.bottom}],
    [{x:r.right, y:r.bottom}, {x:r.x, y:r.bottom}],
    [{x:r.x, y:r.bottom}, {x:r.x, y:r.y}]
  ];
  for(const [a,b] of segs){
    if(Phaser.Geom.Intersects.LineToLine(
      new Phaser.Geom.Line(p0.x,p0.y,p1.x,p1.y),
      new Phaser.Geom.Line(a.x,a.y,b.x,b.y))) return true;
  }
  return false;
}

function hasLineOfSight(a, b, obs) {
  for(const o of obs){
    if(lineIntersectsRect(a, b, o.getBounds())) return false;
  }
  return true;
}

class HUD {
  constructor(scene){
    this.scene = scene;
    this.g = scene.add.graphics();
    this.textTop = scene.add.text(12, 10, "", {fontSize: 18, color: "#e7e7ee"}).setScrollFactor(0).setDepth(1000);
    this.textBottom = scene.add.text(12, scene.scale.height-28, "", {fontSize: 16, color: "#bfc1ff"}).setScrollFactor(0).setDepth(1000);
    this.centerText = scene.add.text(scene.scale.width/2, scene.scale.height/2, "", {fontSize: 26, color: "#ffffff", align:"center"})
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);
  }
  drawStamina(monkeys){
    this.g.clear();
    let y = 40;
    for(const m of monkeys){
      const pct = clamp(m.stamina / m.staminaMax, 0, 1);
      const w = 140, h = 8;
      const x = 12;
      this.g.fillStyle(0x2a2a38, 1); this.g.fillRect(x, y, w, h);
      this.g.fillStyle(0x58e67a, 1); this.g.fillRect(x, y, w*pct, h);
      this.scene.add.text(x + w + 10, y-5, m.name, {fontSize: 16, color:"#e7e7ee"}).setDepth(1000).setScrollFactor(0).setAlpha(0.9).setInteractive();
      y += 22;
    }
  }
}

class VirtualControls {
  constructor(scene){
    this.scene = scene;
    this.active = false;
    this.pointerId = null;
    this.origin = {x: 80, y: scene.scale.height - 120};
    this.thumb = {x: this.origin.x, y: this.origin.y};
    this.dir = {x:0,y:0};
    this.sprint = false;

    // visuals
    this.g = scene.add.graphics().setDepth(1000);
    this.sprintBtn = scene.add.rectangle(scene.scale.width-90, scene.scale.height-90, 120, 80, 0x30304a, 0.45)
      .setStrokeStyle(3, 0x8a8cff, 0.8).setDepth(1000).setScrollFactor(0).setInteractive();
    scene.add.text(scene.scale.width-130, scene.scale.height-110, "SPRINT", {fontSize: 18, color:"#e7e7ee"}).setDepth(1000).setScrollFactor(0);

    // input areas
    scene.input.on('pointerdown', (p)=>{
      // left half: joystick, right-bottom: sprint
      if(p.x < scene.scale.width*0.5){
        if(!this.active){
          this.active = true;
          this.pointerId = p.id;
          this.origin = {x: p.x, y: p.y};
          this.thumb = {x: p.x, y: p.y};
          this.dir = {x:0,y:0};
        }
      } else {
        // right side -> sprint
        this.sprint = true;
      }
    });
    scene.input.on('pointermove', (p)=>{
      if(this.active && p.id === this.pointerId){
        const dx = p.x - this.origin.x, dy = p.y - this.origin.y;
        const mag = Math.min(Math.hypot(dx,dy), 60);
        const a = Math.atan2(dy, dx);
        this.thumb = {x: this.origin.x + Math.cos(a)*mag, y: this.origin.y + Math.sin(a)*mag};
        const v = {x: dx, y: dy};
        const L = Math.hypot(v.x, v.y);
        this.dir = L>8 ? {x: v.x/L, y: v.y/L} : {x:0,y:0};
      }
    });
    scene.input.on('pointerup', (p)=>{
      if(this.active && p.id === this.pointerId){
        this.active = false; this.pointerId = null; this.dir = {x:0,y:0};
      } else {
        this.sprint = false;
      }
    });
  }
  update(){
    // draw
    this.g.clear();
    // base
    this.g.lineStyle(3, 0x8a8cff, 0.7);
    this.g.strokeCircle(this.origin.x, this.origin.y, 60);
    this.g.fillStyle(0xffffff, 0.3);
    this.g.fillCircle(this.thumb.x, this.thumb.y, 22);
  }
}

class Monkey {
  constructor(scene, name, type, x, y, color){
    this.scene = scene;
    this.name = name;
    this.type = type;
    this.color = color;
    this.body = scene.physics.add.image(x, y, null).setCircle(16).setTint(color).setDepth(5);
    this.body.setMaxVelocity(260, 260);
    this.radius = 16;

    // stats baseline
    this.baseMaxSpeed = 160;
    this.accel = 550;
    this.turnFeel = 1.0;
    this.staminaMax = 3.2;
    this.stamina = this.staminaMax;
    this.staminaRegen = 0.9;
    this.sprintBoost = 1.45;

    // specials
    if (type === "Jimi"){
      this.baseMaxSpeed = 190;
      this.accel = 600;
      this.turnFeel = 1.12;
      this.staminaMax = 5.0;
      this.stamina = this.staminaMax;
      this.staminaRegen = 1.05;
      this.sprintBoost = 1.7;
    } else if (type === "Adamo"){
      this.baseMaxSpeed = 168;
      this.accel = 640; // punchy (bike)
      this.turnFeel = 0.85; // wider turns feel
      this.staminaMax = 3.8;
      this.stamina = this.staminaMax;
      this.staminaRegen = 0.95;
      this.sprintBoost = 1.52;
    } else if (type === "ElGrande"){
      // penalize per intro text
      this.baseMaxSpeed = 150;
      this.accel = 520;
      this.turnFeel = 1.0;
      this.staminaMax = 3.0;
      this.stamina = this.staminaMax;
      this.staminaRegen = 0.85;
      this.sprintBoost = 1.45;
    }

    this.autopilot = true;
    this.aiTarget = {x, y};
    this.wanderTimer = 0;
  }
  get pos(){ return {x: this.body.x, y: this.body.y}; }
  set pos(p){ this.body.setPosition(p.x, p.y); }
  get vel(){ return {x: this.body.body.velocity.x, y: this.body.body.velocity.y}; }
  set vel(v){ this.body.setVelocity(v.x, v.y); }

  updateAI(world, dt){
    const h = world.hunter;
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0){
      this.wanderTimer = Phaser.Math.FloatBetween(0.5, 1.2);
      const d = Phaser.Math.Distance.Between(this.body.x, this.body.y, h.body.x, h.body.y);
      const away = norm(sub(this.pos, h.pos));
      const noise = {x: Phaser.Math.FloatBetween(-0.7, 0.7), y: Phaser.Math.FloatBetween(-0.7, 0.7)};
      const dir = norm(add(mul(away, 1.5), noise));
      this.aiTarget = add(this.pos, mul(dir, 120 + Phaser.Math.FloatBetween(0, 120)));
    }

    let desired = norm(sub(this.aiTarget, this.pos));
    const dh = Phaser.Math.Distance.Between(this.body.x, this.body.y, h.body.x, h.body.y);
    if (dh < 240){
      // juke away from predicted hunter
      const T = clamp(dh / 250, 0.2, 1.0);
      const predicted = add(h.pos, mul(h.vel, T));
      desired = norm(add(mul(desired, 0.4), norm(sub(this.pos, predicted))));
    }

    // obstacle avoidance
    desired = world.avoid(this.pos, desired);

    // AI sprint
    const wantSprint = (dh < 260 && this.stamina > 0.1);
    let maxSpeed = this.baseMaxSpeed * (wantSprint ? this.sprintBoost : 1.0);
    if (wantSprint) this.stamina = Math.max(0, this.stamina - dt);
    else this.stamina = Math.min(this.staminaMax, this.stamina + this.staminaRegen*dt);
    if (this.stamina <= 0.01) maxSpeed *= 0.8;

    const currentDir = len(this.vel) > 1e-3 ? norm(this.vel) : desired;
    const blended = norm(lerp2(currentDir, desired, this.turnFeel*0.5));
    const acc = mul(blended, this.accel);
    this.vel = mul(norm(add(this.vel, mul(acc, dt))), Math.min(maxSpeed, len(add(this.vel, mul(acc, dt)))));
  }

  updatePlayer(world, dt, inputDir, sprint){
    let desired = norm(inputDir);
    if (len(desired) < 0.1){
      desired = len(this.vel)>0.1 ? norm(this.vel) : {x:0,y:0};
    }
    desired = world.avoid(this.pos, desired);

    let maxSpeed = this.baseMaxSpeed * (sprint && this.stamina>0.05 ? this.sprintBoost : 1.0);
    if (sprint && len(inputDir)>0.1) this.stamina = Math.max(0, this.stamina - dt);
    else this.stamina = Math.min(this.staminaMax, this.stamina + this.staminaRegen*dt);
    if (this.stamina <= 0.01) maxSpeed *= 0.8;

    const currentDir = len(this.vel) > 1e-3 ? norm(this.vel) : desired;
    const blended = norm(lerp2(currentDir, desired, this.turnFeel*0.5));
    const acc = mul(blended, this.accel);
    this.vel = mul(norm(add(this.vel, mul(acc, dt))), Math.min(maxSpeed, len(add(this.vel, mul(acc, dt)))));
  }
}

class Hunter {
  constructor(scene, x, y){
    this.scene = scene;
    this.body = scene.physics.add.image(x, y, null).setCircle(18).setTint(0xeb4034).setDepth(5);
    this.maxSpeed = 175;
    this.accel = 450;
    this.state = "WANDER";
    this.wanderTarget = {x, y};
    this.stateTimer = 0;
  }
  get pos(){ return {x: this.body.x, y: this.body.y}; }
  set pos(p){ this.body.setPosition(p.x, p.y); }
  get vel(){ return {x: this.body.body.velocity.x, y: this.body.body.velocity.y}; }
  set vel(v){ this.body.setVelocity(v.x, v.y); }

  update(world, dt){
    this.stateTimer += dt;
    const ms = world.monkeys;
    // pick target
    let bestIdx = 0, bestScore = -1e9;
    for(let i=0;i<ms.length;i++){
      const m = ms[i];
      const d = Phaser.Math.Distance.Between(this.body.x, this.body.y, m.body.x, m.body.y);
      const los = hasLineOfSight(this.pos, m.pos, world.obstacles);
      const score = -d + (los ? 200 : 0);
      if(score > bestScore){ bestScore = score; bestIdx=i; }
    }
    const target = ms[bestIdx];
    const los = hasLineOfSight(this.pos, target.pos, world.obstacles);
    if (los) this.state = "PURSUE";
    else if (this.stateTimer > 1.0) this.state = "WANDER";

    let desired = {x:0, y:0};
    if (this.state === "PURSUE"){
      const toT = sub(target.pos, this.pos);
      const dist = len(toT);
      const T = clamp(dist/250, 0.2, 1.0);
      const predicted = add(target.pos, mul(target.vel, T));
      desired = norm(sub(predicted, this.pos));
    } else {
      if (this.stateTimer > 2.0){
        this.stateTimer = 0;
        this.wanderTarget = {x: Phaser.Math.Between(80, world.W-80), y: Phaser.Math.Between(80, world.H-80)};
      }
      desired = norm(sub(this.wanderTarget, this.pos));
    }

    desired = world.avoid(this.pos, desired);

    const acc = mul(desired, this.accel);
    const newVel = add(this.vel, mul(acc, dt));
    const L = len(newVel);
    const capped = L>this.maxSpeed ? mul(norm(newVel), this.maxSpeed) : newVel;
    this.vel = capped;
  }
}

class GameScene extends Phaser.Scene {
  constructor(){ super('Game'); }
  init(){
    this.state = "MENU";
    this.timer = 0;
    this.surviveGoal = 45; // seconds to "win"
    this.win = false;
    this.selected = null; // "Adamo" | "El Grande" | "Jimi"
    this.playerMonkey = null;
    this.keyboard = null;
  }
  create(){
    this.W = this.scale.width;
    this.H = this.scale.height;

    // Arena border (just visual)
    const border = this.add.rectangle(this.W/2, this.H/2, this.W-20, this.H-20, 0x161823).setStrokeStyle(4, 0x444466).setDepth(1);

    // Obstacles
    this.obstacles = [];
    const rects = [
      new Phaser.Geom.Rectangle(200, 120, 160, 70),
      new Phaser.Geom.Rectangle(this.W-420, 100, 220, 60),
      new Phaser.Geom.Rectangle(this.W/2-90, this.H/2-60, 180, 120),
      new Phaser.Geom.Rectangle(240, this.H-180, 200, 60),
      new Phaser.Geom.Rectangle(this.W-320, this.H-200, 160, 110),
    ];
    for(const r of rects){
      const g = this.add.rectangle(r.x + r.width/2, r.y + r.height/2, r.width, r.height, 0x3c3c4c).setDepth(2);
      g.setStrokeStyle(2, 0x5a5a78);
      this.physics.add.existing(g, true); // static
      this.obstacles.push(g);
    }

    // World helper funcs
    this.avoid = (pos, desired)=>{
      // probe in desired direction; nudge away if hits any obstacle
      const probe = add(pos, mul(desired, 28));
      for(const o of this.obstacles){
        if (o.body && Phaser.Geom.Rectangle.Contains(o.getBounds(), probe.x, probe.y)){
          const c = {x:o.x, y:o.y};
          const away = norm(sub(pos, c));
          return norm(add(desired, mul(away, 0.8)));
        }
      }
      return norm(desired);
    };

    // Create actors
    this.monkeys = [
      new Monkey(this, "Adamo", "Adamo", 160, this.H-100, 0xffd700),
      new Monkey(this, "El Grande", "ElGrande", this.W/2, this.H-100, 0xb4ff78),
      new Monkey(this, "Jimi", "Jimi", this.W-160, this.H-100, 0x50c8ff)
    ];
    this.hunter = new Hunter(this, this.W/2, 120);

    // Collisions with obstacles and world bounds
    for(const m of this.monkeys){
      m.body.setCollideWorldBounds(true, 1, 1);
      for(const o of this.obstacles){
        this.physics.add.collider(m.body, o);
      }
    }
    this.hunter.body.setCollideWorldBounds(true, 1, 1);
    for(const o of this.obstacles){
      this.physics.add.collider(this.hunter.body, o);
    }

    // UI/HUD
    this.hud = new HUD(this);
    this.hud.centerText.setText("Je code mieux que El grande donc le singe el grande est pénalisé\n\nMonkey Escape\nWatch the demo or tap PLAY")
      .setStyle({fontSize: 24, color:"#ffffff"});
    this.hud.textTop.setText("");
    this.hud.textBottom.setText("");

    // Menu buttons
    this.menuContainer = this.add.container(this.W/2, this.H/2 + 120).setDepth(1000);
    const playBtn = this.add.rectangle(0, 0, 200, 50, 0x2f8b57).setStrokeStyle(3, 0x75ffa0).setInteractive();
    const demoBtn = this.add.rectangle(0, 70, 200, 50, 0x30304a).setStrokeStyle(3, 0x8a8cff).setInteractive();
    const playText = this.add.text(-48, -12, "PLAY", {fontSize: 24, color:"#ffffff"});
    const demoText = this.add.text(-55, 58, "WATCH DEMO", {fontSize: 20, color:"#e7e7ee"});
    this.menuContainer.add([playBtn, demoBtn, playText, demoText]);
    playBtn.on('pointerup', ()=> this.showMonkeySelect("PLAY"));
    demoBtn.on('pointerup', ()=> this.startDemo());

    // Monkey selection overlay
    this.selectContainer = this.add.container(this.W/2, this.H/2).setDepth(1001).setVisible(false);
    const panel = this.add.rectangle(0, 0, Math.min(520, this.W-60), 280, 0x1b1c2a).setStrokeStyle(3, 0x8a8cff);
    const title = this.add.text(0, -120, "Choose your monkey", {fontSize: 24, color:"#ffffff"}).setOrigin(0.5);
    const b1 = this.mkButton(-160, -50, "Adamo");
    const b2 = this.mkButton(0, -50, "El Grande");
    const b3 = this.mkButton(160, -50, "Jimi");
    const tip = this.add.text(0, 80, "One monkey per game. Change only after you lose or win.", {fontSize: 16, color:"#bfc1ff"}).setOrigin(0.5);
    this.selectContainer.add([panel, title, b1, b2, b3, tip]);

    // Desktop keyboard
    this.keyboard = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left:'A', right:'D', shift: 'SHIFT'
    });

    // Virtual controls (always active, harmless on desktop)
    this.vc = new VirtualControls(this);

    // Auto start demo after a moment
    this.time.delayedCall(2200, ()=>{
      if(this.state === "MENU") this.startDemo();
    });
  }

  mkButton(dx, dy, label){
    const btn = this.add.container(dx, dy);
    const r = this.add.rectangle(0, 0, 150, 50, 0x30304a).setStrokeStyle(3, 0x8a8cff).setInteractive();
    const t = this.add.text(0, -12, label, {fontSize: 18, color:"#ffffff"}).setOrigin(0.5, 0);
    btn.add([r, t]);
    r.on('pointerup', ()=> this.selectMonkey(label));
    return btn;
  }

  showMonkeySelect(reason){
    this.menuContainer.setVisible(false);
    this.hud.centerText.setText(reason === "PLAY" ? "Pick a monkey" : "Choose your monkey");
    this.selectContainer.setVisible(true);
  }

  selectMonkey(label){
    this.selected = label;
    this.selectContainer.setVisible(false);
    this.startPlay();
  }

  startDemo(){
    this.state = "DEMO";
    this.timer = 0; this.win = false;
    this.hud.centerText.setText("Demo mode — tap PLAY to take control");
    this.menuContainer.setVisible(true);
    // all autopilot
    for(const m of this.monkeys) m.autopilot = true;
  }

  startPlay(){
    // Reset positions & stamina for a clean run
    this.resetRun();
    // Select monkey to control
    const map = {"Adamo":0, "El Grande":1, "Jimi":2};
    this.playerMonkey = this.monkeys[map[this.selected]];
    for(const m of this.monkeys) m.autopilot = true;
    this.playerMonkey.autopilot = false;

    this.state = "PLAY";
    this.timer = 0; this.win = false;
    this.hud.centerText.setText("");
  }

  resetRun(){
    const H = this.H, W = this.W;
    const start = [{x:160,y:H-100},{x:W/2,y:H-100},{x:W-160,y:H-100}];
    this.monkeys[0].pos = start[0]; this.monkeys[0].vel = {x:0,y:0}; this.monkeys[0].stamina = this.monkeys[0].staminaMax;
    this.monkeys[1].pos = start[1]; this.monkeys[1].vel = {x:0,y:0}; this.monkeys[1].stamina = this.monkeys[1].staminaMax;
    this.monkeys[2].pos = start[2]; this.monkeys[2].vel = {x:0,y:0}; this.monkeys[2].stamina = this.monkeys[2].staminaMax;
    this.hunter.pos = {x: W/2, y: 100}; this.hunter.vel = {x:0,y:0};
  }

  endGame(caught){
    this.state = "GAMEOVER";
    this.win = !caught;
    const msg = caught ? "GAME OVER — The hunter caught a monkey!" : "YOU WIN — You survived!";
    this.hud.centerText.setText(msg+"\n\nChoose a monkey to play again");
    this.menuContainer.setVisible(false);
    this.selectContainer.setVisible(true);
  }

  update(time, delta){
    const dt = Math.min(delta/1000, 0.05);
    this.vc.update();

    // UI strings
    let top = "";
    if (this.state === "PLAY"){
      top = `Survive: ${this.timer.toFixed(1)} / ${this.surviveGoal}s`;
    } else if (this.state === "DEMO"){
      top = `Demo mode — watch them run`;
    } else {
      top = `Monkey Escape`;
    }
    this.hud.textTop.setText(top);
    this.hud.textBottom.setText("Controls: Move with joystick or WASD  |  Sprint with button or Shift  |  Survive to win");

    // Update
    if (this.state === "DEMO" || this.state === "PLAY"){
      // Hunter
      this.hunter.update(this, dt);

      // Monkeys
      for(const m of this.monkeys){
        if (this.state === "PLAY" && m === this.playerMonkey){
          // Inputs
          const dir = {x:0,y:0};
          if (this.keyboard.left.isDown) dir.x -= 1;
          if (this.keyboard.right.isDown) dir.x += 1;
          if (this.keyboard.up.isDown) dir.y -= 1;
          if (this.keyboard.down.isDown) dir.y += 1;
          // Merge joystick
          const merged = len(this.vc.dir) > 0 ? this.vc.dir : dir;
          const sprint = this.keyboard.shift.isDown || this.vc.sprint;
          m.updatePlayer(this, dt, merged, sprint);
        } else {
          m.updateAI(this, dt);
        }
      }

      // Integrate velocities are handled by Arcade internally via setVelocity

      // Capture check
      for(const m of this.monkeys){
        const d = Phaser.Math.Distance.Between(m.body.x, m.body.y, this.hunter.body.x, this.hunter.body.y);
        if (d < 32){
          // caught
          if (this.state === "PLAY") this.endGame(true);
          else this.resetRun(); // in demo just restart loop
          break;
        }
      }

      // Win condition
      if (this.state === "PLAY"){
        this.timer += dt;
        if (this.timer >= this.surviveGoal){
          this.endGame(false);
        }
      }
    }
  }
}

GAME_CONFIG.scene = [GameScene];
new Phaser.Game(GAME_CONFIG);
