// minimal 2d vector, only what the 2d distance methods need, so the geometry has no render engine dependency
export class Vec2 {
  constructor(public x = 0, public y = 0) {}

  static Dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
  }

  static Cross(a: Vec2, b: Vec2): number {
    return a.x * b.y - a.y * b.x;
  }

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  subtract(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  /** normalizes in place */
  normalize(): Vec2 {
    const l = this.length();
    if (l !== 0) {
      this.x /= l;
      this.y /= l;
    }
    return this;
  }

  /** sets in place */
  set(x: number, y: number): Vec2 {
    this.x = x;
    this.y = y;
    return this;
  }
}
