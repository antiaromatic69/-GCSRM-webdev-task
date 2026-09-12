(function(){
  const tank = document.getElementById('tank');
  let tankRect = tank.getBoundingClientRect();
  function updateRect(){ tankRect = tank.getBoundingClientRect(); }
  window.addEventListener('resize', updateRect);

  const pointer = { x: null, y: null };
  document.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function dist(x1,y1,x2,y2){ return Math.hypot(x2-x1, y2-y1); }

  // ---------- Bubbles ----------
  const bubbleLayer = document.getElementById('bubbles');
  for(let i=0;i<16;i++){
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = 4 + Math.random()*7;
    b.style.width = size+'px';
    b.style.height = size+'px';
    b.style.left = (Math.random()*94)+'%';
    b.style.animationDuration = (4 + Math.random()*5)+'s';
    b.style.animationDelay = (Math.random()*6)+'s';
    bubbleLayer.appendChild(b);
  }

  // ---------- Food ----------
  const foods = [];
  class Food{
    constructor(x,y){
      this.x = x; this.y = y; this.eaten = false; this.vy = 0.035;
      this.el = document.createElement('div');
      this.el.className = 'food-pellet';
      tank.appendChild(this.el);
    }
    update(dt){
      if(this.eaten) return;
      // food should settle a bit above the fish's own floor (fish center can only
      // get within half their height of the bottom), otherwise it rests just out
      // of reach and fish bump an invisible wall trying to get to it
      const maxY = tankRect.height * 0.85 - 40;
      if(this.y < maxY) this.y += this.vy * dt;
    }
    render(){
      this.el.style.left = (this.x - 5) + 'px';
      this.el.style.top = (this.y - 5) + 'px';
    }
    eat(){
      this.eaten = true;
      this.el.remove();
    }
  }

  function spawnYum(x,y){
    const el = document.createElement('div');
    el.className = 'yum';
    const words = ['yum!','nom!','slurp!','yay!','mmm!'];
    el.textContent = words[Math.floor(Math.random()*words.length)];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    tank.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function spawnCrash(x,y){
    const el = document.createElement('div');
    el.className = 'crash';
    const words = ['bonk!','boink!','crash!','whoa!','oof!'];
    el.textContent = words[Math.floor(Math.random()*words.length)];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    tank.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  document.querySelectorAll('.jar-pellet').forEach(p => {
    p.addEventListener('pointerdown', startFoodDrag);
  });

  function startFoodDrag(e){
    e.preventDefault();
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    document.body.appendChild(ghost);
    moveGhost(e);

    function moveGhost(ev){
      ghost.style.left = (ev.clientX - 6) + 'px';
      ghost.style.top = (ev.clientY - 6) + 'px';
    }
    function onMove(ev){ moveGhost(ev); }
    function onUp(ev){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      ghost.remove();
      if (ev.clientX > tankRect.left && ev.clientX < tankRect.right &&
          ev.clientY > tankRect.top && ev.clientY < tankRect.bottom){
        const lx = ev.clientX - tankRect.left;
        const ly = ev.clientY - tankRect.top;
        foods.push(new Food(lx, ly));
      }
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // ---------- Fish ----------
  const FISH_COLORS = ['#FF8C5A', '#FFD34E', '#9B6BD9', '#5EDFB0'];

  class Fish{
    constructor(color, w, h, x, y){
      this.color = color; this.w = w; this.h = h;
      this.x = x; this.y = y;
      this.vx = (Math.random()*2-1)*0.05;
      this.vy = (Math.random()*2-1)*0.03;
      this.wanderVx = this.vx;
      this.wanderVy = this.vy;
      this.facing = 1;
      this.dragging = false;
      this.target = null;
      this.isAngry = false;
      this.wanderTimer = 1000 + Math.random()*1500;
      this.bobPhase = Math.random()*Math.PI*2;
      this.r = Math.min(this.w, this.h) * 0.42;
      this.bumpCooldown = 0;
      this.el = this.createEl();
    }

    createEl(){
      const div = document.createElement('div');
      div.className = 'fish';
      div.style.width = this.w + 'px';
      div.style.height = this.h + 'px';
      div.innerHTML =
        '<svg class="fish-body" viewBox="-20 0 140 70" style="color:' + this.color + '">' +
          '<polygon points="-20,15 4,35 -20,55"></polygon>' +
          '<polygon points="30,12 48,-6 63,12" opacity="0.9"></polygon>' +
          '<ellipse cx="55" cy="35" rx="45" ry="26"></ellipse>' +
          '<ellipse cx="48" cy="46" rx="18" ry="7" fill="rgba(255,255,255,.18)"></ellipse>' +
        '</svg>' +
        '<div class="eyes">' +
          '<div class="eye"><div class="pupil"></div></div>' +
          '<div class="eye"><div class="pupil"></div></div>' +
        '</div>';
      tank.appendChild(div);
      div.addEventListener('pointerdown', e => this.onDown(e));
      return div;
    }

    onDown(e){
      e.preventDefault();
      this.dragging = true;
      this.target = null;
      const lx = e.clientX - tankRect.left, ly = e.clientY - tankRect.top;
      this.offX = this.x - lx; this.offY = this.y - ly;
      this._lastPX = e.clientX; this._lastPY = e.clientY; this._lastPT = performance.now();
      this._throwVx = 0; this._throwVy = 0;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add('squeezed');
      this._move = ev => this.onMove(ev);
      this._up = ev => this.onUp(ev);
      this.el.addEventListener('pointermove', this._move);
      this.el.addEventListener('pointerup', this._up);
    }
    onMove(e){
      if(!this.dragging) return;
      const lx = e.clientX - tankRect.left, ly = e.clientY - tankRect.top;
      this.x = clamp(lx + this.offX, this.w/2, tankRect.width - this.w/2);
      this.y = clamp(ly + this.offY, this.h/2, tankRect.height*0.85 - this.h/2);

      const now = performance.now();
      const pdt = now - this._lastPT;
      if(pdt > 0){
        // blend so a single jittery sample can't dominate the throw speed
        const vx = (e.clientX - this._lastPX) / pdt;
        const vy = (e.clientY - this._lastPY) / pdt;
        this._throwVx = this._throwVx * 0.5 + vx * 0.5;
        this._throwVy = this._throwVy * 0.5 + vy * 0.5;
      }
      this._lastPX = e.clientX; this._lastPY = e.clientY; this._lastPT = now;
    }
    onUp(e){
      this.dragging = false;
      this.el.classList.remove('squeezed');
      this.el.classList.add('wobble');
      setTimeout(() => this.el.classList.remove('wobble'), 500);
      this.el.removeEventListener('pointermove', this._move);
      this.el.removeEventListener('pointerup', this._up);

      // fling it in the direction (and speed) it was moving when released
      const maxSpeed = 0.55;
      let vx = this._throwVx || 0, vy = this._throwVy || 0;
      const sp = Math.hypot(vx, vy);
      if(sp > maxSpeed){ vx = vx/sp*maxSpeed; vy = vy/sp*maxSpeed; }
      this.vx = vx; this.vy = vy;
      // let it coast at this speed instead of instantly steering back to a lazy drift
      this.wanderVx = vx; this.wanderVy = vy;
    }

    bump(){
      if(this.bumpCooldown > 0) return;
      this.bumpCooldown = 300;
      this.el.classList.add('bump');
      setTimeout(() => this.el.classList.remove('bump'), 260);
    }

    update(dt){
      this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
      if(this.dragging) return;

      let desiredVx = this.wanderVx, desiredVy = this.wanderVy, steer = 0.0025;

      if(this.isAngry){
        let nearest = null, best = Infinity;
        for(const f of fishes){
          if(f === this) continue;
          const d = dist(this.x, this.y, f.x, f.y);
          if(d < best){ best = d; nearest = f; }
        }
        if(nearest){
          const dx = nearest.x - this.x, dy = nearest.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          const speed = 0.24;
          desiredVx = (dx/d) * speed;
          desiredVy = (dy/d) * speed;
          steer = 0.012;
        }
      } else {

      if(this.target && this.target.eaten) this.target = null;
      if(!this.target){
        let nearest = null, best = Infinity;
        for(const f of foods){
          if(f.eaten) continue;
          const d = dist(this.x, this.y, f.x, f.y);
          if(d < best){ best = d; nearest = f; }
        }
        if(nearest) this.target = nearest;
      }

      if(this.target && !this.target.eaten){
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = 0.14;
        desiredVx = (dx/d) * speed;
        desiredVy = (dy/d) * speed;
        steer = 0.007;
        if(d < 16){
          this.target.eat();
          this.target = null;
          this.el.classList.add('gulp');
          setTimeout(() => this.el.classList.remove('gulp'), 400);
          spawnYum(this.x, this.y - this.h/2);
        }
      } else {
        this.wanderTimer -= dt;
        if(this.wanderTimer <= 0){
          this.wanderVx = (Math.random()*2-1)*0.055;
          this.wanderVy = (Math.random()*2-1)*0.035;
          this.wanderTimer = 1500 + Math.random()*2000;
        }
        desiredVx = this.wanderVx;
        desiredVy = this.wanderVy;
      }

      }

      // steer current velocity toward the desired one instead of snapping to it -
      // this is what gives the fish mass/inertia rather than teleport-like turns
      const t = Math.min(1, steer * dt);
      this.vx += (desiredVx - this.vx) * t;
      this.vy += (desiredVy - this.vy) * t;

      // cap top speed so a hard throw or a pile-up of collisions can't send a fish flying
      const maxSpeed = 0.55;
      const curSpeed = Math.hypot(this.vx, this.vy);
      if(curSpeed > maxSpeed){ this.vx = this.vx/curSpeed*maxSpeed; this.vy = this.vy/curSpeed*maxSpeed; }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // bounce off the glass, keeping most (not all) of the momentum
      const wallBounce = 0.55;
      const minX = this.w/2, maxX = tankRect.width - this.w/2;
      const minY = this.h/2 + 6, maxY = tankRect.height*0.85 - this.h/2;
      if(this.x < minX){ this.x = minX; this.vx = Math.abs(this.vx) * wallBounce; this.wanderVx = this.vx; }
      if(this.x > maxX){ this.x = maxX; this.vx = -Math.abs(this.vx) * wallBounce; this.wanderVx = this.vx; }
      if(this.y < minY){ this.y = minY; this.vy = Math.abs(this.vy) * wallBounce; this.wanderVy = this.vy; }
      if(this.y > maxY){ this.y = maxY; this.vy = -Math.abs(this.vy) * wallBounce; this.wanderVy = this.vy; }

      if(Math.abs(this.vx) > 0.008) this.facing = this.vx < 0 ? -1 : 1;
    }

    render(){
      const bob = this.dragging ? 0 : Math.sin(performance.now()/650 + this.bobPhase) * 3;
      this.el.style.left = (this.x - this.w/2) + 'px';
      this.el.style.top = (this.y - this.h/2 + bob) + 'px';
      this.el.style.setProperty('--facing', this.facing);
      const body = this.el.querySelector('.fish-body');
      if(!this.el.classList.contains('squeezed') &&
         !this.el.classList.contains('wobble') &&
         !this.el.classList.contains('gulp') &&
         !this.el.classList.contains('bump')){
        body.style.transform = 'scaleX(' + this.facing + ')';
      }

      const eyes = this.el.querySelectorAll('.eye');
      eyes.forEach(eye => {
        const r = eye.getBoundingClientRect();
        const ecx = r.left + r.width/2, ecy = r.top + r.height/2;
        let dx = 0, dy = 0;
        if(pointer.x !== null){
          dx = pointer.x - ecx; dy = pointer.y - ecy;
          const m = Math.hypot(dx, dy) || 1;
          const max = 5;
          const scale = Math.min(1, max/m);
          dx *= scale; dy *= scale;
        }
        eye.querySelector('.pupil').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      });
    }
  }

  function clampFishToBounds(f){
    const minX = f.w/2, maxX = tankRect.width - f.w/2;
    const minY = f.h/2 + 6, maxY = tankRect.height*0.85 - f.h/2;
    f.x = clamp(f.x, minX, maxX);
    f.y = clamp(f.y, minY, maxY);
  }

  function resolveCollisions(){
    for(let i=0; i<fishes.length; i++){
      for(let j=i+1; j<fishes.length; j++){
        const a = fishes[i], b = fishes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const minDist = a.r + b.r;
        if(d >= minDist) continue;

        if(d < 0.001){ d = 0.001; dx = 0.001; dy = 0; }
        const nx = dx / d, ny = dy / d;
        const overlap = minDist - d;

        const aFixed = a.dragging, bFixed = b.dragging;
        if(!aFixed && !bFixed){
          a.x -= nx * overlap/2; a.y -= ny * overlap/2;
          b.x += nx * overlap/2; b.y += ny * overlap/2;
        } else if(aFixed && !bFixed){
          b.x += nx * overlap; b.y += ny * overlap;
        } else if(!aFixed && bFixed){
          a.x -= nx * overlap; a.y -= ny * overlap;
        }

        clampFishToBounds(a);
        clampFishToBounds(b);

        const relVx = b.vx - a.vx, relVy = b.vy - a.vy;
        const relSpeedAlongNormal = relVx*nx + relVy*ny;
        if(relSpeedAlongNormal < 0){
          const restitution = 0.7;
          const impulse = -(1+restitution) * relSpeedAlongNormal / 2;
          if(!aFixed){ a.vx -= impulse*nx; a.vy -= impulse*ny; a.wanderVx = a.vx; a.wanderVy = a.vy; }
          if(!bFixed){ b.vx += impulse*nx; b.vy += impulse*ny; b.wanderVx = b.vx; b.wanderVy = b.vy; }
        }

        const impactSpeed = Math.abs(relSpeedAlongNormal);
        if(impactSpeed > 0.02 || aFixed || bFixed){
          a.bump(); b.bump();
          spawnCrash((a.x+b.x)/2, (a.y+b.y)/2);
        }
      }
    }
  }

  const fishes = [];
  function initFish(){
    updateRect();
    const configs = [
      { w: 92, h: 52 },
      { w: 76, h: 44 },
      { w: 100, h: 56 },
      { w: 68, h: 40 }
    ];
    configs.forEach((c, i) => {
      const x = tankRect.width * (0.25 + 0.5*Math.random());
      const y = tankRect.height * (0.25 + 0.4*Math.random());
      fishes.push(new Fish(FISH_COLORS[i % FISH_COLORS.length], c.w, c.h, x, y));
    });
  }

  function loop(now){
    if(!loop.last) loop.last = now;
    const dt = Math.min(50, now - loop.last);
    loop.last = now;

    fishes.forEach(f => f.update(dt));
    resolveCollisions();
    for(let i = foods.length - 1; i >= 0; i--){
      foods[i].update(dt);
      if(foods[i].eaten) foods.splice(i, 1);
    }
    fishes.forEach(f => f.render());
    foods.forEach(f => f.render());

    requestAnimationFrame(loop);
  }

  function setupAngryControls(){
    const btns = document.querySelectorAll('.angry-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const fish = fishes[idx];
        if(!fish) return;
        const turningOn = !fish.isAngry;

        fishes.forEach(f => { f.isAngry = false; f.el.classList.remove('angry'); });
        btns.forEach(b => b.classList.remove('active'));

        if(turningOn){
          fish.isAngry = true;
          fish.target = null;
          fish.el.classList.add('angry');
          btn.classList.add('active');
        }
      });
    });
  }

  window.addEventListener('load', () => {
    initFish();
    setupAngryControls();
    requestAnimationFrame(loop);
  });
})();