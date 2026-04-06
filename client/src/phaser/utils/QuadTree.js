export class QuadTree {
  constructor(boundary, capacity) {
    this.boundary = boundary; // { x, y, w, h } where x,y is center
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }

  insert(point) {
    if (!this.contains(this.boundary, point)) {
      return false;
    }

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.northeast.insert(point) ||
      this.northwest.insert(point) ||
      this.southeast.insert(point) ||
      this.southwest.insert(point)
    );
  }

  subdivide() {
    const { x, y, w, h } = this.boundary;
    const nw = { x: x - w / 2, y: y - h / 2, w: w / 2, h: h / 2 };
    const ne = { x: x + w / 2, y: y - h / 2, w: w / 2, h: h / 2 };
    const sw = { x: x - w / 2, y: y + h / 2, w: w / 2, h: h / 2 };
    const se = { x: x + w / 2, y: y + h / 2, w: w / 2, h: h / 2 };

    this.northwest = new QuadTree(nw, this.capacity);
    this.northeast = new QuadTree(ne, this.capacity);
    this.southwest = new QuadTree(sw, this.capacity);
    this.southeast = new QuadTree(se, this.capacity);
    this.divided = true;
  }

  contains(boundary, point) {
    return (
      point.x >= boundary.x - boundary.w &&
      point.x <= boundary.x + boundary.w &&
      point.y >= boundary.y - boundary.h &&
      point.y <= boundary.y + boundary.h
    );
  }

  intersects(range) {
    const { x, y, w, h } = this.boundary;
    return !(
      range.x - range.w > x + w ||
      range.x + range.w < x - w ||
      range.y - range.h > y + h ||
      range.y + range.h < y - h
    );
  }

  query(range, found = []) {
    if (!this.intersects(range)) {
      return found;
    }

    for (let p of this.points) {
      if (this.contains(range, p)) {
        found.push(p);
      }
    }

    if (this.divided) {
      this.northwest.query(range, found);
      this.northeast.query(range, found);
      this.southwest.query(range, found);
      this.southeast.query(range, found);
    }

    return found;
  }
}
